/**
 * Server-only query helpers for the applications queue, shared by the queue
 * (`listApplications`, `applicationCounts`) and the CSV export so "export
 * what I'm looking at" matches the on-screen search exactly.
 *
 * Lives outside `app/actions/applications.ts` because a "use server" module
 * may only export async functions.
 */

import { eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { memberApplications, members } from "@/db/schema";

/**
 * Free-text search over what an admin is likely to have in hand when looking
 * for an application: the name, the application number, the ledger number or
 * member ID, a phone number, or the last four digits of the Aadhaar.
 */
export function applicationSearchCondition(rawQuery: string | undefined): SQL | null {
  const q = rawQuery?.trim();
  if (!q) return null;
  const term = `%${q}%`;

  const conditions: SQL[] = [
    ilike(memberApplications.firstName, term),
    // The member's current name too: after an admin corrects a typo on the
    // member record, the corrected spelling must still find the application.
    ilike(members.firstName, term),
    ilike(memberApplications.applicationNo, term),
    ilike(members.legacyId, term),
    ilike(members.memberId, term),
  ];

  // Phones are stored as typed ("98450 11234", "+91-98450…"), so compare
  // digits to digits — otherwise a space in either one breaks the match.
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3) {
    conditions.push(
      sql`regexp_replace(coalesce(${memberApplications.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}`,
      // The member's number as well — the approved tab shows that one.
      ilike(members.normalizedPhone, `%${digits}%`),
    );
  }
  if (/^\d{4}$/.test(q)) {
    conditions.push(eq(memberApplications.aadhaarLast4, q));
  }

  return or(...conditions) ?? null;
}
