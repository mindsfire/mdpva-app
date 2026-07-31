/**
 * Backfill `notes` onto members imported before the coerceRow fix.
 *
 * `coerceRow` declared `notes` in CSV_HEADERS but never mapped it, so the first
 * ledger import wrote 1307 members with a null notes column and lost the
 * parentage lines, alternate phone numbers, aliases and ledger-conflict
 * warnings the extractor had put there.
 *
 * Matches on legacy_id. The two duplicate-ledger members have no legacy_id, so
 * they are matched on first_name + phone, which is unique for them.
 *
 *   npx tsx scripts/ledger/backfill-notes.ts .local/ledger/out/members.csv
 *   npx tsx scripts/ledger/backfill-notes.ts .local/ledger/out/members.csv --write
 *
 * Only ever fills a null notes column — never overwrites a note an admin wrote.
 */
import { readFileSync } from "node:fs";

import { isNull, sql } from "drizzle-orm";

import { db } from "../../src/db";
import { members } from "../../src/db/schema";
import { parseMembersCsv } from "../../src/lib/csv/member-csv";

const path = process.argv[2] ?? ".local/ledger/out/members.csv";
const write = process.argv.includes("--write");

async function main() {
  const parsed = parseMembersCsv(readFileSync(path, "utf8"));
  if (parsed.errors.length > 0) {
    throw new Error(`CSV has ${parsed.errors.length} validation errors.`);
  }

  const withNotes = parsed.rows.filter((r) => r.input.notes);
  console.log(`rows with notes in CSV: ${withNotes.length} of ${parsed.rows.length}`);

  // One read, matched in memory: a per-row lookup is ~680 round trips over
  // Neon's HTTP driver, which takes minutes.
  const all = await db
    .select({
      id: members.id,
      legacyId: members.legacyId,
      firstName: members.firstName,
      phone: members.phone,
      notes: members.notes,
    })
    .from(members)
    .where(isNull(members.deletedAt));

  const byLegacyId = new Map(
    all.flatMap((m) => (m.legacyId ? [[m.legacyId, m] as const] : [])),
  );
  // The duplicate-ledger members have no legacy_id; name + phone is unique.
  const byNamePhone = new Map(
    all
      .filter((m) => !m.legacyId)
      .map((m) => [`${m.firstName}|${m.phone ?? ""}`, m] as const),
  );

  let updated = 0;
  let unmatched = 0;
  let alreadySet = 0;
  const updates: { id: string; notes: string }[] = [];

  for (const { input } of withNotes) {
    const match = input.legacyId
      ? byLegacyId.get(input.legacyId)
      : byNamePhone.get(`${input.firstName}|${input.phone ?? ""}`);

    if (!match) {
      unmatched += 1;
      console.warn(`  no match for ${input.legacyId ?? input.firstName} — skipped`);
      continue;
    }
    if (match.notes) {
      alreadySet += 1;
      continue;
    }
    updates.push({ id: match.id, notes: input.notes! });
    updated += 1;
  }

  if (write && updates.length > 0) {
    // Single statement per batch via a VALUES join, rather than one UPDATE
    // per member.
    const BATCH = 200;
    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH);
      const values = sql.join(
        slice.map((u) => sql`(${u.id}::uuid, ${u.notes}::text)`),
        sql`, `,
      );
      await db.execute(sql`
        update members set notes = v.notes, updated_at = now()
        from (values ${values}) as v(id, notes)
        where members.id = v.id and members.notes is null`);
      console.log(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
    }
  }

  console.log(`\n${write ? "UPDATED" : "would update"}: ${updated}`);
  console.log(`already had notes (left alone): ${alreadySet}`);
  console.log(`unmatched: ${unmatched}`);

  const after = await db
    .select({ n: sql<number>`count(notes)::int` })
    .from(members)
    .where(isNull(members.deletedAt));
  console.log(`members with notes now: ${after[0]!.n}`);
  if (!write) console.log("\nDRY RUN — re-run with --write to apply.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
