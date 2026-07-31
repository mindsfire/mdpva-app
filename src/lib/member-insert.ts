import { sql } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { generateMemberId } from "@/lib/member-id";
import { type MemberInput } from "@/lib/validation/member";
import { normalizePhone } from "@/lib/validation/phone";

export const INSERT_CHUNK = 100;

/**
 * Insert validated members with sequence-generated member IDs.
 *
 * Extracted from `commitImport` so the one-shot legacy-ledger CLI writes rows
 * through exactly this code rather than its own copy. The duplication risk is
 * not hypothetical: `normalizedPhone` is derived here, and onboarding
 * verification matches on that column, so a second implementation that forgot
 * it would leave every imported member unable to use the self-service form.
 *
 * Callers are responsible for validation, duplicate checks and authorization —
 * this is the write step only, and deliberately holds no session or
 * Next-specific imports so a script can call it.
 */
export async function insertValidatedMembers(
  validated: MemberInput[],
  userId: string | null,
): Promise<number> {
  if (validated.length === 0) return 0;

  const year = new Date().getFullYear();
  const seq = await db.execute<{ nextval: string }>(
    sql`select nextval('members_seq') as nextval from generate_series(1, ${validated.length})`,
  );
  const memberIds = seq.rows.map((r) => generateMemberId(year, Number(r.nextval)));

  let inserted = 0;
  for (let i = 0; i < validated.length; i += INSERT_CHUNK) {
    const chunk = validated.slice(i, i + INSERT_CHUNK).map((input, j) => ({
      memberId: memberIds[i + j],
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      // Derived here too: this is the path the scanned ledger arrives through,
      // and onboarding verification matches on this column. Missing it would
      // leave every imported member unable to use the self-service form.
      normalizedPhone: normalizePhone(input.phone),
      profession: input.profession,
      businessName: input.businessName,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      area: input.area,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      dob: input.dob,
      bloodGroup: input.bloodGroup,
      status: input.status,
      feesPaidUpto: input.feesPaidUpto,
      deathFundCovered: input.deathFundCovered,
      notes: input.notes,
      legacyId: input.legacyId,
      createdBy: userId,
      updatedBy: userId,
    }));
    await db.insert(members).values(chunk);
    inserted += chunk.length;
  }
  return inserted;
}
