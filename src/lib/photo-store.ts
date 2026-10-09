import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { makeThumbnail } from "@/lib/photo-processing";
import { r2, R2_BUCKET, thumbKeyFor } from "@/lib/r2";

/**
 * Photo writes that keep the thumbnail (`thumbKeyFor`) in step with the
 * photo it was made from.
 *
 * The thumbnail is best-effort — `/api/photos` serves the full photo when
 * there isn't one — but it must never be *stale*: a live member photo's key
 * is reused on replacement, so a failed thumbnail write that left the old
 * one in place would show the member's previous face in every list. Each
 * failure path therefore removes the thumbnail rather than keeping it.
 */

/** Writes a photo and its thumbnail. Throws only if the photo itself fails. */
export async function putPhoto(key: string, webp: Buffer): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: webp,
      ContentType: "image/webp",
    }),
  );
  await writeThumbnail(key, webp);
}

/**
 * Copies a photo and its thumbnail to a new key. A source photo uploaded
 * before thumbnails existed has none to copy, so one is made from the photo.
 */
export async function copyPhoto(sourceKey: string, destKey: string): Promise<void> {
  await r2.send(
    new CopyObjectCommand({
      Bucket: R2_BUCKET,
      CopySource: `${R2_BUCKET}/${sourceKey}`,
      Key: destKey,
    }),
  );
  try {
    await r2.send(
      new CopyObjectCommand({
        Bucket: R2_BUCKET,
        CopySource: `${R2_BUCKET}/${thumbKeyFor(sourceKey)}`,
        Key: thumbKeyFor(destKey),
      }),
    );
  } catch {
    let source: Buffer;
    try {
      const object = await r2.send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: sourceKey }),
      );
      source = Buffer.from(await object.Body!.transformToByteArray());
    } catch {
      await deleteQuietly(thumbKeyFor(destKey));
      return;
    }
    await writeThumbnail(destKey, source);
  }
}

/** Deletes a photo and its thumbnail. */
export async function deletePhoto(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  await deleteQuietly(thumbKeyFor(key));
}

async function writeThumbnail(photoKey: string, webp: Buffer): Promise<void> {
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: thumbKeyFor(photoKey),
        Body: await makeThumbnail(webp),
        ContentType: "image/webp",
      }),
    );
  } catch {
    await deleteQuietly(thumbKeyFor(photoKey));
  }
}

async function deleteQuietly(key: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch {
    // Nothing more to do; the photo itself is already in its final state.
  }
}
