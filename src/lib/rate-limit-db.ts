import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

import type { RateLimitStore } from "@/lib/rate-limit";

/** Drizzle-backed `RateLimitStore` — the injectable dependency in production. */
export const dbRateLimitStore: RateLimitStore = {
  async countRecentFailures(field, value, since) {
    const column = field === "email" ? loginAttempts.email : loginAttempts.ip;
    const normalized = field === "email" ? value.toLowerCase() : value;
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(
        and(
          field === "email"
            ? sql`lower(${column}) = ${normalized}`
            : eq(column, normalized),
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, since),
        ),
      );
    return Number(row?.count ?? 0);
  },
  async recordAttempt(email, ip, success) {
    await db.insert(loginAttempts).values({
      email: email ? email.toLowerCase() : null,
      ip,
      success,
    });
  },
};
