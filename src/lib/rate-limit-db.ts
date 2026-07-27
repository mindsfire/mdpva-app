import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

import type { RateLimitStore } from "@/lib/rate-limit";

/** Drizzle-backed `RateLimitStore` for admin login. */
export const dbRateLimitStore: RateLimitStore = {
  async countRecentFailures(scope, identifier, ip, since) {
    const email = identifier.toLowerCase();

    // `identifier+ip` is the blocking scope, keyed on the pair so a third
    // party cannot lock a real admin out of their own account. Bare
    // `identifier` is observability only — never used to block.
    const where =
      scope === "identifier+ip"
        ? and(
            sql`lower(${loginAttempts.email}) = ${email}`,
            eq(loginAttempts.ip, ip),
          )
        : scope === "ip"
          ? eq(loginAttempts.ip, ip)
          : sql`lower(${loginAttempts.email}) = ${email}`;

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(
        and(
          where,
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, since),
        ),
      );
    return Number(row?.count ?? 0);
  },
  async recordAttempt(identifier, ip, success) {
    await db.insert(loginAttempts).values({
      email: identifier ? identifier.toLowerCase() : null,
      ip,
      success,
    });
  },
};
