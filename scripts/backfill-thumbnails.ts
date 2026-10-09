/**
 * Makes the missing thumbnails (`thumbKeyFor`) for photos already in the
 * bucket — everything uploaded before thumbnails existed, plus anything the
 * ledger import wrote.
 *
 *   npx tsx scripts/backfill-thumbnails.ts           # dry run: counts only
 *   npx tsx scripts/backfill-thumbnails.ts --write
 *
 * Targets whatever bucket the R2_* env vars name — .env.local unless they're
 * already set in the environment, which take precedence. It prints the target
 * first; check it before passing --write.
 *
 * Only ever *adds* `*.thumb.webp` objects: no photo is read-modified-written,
 * and photos that already have a thumbnail are skipped, so it is safe to
 * re-run (e.g. once more after deploying, to cover photos uploaded by the old
 * code in between). Until it runs, /api/photos serves full photos for these.
 */
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { env } from "../src/lib/env";
import { makeThumbnail } from "../src/lib/photo-processing";
import { R2_BUCKET, r2, thumbKeyFor } from "../src/lib/r2";

const write = process.argv.includes("--write");
const PREFIXES = ["app/members/", "app/pending/"];

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await r2.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of page.Contents ?? []) if (obj.Key) keys.push(obj.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function main() {
  console.log(`Bucket ${R2_BUCKET} at ${env.R2_ENDPOINT}${write ? "" : " (dry run)"}`);

  for (const prefix of PREFIXES) {
    const keys = await listKeys(prefix);
    const existing = new Set(keys);
    const photos = keys.filter((k) => !k.endsWith(".thumb.webp"));
    const missing = photos.filter((k) => !existing.has(thumbKeyFor(k)));
    console.log(`${prefix}: ${missing.length} of ${photos.length} photos need a thumbnail`);
    if (!write) continue;

    let made = 0;
    let failed = 0;
    for (const key of missing) {
      try {
        const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        const photo = Buffer.from(await object.Body!.transformToByteArray());
        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: thumbKeyFor(key),
            Body: await makeThumbnail(photo),
            ContentType: "image/webp",
          }),
        );
        made++;
        if (made % 50 === 0) console.log(`  ${made} made…`);
      } catch (err) {
        failed++;
        console.error(`  ${key}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`  ${made} made, ${failed} failed`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
