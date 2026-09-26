"use server";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { memberApplications, members } from "@/db/schema";
import { blindIndex, encryptPii } from "@/lib/crypto/pii";
import { isUniqueViolationOn } from "@/lib/db-errors";
import {
  generateApplicationNo,
} from "@/lib/onboarding/application-no";
import { getLatestApplicationForMember } from "@/lib/onboarding/member-application";
import { canResubmit } from "@/lib/onboarding/resubmit";
import { readOnboardSession } from "@/lib/onboarding/session";
import { isPendingPhotoKey, r2, R2_BUCKET, pendingPhotoKeyFor } from "@/lib/r2";
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
 * Submits the member's details for review — a first submission, or fixing a
 * rejected one. See `canResubmit`: pending and approved are locked, so this
 * can only ever produce at most one open (pending) application per member.
 *
 * Writes only to `member_applications` — never to `members`. That gap is the
 * load-bearing control for a form gated on facts a member knows rather than a
 * password: even a successful impersonation cannot alter the directory.
 *
 * A resubmission supersedes the rejected application it's fixing rather than
 * queueing a second row, so an admin never reviews stale values and a member
 * never appears twice in the queue.
 */
export async function submitApplicationAction(
  formData: FormData,
): Promise<SubmitResult> {
  const session = await readOnboardSession();
  if (!session) {
    return { ok: false, error: "session_expired" };
  }

  // Locked unless the last (non-superseded) application was rejected — see
  // `canResubmit`. Checked before anything else so a blocked member isn't
  // told their aadhaar or a field looks fine, only to be refused anyway.
  const latestApplication = await getLatestApplicationForMember(
    session.memberId,
  );
  if (latestApplication && !canResubmit(latestApplication.status)) {
    return {
      ok: false,
      error:
        latestApplication.status === "pending"
          ? "already_pending"
          : "already_approved",
    };
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
    professionOther: formData.get("professionOther"),
    businessName: formData.get("businessName"),
    dob: formData.get("dob"),
    bloodGroup: formData.get("bloodGroup"),
    aadhaar: formData.get("aadhaar"),
    nomineeName: formData.get("nomineeName"),
    nomineeRelationship: formData.get("nomineeRelationship"),
    nomineePhone: formData.get("nomineePhone"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? "Please check the details and try again.",
      field: first?.path[0]?.toString(),
    };
  }

  // The schema's job ends at "12 valid digits" — never let that plaintext
  // reach `.values()` below. Everything from here on refers only to the
  // encrypted form and the blind index.
  const { aadhaar, ...applicationValues } = parsed.data;
  const aadhaarHash = blindIndex(aadhaar);
  const aadhaarFields = {
    aadhaarEnc: encryptPii(aadhaar),
    aadhaarHash,
    aadhaarLast4: aadhaar.slice(-4),
  };

  // One Aadhaar, one member. Self-resubmission (the member's own existing row)
  // is not a conflict.
  const [aadhaarConflict] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.aadhaarHash, aadhaarHash),
        ne(members.id, session.memberId),
        isNull(members.deletedAt),
      ),
    )
    .limit(1);

  if (aadhaarConflict) {
    return { ok: false, error: "aadhaar_taken", field: "aadhaar" };
  }

  // Photo is required on a first submission; fixing a rejected application,
  // the member may keep the one already on file rather than re-picking it.
  const file = formData.get("photo");
  const hasNewPhoto = file instanceof File && file.size > 0;
  const existingPhotoKey = latestApplication?.photoKey ?? null;

  if (!hasNewPhoto && !existingPhotoKey) {
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

  // Supersede the rejected application being fixed. `latestApplication` can
  // only be null or rejected here — pending and approved already returned
  // above.
  if (latestApplication) {
    await db
      .update(memberApplications)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(eq(memberApplications.id, latestApplication.id));
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
          ...applicationValues,
          ...aadhaarFields,
          // Carried over when the member kept their existing photo.
          photoKey: hasNewPhoto ? null : existingPhotoKey,
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
    // Only ever a pending upload: an application reopened after approval
    // points at the member's live photo, which must survive a resubmit.
    if (
      existingPhotoKey &&
      existingPhotoKey !== key &&
      isPendingPhotoKey(existingPhotoKey)
    ) {
      await r2
        .send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET,
            Key: existingPhotoKey,
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
