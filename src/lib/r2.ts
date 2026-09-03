import { S3Client } from "@aws-sdk/client-s3";

import { env } from "@/lib/env";

/**
 * R2 is S3-compatible; `region: "auto"` is what Cloudflare's docs specify
 * for the S3 API endpoint. This client is server-only — never imported
 * from a "use client" file.
 *
 * `forcePathStyle` makes requests use `endpoint/bucket/key` instead of
 * `bucket.endpoint/key`. R2 accepts both, but local dev's MinIO stand-in
 * (see docker-compose.yml) only works path-style — `mdpva-dev.localhost`
 * doesn't resolve without extra DNS setup. Harmless to force on for real R2.
 */
export const r2 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET = env.R2_BUCKET;

/** Every object this app writes lives under this prefix in the shared bucket. */
export function photoKeyFor(memberId: string): string {
  return `app/members/${memberId}.webp`;
}

/**
 * Unapproved member-submitted photos live under a separate prefix.
 *
 * Kept apart from the live namespace so an unreviewed photo can never be
 * served as if it were current — approval copies it across, and only then
 * does it become the member's face in the directory.
 */
export function pendingPhotoKeyFor(applicationId: string): string {
  return `app/pending/${applicationId}.webp`;
}

/** True for keys under the pending prefix; used to gate serving to admins. */
export function isPendingPhotoKey(key: string): boolean {
  return key.startsWith("app/pending/");
}
