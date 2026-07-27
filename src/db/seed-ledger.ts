/**
 * Generates dummy ledger data for testing the onboarding flow end-to-end.
 *
 *   npx tsx src/db/seed-ledger.ts --count 60     # create
 *   npx tsx src/db/seed-ledger.ts --list         # show test credentials
 *   npx tsx src/db/seed-ledger.ts --clean        # remove every seeded row
 *
 * Deliberately messy. A clean 60-row fixture would pass every test and tell
 * you nothing: the interesting cases in this feature are the members who
 * *cannot* self-verify, and the only way to see the "needs office" count, the
 * generic failure copy, and the phone-normalization paths actually working is
 * to have rows that break in the ways a hand-kept ledger really breaks —
 * missing phones, "N/A" scrawled in the phone column, landline numbers,
 * numbers written five different ways, and members never assigned a card
 * number at all.
 *
 * Every row it writes is tagged in `notes` so `--clean` can remove exactly
 * these and never touch real members.
 */
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";

config({ path: ".env.local" });

import { db } from "@/db";
import { members } from "@/db/schema";
import { generateMemberId } from "@/lib/member-id";
import { normalizePhone } from "@/lib/validation/phone";

/** Marker so cleanup is exact. Never used by real records. */
const TAG = "[seed-ledger] demo data — safe to delete";

const FIRST = [
  "Aarav", "Bhavana", "Chetan", "Deepa", "Eshwar", "Ganesh", "Harish",
  "Indira", "Jayanth", "Kavya", "Lakshmi", "Mahesh", "Nagaraj", "Pallavi",
  "Rajesh", "Shwetha", "Suresh", "Tejaswini", "Umesh", "Vinay", "Yashoda",
  "Anitha", "Basavaraj", "Chandrika", "Dinesh", "Girish", "Kiran", "Manjula",
  "Naveen", "Prakash", "Ramesh", "Sandeep", "Shilpa", "Venkatesh", "Vidya",
];

const LAST = [
  "Rao", "Shetty", "Gowda", "Hegde", "Bhat", "Kulkarni", "Nayak", "Patil",
  "Reddy", "Sharma", "Urs", "Iyengar", "Murthy", "Prasad", "Setty",
];

const AREAS = [
  "Devaraja Mohalla", "Lakshmipuram", "Saraswathipuram", "Vijayanagar",
  "Kuvempunagar", "Jayalakshmipuram", "Gokulam", "Nazarbad", "Agrahara",
];

const STUDIOS = [
  "Studio", "Photo Studio", "Colour Lab", "Digital Studio", "Photography",
  "Photo & Video", "Films",
];

/** Deterministic PRNG so repeated runs with the same count are reproducible. */
function makeRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Synthetic but validation-passing mobile numbers. Starts 98, so it clears the
 * 6–9 first-digit rule and the placeholder checks, while the 000 block makes
 * it obvious these are not real people's numbers.
 */
function syntheticPhone(i: number): string {
  return `98${String(400000000 + i * 7919).slice(0, 8)}`;
}

/** The ways one number gets written across a hand-kept ledger. */
function messyFormat(phone: string, variant: number): string {
  switch (variant % 5) {
    case 0:
      return phone;
    case 1:
      return `${phone.slice(0, 5)} ${phone.slice(5)}`;
    case 2:
      return `+91 ${phone}`;
    case 3:
      return `0${phone}`;
    default:
      return `${phone.slice(0, 5)}-${phone.slice(5)}`;
  }
}

/** Values that appear in a phone column but aren't phone numbers. */
const JUNK_PHONES = [
  "N/A",
  "-",
  "not available",
  "0821-2441234", // landline
  "99999",
  "9999999999", // placeholder run
];

interface SeedRow {
  legacyId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  area: string;
  businessName: string | null;
}

