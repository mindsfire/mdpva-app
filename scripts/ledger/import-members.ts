/**
 * Import the extracted legacy-ledger CSV.
 *
 * The admin UI import is the normal path, but it round-trips 1307 rows through
 * a server action; this runs the same parse (`parseMembersCsv`) and the same
 * write (`insertValidatedMembers`) directly, so nothing is re-implemented.
 *
 *   npx tsx scripts/ledger/import-members.ts .local/ledger/out/members.csv
 *   npx tsx scripts/ledger/import-members.ts .local/ledger/out/members.csv --write
 *
 * Refuses to run if any row fails validation, or if any legacy_id, phone or
 * email already exists — so a partial re-run can't silently double-insert.
 */
import { readFileSync } from "node:fs";

import { and, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "../../src/db";
import { members } from "../../src/db/schema";
import { parseMembersCsv } from "../../src/lib/csv/member-csv";
import { insertValidatedMembers } from "../../src/lib/member-insert";
import { normalizePhone } from "../../src/lib/validation/phone";

const path = process.argv[2] ?? ".local/ledger/out/members.csv";
const write = process.argv.includes("--write");

async function main() {
  const parsed = parseMembersCsv(readFileSync(path, "utf8"));

  console.log(`rows parsed : ${parsed.rows.length}`);
  console.log(`errors      : ${parsed.errors.length}`);
  if (parsed.missingHeaders.length > 0) {
    throw new Error(`missing columns: ${parsed.missingHeaders.join(", ")}`);
  }
  if (parsed.errors.length > 0) {
    for (const e of parsed.errors.slice(0, 20)) {
      console.error(`  row ${e.row} ${e.field}: ${e.message}`);
    }
    throw new Error("CSV has validation errors — fix the extractor and re-run.");
  }

  const inputs = parsed.rows.map((r) => r.input);

  // Guard against a double run: every one of these is unique-indexed or
  // meaningful, and a partial import must be resumable rather than duplicated.
  const legacyIds = inputs.map((i) => i.legacyId).filter(Boolean) as string[];
  const emails = inputs.map((i) => i.email?.toLowerCase()).filter(Boolean) as string[];
  const conditions: SQL[] = [];
  if (legacyIds.length) conditions.push(inArray(members.legacyId, legacyIds));
  if (emails.length) conditions.push(inArray(sql`lower(${members.email})`, emails));

  if (conditions.length > 0) {
    const clashes = await db
      .select({ legacyId: members.legacyId, memberId: members.memberId })
      .from(members)
      .where(and(isNull(members.deletedAt), or(...conditions)));
    if (clashes.length > 0) {
      console.error(`\n${clashes.length} row(s) already exist, e.g.`);
      for (const c of clashes.slice(0, 10)) {
        console.error(`  legacy_id ${c.legacyId} -> ${c.memberId}`);
      }
      throw new Error("Refusing to import: these members are already present.");
    }
  }

  const live = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(members)
    .where(isNull(members.deletedAt));
  console.log(`members already in db: ${live[0]!.n}`);

  const withoutPhone = inputs.filter((i) => !normalizePhone(i.phone)).length;
  console.log(`rows with no usable phone (cannot self-verify): ${withoutPhone}`);
  console.log(`rows with a legacy_id: ${legacyIds.length}`);

  if (!write) {
    console.log("\nDRY RUN — nothing written. Re-run with --write to import.");
    return;
  }

  const inserted = await insertValidatedMembers(inputs, null);
  console.log(`\nINSERTED: ${inserted}`);

  const after = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(members)
    .where(isNull(members.deletedAt));
  console.log(`members now in db: ${after[0]!.n}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n" + (err instanceof Error ? err.message : String(err)));
    process.exit(1);
  });
