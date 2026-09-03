import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import { generateMemberId } from "../src/lib/member-id";
import { env, seedEnv } from "../src/lib/env";
import { members, users } from "../src/db/schema";

const BCRYPT_COST = 12;

const sqlClient = neon(env.DATABASE_URL);
const db = drizzle(sqlClient, { schema: { users, members } });

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

const PROFESSIONS = [
  "photographer",
  "videographer",
  "photo_and_video",
  "drone_operator",
] as const;
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

async function seedDemoMembers(adminId: string) {
  const currentYear = new Date().getFullYear();
  const feesStates: (number | null)[] = [
    null, currentYear - 1, currentYear, currentYear + 1,
  ];

  for (let i = 0; i < 25; i++) {
    const memberId = await nextMemberId();
    const firstName = DEMO_FIRST_NAMES[i];
    const lastName = DEMO_LAST_NAMES[i];
    const profession = PROFESSIONS[i % PROFESSIONS.length];
    const status = STATUSES[i % STATUSES.length];
    const feesPaidUpto = feesStates[i % feesStates.length];
    const email = `demo.${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    const phone = `9${String(100000000 + i).padStart(9, "0")}`;

    await db
      .insert(members)
      .values({
        memberId,
        firstName,
        lastName,
        email,
        phone,
        profession,
        businessName: `${firstName} ${
          profession === "photo_and_video"
            ? "Studio"
            : profession === "photographer"
              ? "Photography"
              : profession === "drone_operator"
                ? "Aerials"
                : "Films"
        }`,
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
      .onConflictDoNothing();
  }
  console.log("Seeded 25 demo members.");
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
    await seedDemoMembers(admin1Id);
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
