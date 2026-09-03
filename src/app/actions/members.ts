"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import { blindIndex, encryptPii } from "@/lib/crypto/pii";
import { mapUniqueViolation } from "@/lib/db-errors";
import { generateMemberId } from "@/lib/member-id";
import { requireRole } from "@/lib/rbac";
import { memberInputSchema, type MemberInput } from "@/lib/validation/member";
import { normalizePhone } from "@/lib/validation/phone";

const DIRECTORY_PATH = "/members";
const DASHBOARD_PATH = "/";

export interface MemberActionSuccess {
  ok: true;
  id: string;
  memberId: string;
}

export interface MemberActionFailure {
  ok: false;
  error: string;
  field?: string;
}

export type MemberActionResult = MemberActionSuccess | MemberActionFailure;

function toValues(input: MemberInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    // Derived on every write so it can never drift from `phone`. Onboarding
    // verification matches on this column; a stale value silently locks a
    // member out of the self-service form.
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
  };
}

/**
 * `aadhaar` is handled separately from `toValues` because blank must mean
 * "leave the stored value alone", not "clear it" — the same convention
 * `applicationToMemberValues` uses for every optional field. Returning `{}`
 * on blank means the caller can spread this directly into `.set()`/`.values()`
 * without an explicit clear.
 */
function aadhaarFields(aadhaar: string | null) {
  if (aadhaar === null) return {};
  return {
    aadhaarEnc: encryptPii(aadhaar),
    aadhaarHash: blindIndex(aadhaar),
    aadhaarLast4: aadhaar.slice(-4),
  };
}

/**
 * Editor+. Validates `input`, generates `member_id` from the
 * `members_seq` Postgres sequence, and inserts the row. Unique-index
 * violations (email/phone/legacy_id already in use) are mapped to a
 * friendly `{ field, error }` instead of a raw Postgres error.
 */
export async function createMember(
  input: MemberInput,
): Promise<MemberActionResult> {
  await requireRole("editor");

  const parsed = memberInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid member details." };
  }

  try {
    const result = await db.execute<{ nextval: string }>(
      sql`select nextval('members_seq') as nextval`,
    );
    const nextval = result.rows[0]?.nextval;
    const memberId = generateMemberId(new Date().getFullYear(), Number(nextval));

    const [inserted] = await db
      .insert(members)
      .values({
        ...toValues(parsed.data),
        ...aadhaarFields(parsed.data.aadhaar),
        memberId,
      })
      .returning({ id: members.id, memberId: members.memberId });

    revalidatePath(DIRECTORY_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, id: inserted.id, memberId: inserted.memberId };
  } catch (err) {
    const mapped = mapUniqueViolation(err);
    if (mapped) {
      return { ok: false, error: mapped.error, field: mapped.field };
    }
    throw err;
  }
}

/**
 * Editor+. Updates an existing member's editable fields and stamps
 * `updated_by` with the acting session user's id.
 */
export async function updateMember(
  id: string,
  input: MemberInput,
): Promise<MemberActionResult> {
  const sessionUser = await requireRole("editor");

  const parsed = memberInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid member details." };
  }

  try {
    const [updated] = await db
      .update(members)
      .set({
        ...toValues(parsed.data),
        ...aadhaarFields(parsed.data.aadhaar),
        updatedBy: sessionUser.id,
        updatedAt: new Date(),
      })
      .where(and(eq(members.id, id), isNull(members.deletedAt)))
      .returning({ id: members.id, memberId: members.memberId });

    if (!updated) {
      return { ok: false, error: "Member not found." };
    }

    revalidatePath(DIRECTORY_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { ok: true, id: updated.id, memberId: updated.memberId };
  } catch (err) {
    const mapped = mapUniqueViolation(err);
    if (mapped) {
      return { ok: false, error: mapped.error, field: mapped.field };
    }
    throw err;
  }
}

export interface SoftDeleteResult {
  ok: boolean;
  error?: string;
}

/** Admin only. Soft-deletes a member by setting `deleted_at`. */
export async function softDeleteMember(id: string): Promise<SoftDeleteResult> {
  await requireRole("admin");

  const [updated] = await db
    .update(members)
    .set({ deletedAt: new Date() })
    .where(and(eq(members.id, id), isNull(members.deletedAt)))
    .returning({ id: members.id });

  if (!updated) {
    return { ok: false, error: "Member not found." };
  }

  revalidatePath(DIRECTORY_PATH);
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

export interface BulkSoftDeleteResult {
  ok: boolean;
  deletedCount: number;
}

/** Admin only. Soft-deletes every non-deleted member id in `ids`. */
export async function bulkSoftDeleteMembers(
  ids: string[],
): Promise<BulkSoftDeleteResult> {
  await requireRole("admin");

  if (ids.length === 0) {
    return { ok: true, deletedCount: 0 };
  }

  const updated = await db
    .update(members)
    .set({ deletedAt: new Date() })
    .where(and(inArray(members.id, ids), isNull(members.deletedAt)))
    .returning({ id: members.id });

  revalidatePath(DIRECTORY_PATH);
  revalidatePath(DASHBOARD_PATH);
  return { ok: true, deletedCount: updated.length };
}

export interface DuplicateMatch {
  id: string;
  firstName: string;
  lastName: string | null;
  memberId: string;
  matchedOn: "email" | "phone" | "legacyId";
}

/**
 * Viewer+. Returns non-deleted members whose email/phone/legacyId matches
 * any of the provided values — used to warn before submitting a duplicate.
 */
export async function checkDuplicates(
  email?: string,
  phone?: string,
  legacyId?: string,
  excludeId?: string,
): Promise<DuplicateMatch[]> {
  await requireRole("viewer");

  const trimmedEmail = email?.trim();
  const trimmedPhone = phone?.trim();
  const trimmedLegacyId = legacyId?.trim();

  if (!trimmedEmail && !trimmedPhone && !trimmedLegacyId) {
    return [];
  }

  const clauses = [];
  if (trimmedEmail) {
    clauses.push(sql`lower(${members.email}) = lower(${trimmedEmail})`);
  }
  if (trimmedPhone) {
    clauses.push(eq(members.phone, trimmedPhone));
  }
  if (trimmedLegacyId) {
    clauses.push(eq(members.legacyId, trimmedLegacyId));
  }

  const rows = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      memberId: members.memberId,
      email: members.email,
      phone: members.phone,
      legacyId: members.legacyId,
    })
    .from(members)
    .where(
      and(
        isNull(members.deletedAt),
        or(...clauses),
        excludeId ? ne(members.id, excludeId) : undefined,
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    memberId: row.memberId,
    matchedOn:
      trimmedEmail && row.email?.toLowerCase() === trimmedEmail.toLowerCase()
        ? "email"
        : trimmedPhone && row.phone === trimmedPhone
          ? "phone"
          : "legacyId",
  }));
}
