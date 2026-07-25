import { config } from "dotenv";
import { z } from "zod";

// Next.js already loads .env.local at runtime; this is a no-op there since
// existing process.env values are not overwritten. It's required for
// standalone scripts (drizzle-kit, scripts/seed.ts) run via tsx/node.
config({ path: ".env.local" });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SEED_ADMIN1_EMAIL: z.string().email().default("admin1@mdpva.org"),
  SEED_ADMIN1_PASSWORD: z.string().min(1).default("ChangeMe@Admin1"),
  SEED_ADMIN2_EMAIL: z.string().email().default("admin2@mdpva.org"),
  SEED_ADMIN2_PASSWORD: z.string().min(1).default("ChangeMe@Admin2"),
});

export const env = envSchema.parse(process.env);
