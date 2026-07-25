import { S3Client } from "@aws-sdk/client-s3";

import { env } from "@/lib/env";

/**
 * R2 is S3-compatible; `region: "auto"` is what Cloudflare's docs specify
 * for the S3 API endpoint. This client is server-only — never imported
 * from a "use client" file.
 */
export const r2 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
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
