import { config } from "dotenv";
import { z } from "zod";

// Next.js already loads .env.local at runtime; this is a no-op there since
// existing process.env values are not overwritten. It's required for
// standalone scripts (drizzle-kit, scripts/seed.ts) run via tsx/node.
config({ path: ".env.local" });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
});

/** What the running app needs. Deploys (e.g. Vercel) set only these. */
export const env = envSchema.parse(process.env);

const seedEnvSchema = z.object({
  SEED_ADMIN1_EMAIL: z.string().email().default("admin1@mdpva.org"),
  SEED_ADMIN1_PASSWORD: z
    .string()
    .min(1, "SEED_ADMIN1_PASSWORD is required (no default — set it explicitly)"),
  SEED_ADMIN2_EMAIL: z.string().email().default("admin2@mdpva.org"),
  SEED_ADMIN2_PASSWORD: z
    .string()
    .min(1, "SEED_ADMIN2_PASSWORD is required (no default — set it explicitly)"),
});

/**
 * Seed-script-only env, validated lazily so the app itself never requires
 * SEED_* vars — call this from scripts/seed.ts, nowhere else. Passwords
 * have no defaults on purpose: seeding must fail loudly without them.
 */
export function seedEnv() {
  return seedEnvSchema.parse(process.env);
}
