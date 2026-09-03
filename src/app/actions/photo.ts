"use server";

import { revalidatePath } from "next/cache";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { eq, isNull, and } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { requireRole } from "@/lib/rbac";
import { r2, R2_BUCKET, photoKeyFor } from "@/lib/r2";
import { MAX_UPLOAD_BYTES, processPhoto, sniffImageType } from "@/lib/photo-processing";

export interface PhotoActionResult {
  ok: boolean;
  photoKey?: string | null;
  error?: string;
}

/**
 * Editor+. Replaces a member's photo: validates the upload server-side
 * (size cap, magic-byte sniff, real decode), re-encodes to WebP capped at
 * 1200px, and writes it to a fixed per-member key — so storage never grows
 * per re-upload and a stale object is never left behind.
 */
export async function uploadMemberPhoto(
  memberId: string,
  formData: FormData,
): Promise<PhotoActionResult> {
  await requireRole("editor");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file provided." };
  }
  if (file.size === 0) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image is too large — 8 MB maximum." };
  }

  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), isNull(members.deletedAt)));
  if (!member) {
    return { ok: false, error: "Member not found." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffImageType(buf)) {
    return { ok: false, error: "That doesn't look like a JPEG, PNG, or WebP image." };
  }

  let processed;
  try {
    processed = await processPhoto(buf);
  } catch {
    return { ok: false, error: "Could not process that image — try a different file." };
  }

  const key = photoKeyFor(memberId);
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: processed.webp,
      ContentType: "image/webp",
      CacheControl: "private, max-age=3600",
    }),
  );

  await db
    .update(members)
    .set({ photoKey: key, updatedAt: new Date() })
    .where(eq(members.id, memberId));

  revalidatePath("/members");
  revalidatePath("/");
  return { ok: true, photoKey: key };
}

/** Editor+. Removes a member's photo from R2 and clears `photo_key`. */
export async function removeMemberPhoto(memberId: string): Promise<PhotoActionResult> {
  await requireRole("editor");

  const [member] = await db
    .select({ id: members.id, photoKey: members.photoKey })
    .from(members)
    .where(and(eq(members.id, memberId), isNull(members.deletedAt)));
  if (!member) {
    return { ok: false, error: "Member not found." };
  }
  if (!member.photoKey) {
    return { ok: true, photoKey: null };
  }

  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: member.photoKey }));
  await db.update(members).set({ photoKey: null }).where(eq(members.id, memberId));

  revalidatePath("/members");
  revalidatePath("/");
  return { ok: true, photoKey: null };
}
