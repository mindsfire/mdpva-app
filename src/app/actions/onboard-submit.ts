"use server";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { memberApplications } from "@/db/schema";
import { isUniqueViolationOn } from "@/lib/db-errors";
import {
  generateApplicationNo,
} from "@/lib/onboarding/application-no";
import { readOnboardSession } from "@/lib/onboarding/session";
import { r2, R2_BUCKET, pendingPhotoKeyFor } from "@/lib/r2";
import {
  MAX_UPLOAD_BYTES,
  processPassportPhoto,
  sniffImageType,
} from "@/lib/photo-processing";
import { applicationInputSchema } from "@/lib/validation/application";

export type SubmitResult =
  | { ok: true; applicationNo: string }
  | { ok: false; error: string; field?: string };

/** Retried on the astronomically unlikely application-number collision. */
const NO_ATTEMPTS = 5;

/**
 * Submits (or resubmits) the member's details for review.
 *
 * Writes only to `member_applications` — never to `members`. That gap is the
 * load-bearing control for a form gated on facts a member knows rather than a
 * password: even a successful impersonation cannot alter the directory.
 *
 * Resubmission supersedes any prior pending application rather than queueing a
 * second, so an admin never reviews stale values and a member never appears
 * twice in the queue.
 */
export async function submitApplicationAction(
  formData: FormData,
): Promise<SubmitResult> {
  const session = await readOnboardSession();
  if (!session) {
    return { ok: false, error: "session_expired" };
  }

  const parsed = applicationInputSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    area: formData.get("area"),
    pincode: formData.get("pincode"),
    city: formData.get("city"),
    state: formData.get("state"),
    profession: formData.get("profession"),
    businessName: formData.get("businessName"),
    dob: formData.get("dob"),
    bloodGroup: formData.get("bloodGroup"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the details and try again.",
      field: first?.path[0]?.toString(),
    };
  }

  // Photo is required on a first submission; on a resubmission the member may
  // keep the one already under review rather than re-picking it.
  const file = formData.get("photo");
  const hasNewPhoto = file instanceof File && file.size > 0;

  const [existing] = await db
    .select({ id: memberApplications.id, photoKey: memberApplications.photoKey })
    .from(memberApplications)
    .where(
      and(
        eq(memberApplications.memberId, session.memberId),
        eq(memberApplications.status, "pending"),
      ),
    )
    .limit(1);

  if (!hasNewPhoto && !existing?.photoKey) {
    return { ok: false, error: "photo_required", field: "photo" };
  }

  let processedPhoto: Buffer | null = null;
  if (hasNewPhoto) {
    const upload = file as File;
    if (upload.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: "photo_too_large", field: "photo" };
    }
    const buf = Buffer.from(await upload.arrayBuffer());
    // Never trust the extension or the browser-supplied Content-Type.
    if (!sniffImageType(buf)) {
      return { ok: false, error: "photo_not_an_image", field: "photo" };
    }
    try {
      // Re-cropped server-side regardless of what the browser cropper did.
      processedPhoto = (await processPassportPhoto(buf)).webp;
    } catch {
      return { ok: false, error: "photo_unreadable", field: "photo" };
    }
  }

  // Supersede any prior pending application. Done before the insert because
  // `member_applications_one_pending` permits only one at a time.
  if (existing) {
    await db
      .update(memberApplications)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(eq(memberApplications.id, existing.id));
  }

  let inserted: { id: string; applicationNo: string } | undefined;
  for (let attempt = 0; attempt < NO_ATTEMPTS && !inserted; attempt += 1) {
    const applicationNo = generateApplicationNo();
    try {
      [inserted] = await db
        .insert(memberApplications)
        .values({
          applicationNo,
          memberId: session.memberId,
          status: "pending",
          ...parsed.data,
          // Carried over when the member kept their existing photo.
          photoKey: hasNewPhoto ? null : (existing?.photoKey ?? null),
        })
        .returning({
          id: memberApplications.id,
          applicationNo: memberApplications.applicationNo,
        });
    } catch (err) {
      // Only a duplicate application_no is worth retrying; anything else is a
      // real failure and must not be swallowed. Checked via the Postgres
      // constraint name on `cause` — matching `err.message` does not work,
      // because Drizzle sets that to the query text.
      if (!isUniqueViolationOn(err, "member_applications_no_unique")) throw err;
    }
  }

  if (!inserted) {
    return { ok: false, error: "submit_failed" };
  }

  if (processedPhoto) {
    const key = pendingPhotoKeyFor(inserted.id);
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: processedPhoto,
        ContentType: "image/webp",
      }),
    );
    await db
      .update(memberApplications)
      .set({ photoKey: key })
      .where(eq(memberApplications.id, inserted.id));

    // The superseded row's photo is now unreferenced.
    if (existing?.photoKey && existing.photoKey !== key) {
      await r2
        .send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: existing.photoKey,
          }),
        )
        .catch(() => {
          // A leaked object is cleaned up by the pending-prefix sweep; failing
          // the member's submission over it would be the wrong trade.
        });
    }
  }

  return { ok: true, applicationNo: inserted.applicationNo };
}
