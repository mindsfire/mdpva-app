import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { memberApplications } from "@/db/schema";

/**
 * The member's own most recent application, for showing back to them after
 * verification.
 *
 * Not admin-gated: the caller must already hold the onboarding session cookie,
 * which is scoped to exactly this member row. Returning their own submission is
 * not a disclosure — it's what they typed.
 *
 * `superseded` rows are excluded: they are bookkeeping from a resubmission and
 * showing one would tell a member their details are "awaiting review" when a
 * newer application has replaced it.
 */
export async function getLatestApplicationForMember(memberId: string) {
  const [row] = await db
    .select()
    .from(memberApplications)
    .where(
      and(
        eq(memberApplications.memberId, memberId),
        ne(memberApplications.status, "superseded"),
      ),
    )
    .orderBy(desc(memberApplications.createdAt))
    .limit(1);

  return row ?? null;
}

export type MemberApplication = NonNullable<
  Awaited<ReturnType<typeof getLatestApplicationForMember>>
>;
