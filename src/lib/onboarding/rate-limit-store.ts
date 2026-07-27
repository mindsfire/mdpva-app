import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { applicationAttempts } from "@/db/schema";
import type { RateLimitStore } from "@/lib/rate-limit";

/**
 * `RateLimitStore` over `application_attempts`, reusing the sliding-window
 * logic already proven for login.
 *
 * The store interface names its first bucket "email"; here that slot carries
 * the ledger id. Rather than widen the shared interface for one caller, the
 * mapping is done at this boundary.
 */
export const applicationRateLimitStore: RateLimitStore = {
  async countRecentFailures(field, value, since) {
    const column =
      field === "email" ? applicationAttempts.legacyId : applicationAttempts.ip;
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(applicationAttempts)
      .where(
        and(
          eq(column, value),
          eq(applicationAttempts.success, false),
          gte(applicationAttempts.createdAt, since),
        ),
      );
    return Number(row?.count ?? 0);
  },
  async recordAttempt(legacyId, ip, success) {
    await db.insert(applicationAttempts).values({ legacyId, ip, success });
  },
};
