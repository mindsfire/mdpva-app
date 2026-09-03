import { PutObjectCommand } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";

import { generateApplicationNo } from "../src/lib/onboarding/application-no";
import { generateMemberId } from "../src/lib/member-id";
import { env, seedEnv } from "../src/lib/env";
import { photoKeyFor, R2_BUCKET, r2 } from "../src/lib/r2";
import { members, memberApplications, users } from "../src/db/schema";

const BCRYPT_COST = 12;

const sqlClient = neon(env.DATABASE_URL);
const db = drizzle(sqlClient, { schema: { users, members, memberApplications } });

async function upsertAdmin(email: string, password: string, name: string) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: "admin",
        status: "active",
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id));
    console.log(`Updated admin: ${email}`);
    return existing[0].id;
  }

  const [inserted] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role: "admin",
      status: "active",
      mustChangePassword: true,
    })
    .returning({ id: users.id });
  console.log(`Created admin: ${email}`);
  return inserted.id;
}

async function nextMemberId(): Promise<string> {
  const rows = (await sqlClient`
    select nextval('members_seq') as nextval
  `) as { nextval: string }[];
  const year = new Date().getFullYear();
  return generateMemberId(year, Number(rows[0].nextval));
}

// "both" deliberately excluded: another in-flight branch has already
// migrated the shared `dev-local` Neon branch's `profession` enum away from
// it (see git branches add-drone-operator-profession /
// feature/drone-operator-profession) — Neon branches are shared per
// environment string, not per git branch, so whichever branch runs
// `db:migrate` last changes the live enum for every branch checked out
// against it. `photographer`/`videographer` are stable across both shapes.
const PROFESSIONS = ["photographer", "videographer"] as const;
const STATUSES = ["active", "inactive", "suspended"] as const;

const DEMO_FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Rohan", "Aisha", "Diya", "Priya", "Ananya", "Meera", "Kavya",
  "Riya", "Sneha", "Pooja", "Neha", "Rahul", "Karan", "Suresh", "Manoj", "Vikram",
];
const DEMO_LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Rao", "Nair", "Reddy", "Gupta", "Kumar",
  "Menon", "Pillai", "Joshi", "Desai", "Patel", "Shetty", "Nayak", "Bhat",
  "Kulkarni", "Chauhan", "Malhotra", "Kapoor", "Bose", "Ghosh", "Naidu", "Rana", "Singh",
];

/**
 * A flat-color placeholder headshot, sized to the real passport geometry —
 * good enough to exercise photo rendering (list thumbnails, drawers, the
 * PDF download) without a real photo of anyone.
 */
async function uploadSyntheticPhoto(key: string, hue: number): Promise<void> {
  const webp = await sharp({
    create: {
      width: 600,
      height: 771,
      channels: 3,
      background: hslToRgb(hue),
    },
  })
    .webp({ quality: 80 })
    .toBuffer();

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: webp,
      ContentType: "image/webp",
    }),
  );
}

