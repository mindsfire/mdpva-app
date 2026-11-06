"use server";

import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { donations } from "@/db/schema";
import { donationSchema, parseAmount } from "@/lib/donations/validation";
import {
  MAX_UPLOAD_BYTES,
  processDonationPhoto,
  sniffImageType,
} from "@/lib/photo-processing";
import { deletePhoto, putPhoto } from "@/lib/photo-store";
import { donationPhotoKeyFor } from "@/lib/r2";
import { requireRole } from "@/lib/rbac";

const DONATIONS_PATH = "/donations";
const NOT_FOUND_ERROR = "This donation no longer exists.";

export interface DonationRow {
  id: string;
  name: string;
  businessName: string | null;
  amount: number;
  photoKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DonationActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; field?: string };

const columns = {
  id: donations.id,
  name: donations.name,
  businessName: donations.businessName,
  amount: donations.amount,
  photoKey: donations.photoKey,
  createdAt: donations.createdAt,
  updatedAt: donations.updatedAt,
};

/** Admin only. Every donation, newest first. */
export async function listDonations(): Promise<DonationRow[]> {
  await requireRole("admin");
  return db.select(columns).from(donations).orderBy(desc(donations.createdAt));
}

/** Admin only. Null for an unknown or malformed id. */
export async function getDonation(id: string): Promise<DonationRow | null> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db
    .select(columns)
    .from(donations)
    .where(eq(donations.id, id));
  return row ?? null;
}

function readFields(formData: FormData) {
  const parsed = donationSchema.safeParse({
    name: formData.get("name") ?? "",
    businessName: formData.get("businessName") ?? "",
    amount: formData.get("amount") ?? "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false as const,
      error: issue.message,
      field: String(issue.path[0]),
    };
  }
  return {
    ok: true as const,
    fields: {
      name: parsed.data.name,
      businessName: parsed.data.businessName || null,
      amount: parseAmount(parsed.data.amount)!,
    },
  };
}

/** Validates an uploaded photo and returns it ready to store. */
async function readPhoto(
  upload: File,
): Promise<{ ok: true; webp: Buffer } | { ok: false; error: string }> {
  if (upload.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That photo is too large. Try a smaller one." };
  }
  const buf = Buffer.from(await upload.arrayBuffer());
  if (!sniffImageType(buf)) {
    return { ok: false, error: "Upload a JPEG, PNG or WebP photo." };
  }
  try {
    return { ok: true, webp: (await processDonationPhoto(buf)).webp };
  } catch {
    return { ok: false, error: "That photo couldn't be read. Try another one." };
  }
}

/** Admin only. Records a donation. The photo is required: the card needs one. */
export async function createDonation(
  formData: FormData,
): Promise<DonationActionResult> {
  const sessionUser = await requireRole("admin");

  const read = readFields(formData);
  if (!read.ok) return read;

  const upload = formData.get("photo");
  if (!(upload instanceof File) || upload.size === 0) {
    return { ok: false, error: "Add the donor's photo.", field: "photo" };
  }
  const photo = await readPhoto(upload);
  if (!photo.ok) return { ...photo, field: "photo" };

  const id = randomUUID();
  const photoKey = donationPhotoKeyFor(id);
  try {
    await putPhoto(photoKey, photo.webp);
  } catch {
    return { ok: false, error: "The photo couldn't be saved. Please try again." };
  }

  try {
    await db.insert(donations).values({
      id,
      ...read.fields,
      photoKey,
      createdBy: sessionUser.id,
    });
  } catch (err) {
    await deletePhoto(photoKey).catch(() => undefined);
    throw err;
  }

  revalidatePath(DONATIONS_PATH);
  return { ok: true, id };
}

/** Admin only. Updates a donation; the photo is replaced only if one is sent. */
export async function updateDonation(
  id: string,
  formData: FormData,
): Promise<DonationActionResult> {
  await requireRole("admin");

  const read = readFields(formData);
  if (!read.ok) return read;

  const existing = await getDonation(id);
  if (!existing) return { ok: false, error: NOT_FOUND_ERROR };

  const upload = formData.get("photo");
  if (upload instanceof File && upload.size > 0) {
    const photo = await readPhoto(upload);
    if (!photo.ok) return { ...photo, field: "photo" };
    try {
      await putPhoto(existing.photoKey, photo.webp);
    } catch {
      return { ok: false, error: "The photo couldn't be saved. Please try again." };
    }
  }

  // `updatedAt` also versions the photo's URL, so a replaced photo shows up.
  await db
    .update(donations)
    .set({ ...read.fields, updatedAt: new Date() })
    .where(eq(donations.id, id));

  revalidatePath(DONATIONS_PATH);
  revalidatePath(`${DONATIONS_PATH}/${id}`);
  return { ok: true, id };
}

/** Admin only. Removes a donation and its photo. */
export async function deleteDonation(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole("admin");

  const existing = await getDonation(id);
  if (!existing) return { ok: false, error: NOT_FOUND_ERROR };

  await db.delete(donations).where(eq(donations.id, id));
  // The row is gone, so a leftover object is only unused storage.
  await deletePhoto(existing.photoKey).catch(() => undefined);

  revalidatePath(DONATIONS_PATH);
  return { ok: true };
}
