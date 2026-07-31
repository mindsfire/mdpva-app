/**
 * Upload the photos recovered from the legacy ledger .docx to R2.
 *
 * Runs AFTER the members CSV has been imported: the R2 key is derived from the
 * member's uuid (`photoKeyFor`), which doesn't exist until the row is inserted.
 * Pairing is by `legacy_id`, which is the ledger number the photo's filename
 * carries — the .docx embeds each photo inside its own table row, so that
 * association comes from the document structure rather than any guesswork.
 *
 *   npx tsx scripts/ledger/import-photos.ts .local/ledger/out          # dry run
 *   npx tsx scripts/ledger/import-photos.ts .local/ledger/out --write
 *
 * Re-runnable: members that already have a photoKey are skipped unless
 * --overwrite is passed, so an interrupted run can simply be repeated.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../src/db";
import { members } from "../../src/db/schema";
import { processLegacyPhoto } from "../../src/lib/photo-processing";
import { R2_BUCKET, photoKeyFor, r2 } from "../../src/lib/r2";

const outDir = process.argv[2] ?? ".local/ledger/out";
const write = process.argv.includes("--write");
const overwrite = process.argv.includes("--overwrite");

async function main() {
  const photoDir = join(outDir, "photos");
  const files = readdirSync(photoDir).filter((f) => !f.startsWith("."));

  // Ledger number -> file. Files suffixed '-dup' belong to a duplicated ledger
  // number and have no unambiguous owner, so they are reported, never uploaded.
  const byLedgerId = new Map<string, string>();
  const unowned: string[] = [];
  for (const file of files) {
    const stem = file.slice(0, file.lastIndexOf("."));
    if (stem.includes("-dup")) {
      unowned.push(file);
      continue;
    }
    byLedgerId.set(stem, file);
  }

  const rows = await db
    .select({
      id: members.id,
      legacyId: members.legacyId,
      photoKey: members.photoKey,
    })
    .from(members)
    .where(isNull(members.deletedAt));

  const memberByLegacyId = new Map(
    rows.flatMap((r) => (r.legacyId ? [[r.legacyId, r] as const] : [])),
  );

  let uploaded = 0;
  let skippedExisting = 0;
  let noMember = 0;
  let failed = 0;

  for (const [legacyId, file] of byLedgerId) {
    const member = memberByLegacyId.get(legacyId);
    if (!member) {
      noMember += 1;
      console.warn(`  no member with legacy_id ${legacyId} (${file})`);
      continue;
    }
    if (member.photoKey && !overwrite) {
      skippedExisting += 1;
      continue;
    }

    try {
      const buf = readFileSync(join(photoDir, file));
      const processed = await processLegacyPhoto(buf);
      const key = photoKeyFor(member.id);

      if (write) {
        await r2.send(
          new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
            Body: processed.webp,
            ContentType: "image/webp",
          }),
        );
        await db
          .update(members)
          .set({ photoKey: key, updatedAt: new Date() })
          .where(and(eq(members.id, member.id), isNull(members.deletedAt)));
      }
      uploaded += 1;
      if (uploaded % 100 === 0) {
        console.log(`  ${uploaded} processed…`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  FAILED ledger ${legacyId} (${file}):`, err);
    }
  }

  console.log(`\n${write ? "UPLOADED" : "DRY RUN — would upload"}: ${uploaded}`);
  console.log(`already had a photo (skipped): ${skippedExisting}`);
  console.log(`no matching member           : ${noMember}`);
  console.log(`failed                       : ${failed}`);
  if (unowned.length > 0) {
    console.log(
      `\nunresolved duplicate-ledger photos (assign by hand): ${unowned.join(", ")}`,
    );
  }
  if (!write) console.log("\nRe-run with --write to apply.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
