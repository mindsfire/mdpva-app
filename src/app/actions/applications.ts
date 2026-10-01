"use server";

import { revalidatePath } from "next/cache";
import {
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { ApplicationTab } from "@/lib/applications-params";
import { memberApplications, members } from "@/db/schema";
import { isUniqueViolationOn } from "@/lib/db-errors";
import { fullName } from "@/lib/member-name";
import { requireRole } from "@/lib/rbac";
import { isPendingPhotoKey, r2, R2_BUCKET, photoKeyFor } from "@/lib/r2";
import { normalizePhone } from "@/lib/validation/phone";
import { sanitizeText } from "@/lib/validation/text-safety";

const QUEUE_PATH = "/applications";
const MEMBERS_PATH = "/members";
const DASHBOARD_PATH = "/";

export interface ReviewResult {
  ok: boolean;
  error?: string;
}

/**
 * Fields an application may write onto the member record.
 *
 * A blank optional field means "I didn't fill this in", never "delete what you
 * have". The form deliberately prefills only name and phone (so that guessing
 * your way past verification reveals nothing else), which means a member
 * filling it during the ledger migration simply won't retype an address or
 * email they don't remember — and approving that would silently wipe data the
 * office spent months digitising.
 *
 * Consequence: a member cannot clear a field through the form. That's the
 * right trade — a wrong value is fixable by an admin, deleted data is not —
 * and the review screen labels these "kept" so it's visible rather than
 * mysterious.
 */
function applicationToMemberValues(app: typeof memberApplications.$inferSelect) {
  const keepIfBlank = <T>(submitted: T | null): T | undefined =>
    submitted == null ? undefined : submitted;

  return {
    firstName: app.firstName ?? undefined,
    email: keepIfBlank(app.email),
    phone: keepIfBlank(app.phone),
    ...(app.phone ? { normalizedPhone: normalizePhone(app.phone) } : {}),
    profession: keepIfBlank(app.profession),
    professionOther: keepIfBlank(app.professionOther),
    businessName: keepIfBlank(app.businessName),
    addressLine1: app.addressLine1 ?? undefined,
    addressLine2: keepIfBlank(app.addressLine2),
    area: keepIfBlank(app.area),
    city: app.city ?? undefined,
    state: app.state ?? undefined,
    pincode: keepIfBlank(app.pincode),
    dob: keepIfBlank(app.dob),
    bloodGroup: keepIfBlank(app.bloodGroup),
    aadhaarEnc: keepIfBlank(app.aadhaarEnc),
    aadhaarHash: keepIfBlank(app.aadhaarHash),
    aadhaarLast4: keepIfBlank(app.aadhaarLast4),
    nomineeName: keepIfBlank(app.nomineeName),
    nomineeRelationship: keepIfBlank(app.nomineeRelationship),
    nomineePhone: keepIfBlank(app.nomineePhone),
  };
}

/**
 * Admin only. Accepts an application: writes its values onto the member,
 * promotes its photo to the live key, and stamps the reviewer.
 *
 * This is the only path in the entire onboarding feature that writes to
 * `members` — everything before it is staging.
 *
 * Concurrency: the status check lives in the `WHERE` clause, so two admins
 * approving the same application race at the database rather than in
 * application code. The loser updates zero rows and is told it's already
 * reviewed, instead of silently double-applying.
 */
export async function approveApplication(
  applicationId: string,
): Promise<ReviewResult> {
  const sessionUser = await requireRole("admin");

  const [claimed] = await db
    .update(memberApplications)
    .set({
      status: "approved",
      reviewedBy: sessionUser.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(memberApplications.id, applicationId),
        eq(memberApplications.status, "pending"),
      ),
    )
    .returning();

  if (!claimed) {
    return { ok: false, error: "This application has already been reviewed." };
  }

  // Photo first: if this fails we'd rather the member row keep its old photo
  // than point at a key that was never written.
  // Only a pending upload needs promoting. An application reopened after
  // approval can carry the member's live key itself; copying that onto
  // itself and then deleting the "source" would destroy the live photo.
  let livePhotoKey: string | undefined;
  if (claimed.photoKey && isPendingPhotoKey(claimed.photoKey)) {
    livePhotoKey = photoKeyFor(claimed.memberId);
    await r2.send(
      new CopyObjectCommand({
        Bucket: R2_BUCKET,
        CopySource: `${R2_BUCKET}/${claimed.photoKey}`,
        Key: livePhotoKey,
      }),
    );
    // The pending object is kept: an earlier rejected/superseded row of the
    // same member can reference the same key (a resubmit that kept the
    // photo), and those rows still show it to admins.
  }

  try {
    await db
      .update(members)
      .set({
        ...applicationToMemberValues(claimed),
        ...(livePhotoKey ? { photoKey: livePhotoKey } : {}),
        updatedBy: sessionUser.id,
        updatedAt: new Date(),
      })
      .where(eq(members.id, claimed.memberId));
  } catch (err) {
    // Another member was approved with this same Aadhaar first — surfaced to
    // the admin as a review decision, not swallowed. The application stays
    // "approved" (already committed above); the admin resolves the conflict
    // manually rather than the system silently overwriting either record.
    if (isUniqueViolationOn(err, "members_aadhaar_hash_active")) {
      return {
        ok: false,
        error:
          "This Aadhaar number is already on file for another member. Resolve the conflict before approving.",
      };
    }
    throw err;
  }

  if (livePhotoKey) {
    // Repoint the application at the promoted object. Left as-is it would
    // reference the pending key that was just deleted, so reopening an
    // approved application would show a broken image.
    await db
      .update(memberApplications)
      .set({ photoKey: livePhotoKey })
      .where(eq(memberApplications.id, claimed.id));
  }

  revalidatePath(QUEUE_PATH);
  revalidatePath(MEMBERS_PATH);
  revalidatePath(DASHBOARD_PATH);
  return { ok: true };
}

/**
 * Admin only. Rejects with a reason the member sees on the status page —
 * without it they have no idea what to fix, and the only way to find out is
 * to visit the office, which is what this feature exists to avoid.
 */
export async function rejectApplication(
  applicationId: string,
  reason: string,
): Promise<ReviewResult> {
  const sessionUser = await requireRole("admin");

  const cleanReason = sanitizeText(reason).slice(0, 500);
  if (cleanReason.length === 0) {
    return { ok: false, error: "Please give a reason so the member can fix it." };
  }

  const [claimed] = await db
    .update(memberApplications)
    .set({
      status: "rejected",
      rejectionReason: cleanReason,
      reviewedBy: sessionUser.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(memberApplications.id, applicationId),
        eq(memberApplications.status, "pending"),
      ),
    )
    .returning({ id: memberApplications.id });

  if (!claimed) {
    return { ok: false, error: "This application has already been reviewed." };
  }

  // The submitted photo is kept, not deleted: admins need to see what was
  // rejected, and a member fixing the application may keep the same photo.

  revalidatePath(QUEUE_PATH);
  return { ok: true };
}

/**
 * Admin only. Reopens an approved or rejected application for resubmission.
 *
 * `canResubmit` (`src/lib/onboarding/resubmit.ts`) treats "rejected" as the
 * only status that unlocks the onboarding form again — there is no separate
 * "reopened" status — so this reuses that exact mechanism: it re-labels the
 * application "rejected" with the admin's reason, same as a normal reject,
 * just without the `pending`-only guard.
 *
 * Deliberately leaves `members` untouched: an approved application already
 * wrote its values there, and the current directory record stays exactly as
 * it is until the member resubmits and an admin approves the new one. No R2
 * object is touched either — an approved application's photo was already
 * promoted to the member's live key (not this row's to delete), and a
 * rejected one's pending photo was already cleaned up the first time it was
 * rejected.
 */
export async function reopenApplicationForResubmit(
  applicationId: string,
  reason: string,
): Promise<ReviewResult> {
  const sessionUser = await requireRole("admin");

  const cleanReason = sanitizeText(reason).slice(0, 500);
  if (cleanReason.length === 0) {
    return { ok: false, error: "Please give a reason so the member knows what to fix." };
  }

  const [claimed] = await db
    .update(memberApplications)
    .set({
      status: "rejected",
      rejectionReason: cleanReason,
      reviewedBy: sessionUser.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(memberApplications.id, applicationId),
        inArray(memberApplications.status, ["approved", "rejected"]),
      ),
    )
    .returning({ id: memberApplications.id });

  if (!claimed) {
    return { ok: false, error: "This application can't be reopened right now." };
  }

  revalidatePath(QUEUE_PATH);
  revalidatePath(`${QUEUE_PATH}/${applicationId}`);
  return { ok: true };
}

export interface BulkApproveResult {
  ok: boolean;
  approved: number;
  skipped: number;
}

/**
 * Admin only. Approves several at once.
 *
 * Safe specifically because the queue shows a photo thumbnail per row: the
 * admin has already looked at every photo they're approving. Runs
 * sequentially — each approval performs an R2 copy and two writes, and a
 * partial failure should stop rather than leave an unknown subset applied.
 */
export async function bulkApproveApplications(
  ids: string[],
): Promise<BulkApproveResult> {
  await requireRole("admin");
  if (ids.length === 0) return { ok: true, approved: 0, skipped: 0 };

  let approved = 0;
  let skipped = 0;
  for (const id of ids) {
    const result = await approveApplication(id);
    if (result.ok) approved += 1;
    else skipped += 1;
  }
  return { ok: true, approved, skipped };
}

export interface QueueRow {
  id: string;
  applicationNo: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  memberId: string;
  legacyId: string | null;
  memberIdCode: string;
  submittedName: string;
  photoKey: string | null;
  /** The member's live photo; shown for approved rows (see `applicationPhoto`). */
  memberPhotoKey: string | null;
  aadhaarLast4: string | null;
  memberUpdatedAt: Date;
  createdAt: Date;
}

/**
 * Free-text search over what an admin is likely to have in hand when looking
 * for an application: the name, the application number, the ledger number or
 * member ID, a phone number, or the last four digits of the Aadhaar.
 */
function applicationSearchCondition(rawQuery: string | undefined): SQL | null {
  const q = rawQuery?.trim();
  if (!q) return null;
  const term = `%${q}%`;

  const conditions: SQL[] = [
    ilike(memberApplications.firstName, term),
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
    );
  }
  if (/^\d{4}$/.test(q)) {
    conditions.push(eq(memberApplications.aadhaarLast4, q));
  }

  return or(...conditions) ?? null;
}