function buildRows(count: number): SeedRow[] {
  const rand = makeRandom(20260727);
  const rows: SeedRow[] = [];

  for (let i = 0; i < count; i += 1) {
    const firstName = FIRST[Math.floor(rand() * FIRST.length)]!;
    const lastName = LAST[Math.floor(rand() * LAST.length)]!;
    const area = AREAS[Math.floor(rand() * AREAS.length)]!;
    let legacyId: string | null = String(i + 1);
    let phone: string | null = messyFormat(syntheticPhone(i), i);

    /*
     * Each broken category is assigned deterministically by position rather
     * than sampled, so every failure mode is guaranteed present. A purely
     * probabilistic tail produced zero "no ledger number" rows on the first
     * run, which silently left that path untested — the whole point of this
     * fixture is that the broken rows exist.
     *
     * Proportions roughly mirror what the office described; adjust once the
     * real scan lands.
     */
    if (i % 13 === 4) {
      phone = null; // scanned row with a blank phone column
    } else if (i % 17 === 9) {
      phone = JUNK_PHONES[i % JUNK_PHONES.length]!;
    } else if (i % 23 === 11) {
      legacyId = null; // never assigned, or illegible on the page
    }

    rows.push({
      legacyId,
      firstName,
      lastName,
      phone,
      area,
      businessName:
        rand() < 0.6
          ? `${firstName} ${STUDIOS[Math.floor(rand() * STUDIOS.length)]}`
          : null,
    });
  }
  return rows;
}

async function clean() {
  const deleted = await db
    .delete(members)
    .where(eq(members.notes, TAG))
    .returning({ id: members.id });
  console.log(`Removed ${deleted.length} seeded member(s).`);
}

async function list() {
  const rows = await db
    .select({
      legacyId: members.legacyId,
      firstName: members.firstName,
      lastName: members.lastName,
      phone: members.phone,
      normalizedPhone: members.normalizedPhone,
    })
    .from(members)
    .where(eq(members.notes, TAG));

  const usable = rows.filter((r) => r.legacyId && r.normalizedPhone);
  const blocked = rows.length - usable.length;

  console.log(`\n  ${rows.length} seeded members — ${usable.length} can self-verify, ${blocked} cannot.\n`);
  console.log("  Use any of these at /onboard:\n");
  console.log(`  ${"LEDGER NO.".padEnd(12)}${"PHONE (as written)".padEnd(22)}NAME`);
  console.log(`  ${"-".repeat(60)}`);
  for (const r of usable.slice(0, 15)) {
    console.log(
      `  ${String(r.legacyId).padEnd(12)}${String(r.phone).padEnd(22)}${r.firstName} ${r.lastName}`,
    );
  }
  if (usable.length > 15) console.log(`  …and ${usable.length - 15} more`);
  console.log(
    "\n  Any of the phone spellings above work — they all normalize to the same 10 digits.\n",
  );
}

async function seed(count: number) {
  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(members)
    .where(eq(members.notes, TAG));
  if ((existing[0]?.n ?? 0) > 0) {
    console.log("Seeded data already present. Run with --clean first.");
    return;
  }

  const rows = buildRows(count);
  const seq = await db.execute<{ nextval: string }>(
    sql`select nextval('members_seq') as nextval from generate_series(1, ${rows.length})`,
  );
  const year = new Date().getFullYear();

  await db.insert(members).values(
    rows.map((r, i) => ({
      memberId: generateMemberId(year, Number(seq.rows[i]!.nextval)),
      legacyId: r.legacyId,
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      // Same derivation the app uses on every write, so junk lands as null and
      // those members correctly show up as unable to self-verify.
      normalizedPhone: normalizePhone(r.phone),
      addressLine1: `${100 + i}, ${r.area} Main Road`,
      area: r.area,
      city: "Mysuru",
      state: "Karnataka",
      pincode: "570001",
      businessName: r.businessName,
      status: "active" as const,
      notes: TAG,
    })),
  );

  console.log(`Inserted ${rows.length} seeded members.`);
  await list();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--clean")) return clean();
  if (args.includes("--list")) return list();

  const idx = args.indexOf("--count");
  const count = idx >= 0 ? Number(args[idx + 1]) : 60;
  if (!Number.isInteger(count) || count < 1 || count > 1500) {
    console.error("--count must be between 1 and 1500");
    process.exit(1);
  }
  return seed(count);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
