/**
 * Seeds throwaway members and mints valid onboard-session cookies for them,
 * so k6 can hit `submitApplicationAction` directly without going through the
 * Turnstile-gated verify step (which cannot be scripted — that's the point
 * of the captcha).
 *
 * Point DATABASE_URL (.env.local) at a disposable Neon branch before running
 * this. It never touches the verify/rate-limit path and only ever writes
 * rows tagged with TAG, so --clean is exact.
 *
 *   npx tsx scripts/loadtest/seed.ts --count 200
 *   npx tsx scripts/loadtest/seed.ts --clean
 *
 * Output: scripts/loadtest/sessions.json — consumed by submit.k6.js.
 */
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { SignJWT } from "jose";

config({ path: ".env.local" });

import { db } from "@/db";
import { members, memberApplications } from "@/db/schema";
import { generateMemberId } from "@/lib/member-id";

const TAG = "[loadtest] disposable — safe to delete";
const ONBOARD_COOKIE = "mdpva_onboard";
const ISSUER = "mdpva/onboard";
const AUDIENCE = "mdpva/onboard-form";
const TTL_SECONDS = 2 * 60 * 60;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set (check .env.local)");
  return new TextEncoder().encode(s);
}

async function signSession(memberId: string, ledgerId: string, displayName: string) {
  return new SignJWT({ memberId, ledgerId, displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
}

/** Verhoeff-valid, UIDAI-shaped (first digit 2-9) fake Aadhaar, unique per index. */
function fakeAadhaar(i: number): string {
  const D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  ];
  const P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
  ];
  const first = String(2 + (i % 8)); // 2-9
  const rest = String(100000000 + i * 37).slice(-10); // 10 more digits
  const body = first + rest; // 11 digits, checksum appended next
  let c = 0;
  const reversed = body.split("").reverse();
  for (let pos = 0; pos < reversed.length; pos += 1) {
    c = D[c]![P[(pos + 1) % 8]![Number(reversed[pos])]!]!;
  }
  // Find the check digit that makes the full 12-digit number valid.
  for (let check = 0; check < 10; check += 1) {
    let total = D[c]![check]!;
    if (total === 0) return body + String(check);
  }
  return body + "0"; // unreachable given the loop above always finds one
}

async function clean() {
  const seeded = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.notes, TAG));
  const ids = seeded.map((m) => m.id);
  if (ids.length > 0) {
    for (const id of ids) {
      await db.delete(memberApplications).where(eq(memberApplications.memberId, id));
    }
  }
  const deleted = await db.delete(members).where(eq(members.notes, TAG)).returning({ id: members.id });
  console.log(`Removed ${deleted.length} seeded member(s) and their applications.`);
}

async function seed(count: number) {
  const existing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(members)
    .where(eq(members.notes, TAG));
  if ((existing[0]?.n ?? 0) > 0) {
    console.log("Loadtest seed already present. Run with --clean first.");
    return;
  }

  const seq = await db.execute<{ nextval: string }>(
    sql`select nextval('members_seq') as nextval from generate_series(1, ${count})`,
  );
  const year = new Date().getFullYear();

  const rows = Array.from({ length: count }, (_, i) => ({
    memberId: generateMemberId(year, Number(seq.rows[i]!.nextval)),
    firstName: "LoadTest",
    lastName: `User${i}`,
    addressLine1: `${100 + i} Test Road`,
    city: "Mysuru",
    state: "Karnataka",
    pincode: "570001",
    status: "active" as const,
    notes: TAG,
  }));

  const inserted = await db.insert(members).values(rows).returning({ id: members.id });

  const sessions = await Promise.all(
    inserted.map(async (m, i) => ({
      memberId: m.id,
      cookie: await signSession(m.id, `LOADTEST-${i}`, `LoadTest User${i}`),
      aadhaar: fakeAadhaar(i),
    })),
  );

  writeFileSync(
    new URL("./sessions.json", import.meta.url),
    JSON.stringify(sessions, null, 2),
  );

  console.log(`Inserted ${inserted.length} members and wrote sessions.json.`);
  console.log(`Sample cookie header: ${ONBOARD_COOKIE}=${sessions[0]!.cookie}`);
}

const args = process.argv.slice(2);
if (args.includes("--clean")) {
  await clean();
} else {
  const idx = args.indexOf("--count");
  const count = idx >= 0 ? Number(args[idx + 1]) : 200;
  await seed(count);
}
process.exit(0);
