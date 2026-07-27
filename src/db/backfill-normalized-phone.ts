/**
 * Populates `members.normalized_phone` from `members.phone`.
 *
 * Re-runnable and idempotent — run it again after each bulk ledger import.
 * (New writes maintain the column themselves; this exists for rows that
 * predate it or arrive via SQL.)
 *
 *   npx tsx src/db/backfill-normalized-phone.ts          # report only
 *   npx tsx src/db/backfill-normalized-phone.ts --write  # apply
 *
 * Defaults to a dry run: the report is the point. Every phone that fails to
 * normalize is a member who *cannot self-verify* on the onboarding form and
 * will need the office path instead, so knowing that count before the rollout
 * is worth more than the update itself.
 */
import { config } from "dotenv";
import { eq, isNull, isNotNull, and } from "drizzle-orm";

config({ path: ".env.local" });

import { db } from "@/db";
import { members } from "@/db/schema";
import { normalizePhone } from "@/lib/validation/phone";

async function main() {
  const write = process.argv.includes("--write");

  const rows = await db
    .select({
      id: members.id,
      memberId: members.memberId,
      legacyId: members.legacyId,
      firstName: members.firstName,
      lastName: members.lastName,
      phone: members.phone,
      normalizedPhone: members.normalizedPhone,
    })
    .from(members)
    .where(and(isNull(members.deletedAt), isNotNull(members.phone)));

  const missingPhone = await db
    .select({ id: members.id })
    .from(members)
    .where(and(isNull(members.deletedAt), isNull(members.phone)));

  const ok: { id: string; normalized: string }[] = [];
  const failed: typeof rows = [];

  for (const row of rows) {
    const normalized = normalizePhone(row.phone);
    if (normalized) {
      ok.push({ id: row.id, normalized });
    } else {
      failed.push(row);
    }
  }

  if (write) {
    let updated = 0;
    for (const { id, normalized } of ok) {
      await db
        .update(members)
        .set({ normalizedPhone: normalized })
        .where(eq(members.id, id));
      updated += 1;
    }
    console.log(`Updated ${updated} rows.`);
  }

  console.log("");
  console.log("─".repeat(58));
  console.log(`  Live members with a phone     ${rows.length}`);
  console.log(`  Normalized successfully       ${ok.length}`);
  console.log(`  Phone present but unusable    ${failed.length}`);
  console.log(`  No phone at all               ${missingPhone.length}`);
  console.log("─".repeat(58));

  const cannotVerify = failed.length + missingPhone.length;
  console.log(
    `\n  ${cannotVerify} member(s) cannot self-verify and need the office path.`,
  );

  if (failed.length > 0) {
    console.log("\n  Unusable phone values (need office follow-up):\n");
    for (const row of failed.slice(0, 50)) {
      const who = `${row.firstName} ${row.lastName}`.trim();
      console.log(
        `    ${(row.legacyId ?? row.memberId).padEnd(18)} ${who.padEnd(28)} ${JSON.stringify(row.phone)}`,
      );
    }
    if (failed.length > 50) {
      console.log(`    …and ${failed.length - 50} more`);
    }
  }

  if (!write) {
    console.log("\n  Dry run — nothing written. Re-run with --write to apply.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
