import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { applicationAttempts } from "@/db/schema";
import type { RateLimitStore } from "@/lib/rate-limit";

/**
 * `RateLimitStore` over `application_attempts`, reusing the sliding-window
 * logic proven for login. The identifier here is the ledger number.
 *
 * Keyed on (ledger number + IP) for blocking, for the same reason as login:
 * counting across all IPs would let anyone lock a specific member out of
 * onboarding with five wrong guesses at their card number.
 */
export const applicationRateLimitStore: RateLimitStore = {
  async countRecentFailures(scope, identifier, ip, since) {
    const where =
      scope === "identifier+ip"
        ? and(
            eq(applicationAttempts.legacyId, identifier),
            eq(applicationAttempts.ip, ip),
          )
        : scope === "ip"
          ? eq(applicationAttempts.ip, ip)
          : eq(applicationAttempts.legacyId, identifier);

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(applicationAttempts)
      .where(
        and(
          where,
          eq(applicationAttempts.success, false),
          gte(applicationAttempts.createdAt, since),
        ),
      );
    return Number(row?.count ?? 0);
  },
  async recordAttempt(identifier, ip, success) {
    await db.insert(applicationAttempts).values({ legacyId: identifier, ip, success });
  },
};