export interface QueuePage {
  rows: QueueRow[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Admin only. One page of the review queue. Pending is oldest first so
 * nobody waits indefinitely; the other tabs are newest first.
 */
export async function listApplications({
  status,
  q,
  page: requestedPage = 1,
  perPage,
}: {
  status: ApplicationTab;
  q?: string;
  page?: number;
  perPage: number;
}): Promise<QueuePage> {
  await requireRole("admin");

  const where = and(
    eq(memberApplications.status, status),
    applicationSearchCondition(q) ?? undefined,
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(memberApplications)
    .innerJoin(members, eq(members.id, memberApplications.memberId))
    .where(where);
  const total = Number(count);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  // Clamp so a stale or typed-in ?page= past the end shows the last page
  // rather than an empty one.
  const page = Math.min(Math.max(1, requestedPage), totalPages);

  const rows = await db
    .select({
      id: memberApplications.id,
      applicationNo: memberApplications.applicationNo,
      status: memberApplications.status,
      memberId: memberApplications.memberId,
      firstName: memberApplications.firstName,
      photoKey: memberApplications.photoKey,
      aadhaarLast4: memberApplications.aadhaarLast4,
      createdAt: memberApplications.createdAt,
      legacyId: members.legacyId,
      memberIdCode: members.memberId,
      memberUpdatedAt: members.updatedAt,
      memberPhotoKey: members.photoKey,
    })
    .from(memberApplications)
    .innerJoin(members, eq(members.id, memberApplications.memberId))
    .where(where)
    .orderBy(
      status === "pending"
        ? memberApplications.createdAt
        : desc(memberApplications.createdAt),
      // Tie-breaker so rows can't shuffle between pages.
      memberApplications.id,
    )
    .limit(perPage)
    .offset((page - 1) * perPage);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      applicationNo: r.applicationNo,
      status: r.status,
      memberId: r.memberId,
      legacyId: r.legacyId,
      memberIdCode: r.memberIdCode,
      submittedName: fullName(r.firstName) || "—",
      photoKey: r.photoKey,
      aadhaarLast4: r.aadhaarLast4,
      memberUpdatedAt: r.memberUpdatedAt,
      memberPhotoKey: r.memberPhotoKey,
      createdAt: r.createdAt,
    })),
    total,
    page,
    totalPages,
  };
}

