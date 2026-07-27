import { and, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { memberApplications, members } from "@/db/schema";

export interface OnboardingProgress {
  /** Live members in the directory. */
  totalMembers: number;
  /** Members whose details have been approved through self-service. */
  approved: number;
  /** Waiting on an admin. */
  pending: number;
  /**
   * Members who cannot use the form at all — no ledger number, or no usable
   * phone to verify against. These need the office path, and staff need the
   * count to know how big that job is (spec §3.6/§3.7).
   */
  cannotSelfVerify: number;
  /** Verifiable, but haven't submitted yet — the chase list. */
  notStarted: number;
}

/**
 * Progress for the onboarding push.
 *
 * Exists so staff can answer "how far through are we, and who's left" without
 * exporting a spreadsheet — during a month-long rollout across ~1400 members
 * that question gets asked constantly.
 */
export async function getOnboardingProgress(): Promise<OnboardingProgress> {
  const [memberCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      verifiable: sql<number>`count(*) filter (
        where ${members.legacyId} is not null
          and ${members.normalizedPhone} is not null
      )::int`,
    })
    .from(members)
    .where(isNull(members.deletedAt));

  // Distinct members, not applications: a member who resubmitted has several
  // rows, and counting rows would overstate progress.
  const [appCounts] = await db
    .select({
      approved: sql<number>`count(distinct ${memberApplications.memberId}) filter (
        where ${memberApplications.status} = 'approved'
      )::int`,
      pending: sql<number>`count(distinct ${memberApplications.memberId}) filter (
        where ${memberApplications.status} = 'pending'
      )::int`,
    })
    .from(memberApplications);

  const total = memberCounts?.total ?? 0;
  const verifiable = memberCounts?.verifiable ?? 0;
  const approved = appCounts?.approved ?? 0;
  const pending = appCounts?.pending ?? 0;

  return {
    totalMembers: total,
    approved,
    pending,
    cannotSelfVerify: total - verifiable,
    // Clamped: a member could be approved and later lose their phone value,
    // which would otherwise produce a negative "not started".
    notStarted: Math.max(0, verifiable - approved - pending),
  };
}

/** Members who can't self-verify, for the office follow-up list. */
export async function listCannotSelfVerify(limit = 200) {
  return db
    .select({
      id: members.id,
      memberId: members.memberId,
      legacyId: members.legacyId,
      firstName: members.firstName,
      lastName: members.lastName,
      phone: members.phone,
    })
    .from(members)
    .where(
      and(
        isNull(members.deletedAt),
        sql`(${members.legacyId} is null or ${members.normalizedPhone} is null)`,
      ),
    )
    .limit(limit);
}
