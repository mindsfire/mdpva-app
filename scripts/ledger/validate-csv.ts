/**
 * Validate an extracted ledger CSV against the app's own import rules.
 *
 * Runs the exact `parseMembersCsv` the admin import uses, so problems surface
 * here rather than half-way through a 1300-row write.
 *
 *   npx tsx scripts/ledger/validate-csv.ts .local/ledger/out/members.csv
 */
import { readFileSync } from "node:fs";

import { parseMembersCsv } from "../../src/lib/csv/member-csv";

const path = process.argv[2] ?? ".local/ledger/out/members.csv";
const result = parseMembersCsv(readFileSync(path, "utf8"));

console.log(`rows parsed : ${result.rows.length}`);
console.log(`errors      : ${result.errors.length}`);
if (result.unknownHeaders?.length) {
  console.log(`unknown headers: ${result.unknownHeaders.join(", ")}`);
}

if (result.errors.length > 0) {
  const byField = new Map<string, { count: number; sample: string }>();
  for (const e of result.errors) {
    const entry = byField.get(e.field) ?? { count: 0, sample: e.message };
    entry.count += 1;
    byField.set(e.field, entry);
  }
  console.log("\nerrors by field:");
  for (const [field, { count, sample }] of [...byField].sort(
    (a, b) => b[1].count - a[1].count,
  )) {
    console.log(`  ${String(count).padStart(4)}  ${field}: ${sample}`);
  }
  console.log("\nfirst 15:");
  for (const e of result.errors.slice(0, 15)) {
    console.log(`  row ${e.row} ${e.field}: ${e.message}`);
  }
}

// Duplicate legacy_id would trip the unique index at insert time.
const seen = new Map<string, number>();
const dupes: string[] = [];
for (const r of result.rows) {
  const id = r.input.legacyId;
  if (!id) continue;
  if (seen.has(id)) dupes.push(id);
  else seen.set(id, r.row);
}
console.log(`\nduplicate legacy_ids in CSV: ${dupes.length ? dupes.join(", ") : "none"}`);
console.log(`rows with legacy_id: ${seen.size}`);