function hslToRgb(hue: number): { r: number; g: number; b: number } {
  // Fixed, pleasant saturation/lightness — only hue varies between fixtures.
  const s = 0.45;
  const l = 0.55;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Demo members that also get a synthetic photo uploaded to R2. */
const PHOTO_COUNT = 3;

async function seedDemoMembers(adminId: string): Promise<string[]> {
  const currentYear = new Date().getFullYear();
  const feesStates: (number | null)[] = [
    null, currentYear - 1, currentYear, currentYear + 1,
  ];
  const demoMemberIds: string[] = [];
  let newCount = 0;

  for (let i = 0; i < 25; i++) {
    const memberId = await nextMemberId();
    const firstName = DEMO_FIRST_NAMES[i];
    const lastName = DEMO_LAST_NAMES[i];
    const profession = PROFESSIONS[i % PROFESSIONS.length];
    const status = STATUSES[i % STATUSES.length];
    const feesPaidUpto = feesStates[i % feesStates.length];
    const email = `demo.${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    const phone = `9${String(100000000 + i).padStart(9, "0")}`;

    const [inserted] = await db
      .insert(members)
      .values({
        memberId,
        firstName,
        lastName,
        email,
        phone,
        profession,
        businessName: `${firstName} ${profession === "photographer" ? "Photography" : "Films"}`,
        addressLine1: `${i + 1} MG Road`,
        area: "Central",
        city: "Mangalore",
        state: "Karnataka",
        pincode: "575001",
        status,
        feesPaidUpto: feesPaidUpto ?? undefined,
        deathFundCovered: i % 2 === 0,
        createdBy: adminId,
        updatedBy: adminId,
      })
      .onConflictDoNothing()
      .returning({ id: members.id });

    let memberRowId: string;
    let hasPhoto: boolean;
    if (inserted) {
      newCount += 1;
      memberRowId = inserted.id;
      hasPhoto = false;
    } else {
      // Deterministic demo email already exists from an earlier `--demo`
      // run — reuse that row so downstream fixtures (photos, the demo
      // application) still have something to attach to, instead of
      // silently accumulating unused member_id codes forever.
      const [existing] = await db
        .select({ id: members.id, photoKey: members.photoKey })
        .from(members)
        .where(eq(members.email, email))
        .limit(1);
      if (!existing) continue;
      memberRowId = existing.id;
      hasPhoto = Boolean(existing.photoKey);
    }
    demoMemberIds.push(memberRowId);

    if (i < PHOTO_COUNT && !hasPhoto) {
      const key = photoKeyFor(memberRowId);
      await uploadSyntheticPhoto(key, (i * 137) % 360);
      await db.update(members).set({ photoKey: key }).where(eq(members.id, memberRowId));
    }
  }
  console.log(`Seeded 25 demo members (${newCount} newly inserted, ${demoMemberIds.length} total available for fixtures).`);
  return demoMemberIds;
}

/**
 * One throwaway pending application against a demo member, so the
 * applications review/approve/PDF-download flow has something to click
 * through in local dev without ever touching a real ledger member — see
 * the incident notes in docker-compose.yml for why that matters.
 */
async function seedDemoApplication(demoMemberIds: string[]): Promise<void> {
  if (demoMemberIds.length === 0) return;
  const memberId = demoMemberIds[0]!;

  // Only one pending application per member (schema constraint) — skip if a
  // previous `--demo` run already created one for this member.
  const [existingPending] = await db
    .select({ id: memberApplications.id })
    .from(memberApplications)
    .where(and(eq(memberApplications.memberId, memberId), eq(memberApplications.status, "pending")))
    .limit(1);
  if (existingPending) {
    console.log("Demo pending application already exists — skipping.");
    return;
  }

  const applicationId = crypto.randomUUID();
  const photoKey = `app/pending/${applicationId}.webp`;
  await uploadSyntheticPhoto(photoKey, 210);

  await db
    .insert(memberApplications)
    .values({
      id: applicationId,
      applicationNo: generateApplicationNo(),
      memberId,
      status: "pending",
      firstName: "Aarav",
      lastName: "Sharma",
      phone: "9100000000",
      email: "demo.aarav.sharma@example.com",
      addressLine1: "1 MG Road, near the old post office",
      city: "Mangalore",
      state: "Karnataka",
      profession: "photographer",
      photoKey,
    })
    .onConflictDoNothing();
  console.log("Seeded 1 demo pending application.");
}

async function main() {
  const demo = process.argv.includes("--demo");
  const seeds = seedEnv();

  const admin1Id = await upsertAdmin(
    seeds.SEED_ADMIN1_EMAIL,
    seeds.SEED_ADMIN1_PASSWORD,
    "Admin One",
  );
  await upsertAdmin(seeds.SEED_ADMIN2_EMAIL, seeds.SEED_ADMIN2_PASSWORD, "Admin Two");

  if (demo) {
    const demoMemberIds = await seedDemoMembers(admin1Id);
    await seedDemoApplication(demoMemberIds);
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