/**
 * Admin only. Counts for the queue tabs. With a search, each tab counts only
 * its matches, so the admin can see which tab the person is under.
 */
export async function applicationCounts(
  q?: string,
): Promise<Record<ApplicationTab, number>> {
  await requireRole("admin");
  const rows = await db
    .select({
      status: memberApplications.status,
      count: sql<number>`count(*)`,
    })
    .from(memberApplications)
    .innerJoin(members, eq(members.id, memberApplications.memberId))
    .where(applicationSearchCondition(q) ?? undefined)
    .groupBy(memberApplications.status);

  const out = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) {
    if (r.status in out) {
      out[r.status as keyof typeof out] = Number(r.count);
    }
  }
  return out;
}

/** Admin only. One application plus the member record it would overwrite. */
export async function getApplicationForReview(applicationId: string) {
  await requireRole("admin");

  const [app] = await db
    .select()
    .from(memberApplications)
    .where(eq(memberApplications.id, applicationId))
    .limit(1);
  if (!app) return null;

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, app.memberId))
    .limit(1);
  if (!member) return null;

  return { application: app, member };
}

/** Admin only. Used by the queue's bulk selection. */
export async function listApplicationsByIds(ids: string[]) {
  await requireRole("admin");
  if (ids.length === 0) return [];
  return db
    .select()
    .from(memberApplications)
    .where(inArray(memberApplications.id, ids));
}
