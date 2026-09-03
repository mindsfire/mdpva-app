"use server";

import { revalidatePath } from "next/cache";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { memberApplications, members } from "@/db/schema";
import { isUniqueViolationOn } from "@/lib/db-errors";
import { requireRole } from "@/lib/rbac";
import { r2, R2_BUCKET, photoKeyFor } from "@/lib/r2";
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
    lastName: app.lastName ?? undefined,
    email: keepIfBlank(app.email),
    phone: keepIfBlank(app.phone),
    ...(app.phone ? { normalizedPhone: normalizePhone(app.phone) } : {}),
    profession: keepIfBlank(app.profession),
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
  let livePhotoKey: string | undefined;
  if (claimed.photoKey) {
    livePhotoKey = photoKeyFor(claimed.memberId);
    await r2.send(
      new CopyObjectCommand({
        Bucket: R2_BUCKET,
        CopySource: `${R2_BUCKET}/${claimed.photoKey}`,
        Key: livePhotoKey,
      }),
    );
    await r2
      .send(
        new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: claimed.photoKey }),
      )
      .catch(() => {
        // Leaked pending object; the prefix sweep collects it. Not worth
        // failing an approval over.
      });
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
    .returning({ id: memberApplications.id, photoKey: memberApplications.photoKey });

  if (!claimed) {
    return { ok: false, error: "This application has already been reviewed." };
  }

  if (claimed.photoKey) {
    await r2
      .send(
        new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: claimed.photoKey }),
      )
      .catch(() => {});
  }

  revalidatePath(QUEUE_PATH);
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
  aadhaarLast4: string | null;
  memberUpdatedAt: Date;
  createdAt: Date;
}

/** Admin only. The review queue, oldest first so nobody waits indefinitely. */
export async function listApplications(
  status: "pending" | "approved" | "rejected" | "all" = "pending",
): Promise<QueueRow[]> {
  await requireRole("admin");

  const rows = await db
    .select({
      id: memberApplications.id,
      applicationNo: memberApplications.applicationNo,
      status: memberApplications.status,
      memberId: memberApplications.memberId,
      firstName: memberApplications.firstName,
      lastName: memberApplications.lastName,
      photoKey: memberApplications.photoKey,
      aadhaarLast4: memberApplications.aadhaarLast4,
      createdAt: memberApplications.createdAt,
      legacyId: members.legacyId,
      memberIdCode: members.memberId,
      memberUpdatedAt: members.updatedAt,
    })
    .from(memberApplications)
    .innerJoin(members, eq(members.id, memberApplications.memberId))
    .where(
      status === "all"
        ? undefined
        : eq(memberApplications.status, status),
    )
    .orderBy(
      // Pending oldest-first (fairness); everything else newest-first (recency).
      status === "pending"
        ? memberApplications.createdAt
        : desc(memberApplications.createdAt),
    );

  return rows.map((r) => ({
    id: r.id,
    applicationNo: r.applicationNo,
    status: r.status,
    memberId: r.memberId,
    legacyId: r.legacyId,
    memberIdCode: r.memberIdCode,
    submittedName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "—",
    photoKey: r.photoKey,
    aadhaarLast4: r.aadhaarLast4,
    memberUpdatedAt: r.memberUpdatedAt,
    createdAt: r.createdAt,
  }));
}

/** Admin only. Counts for the queue tabs and the dashboard card. */
export async function applicationCounts(): Promise<
  Record<"pending" | "approved" | "rejected", number>
> {
  await requireRole("admin");
  const rows = await db
    .select({
      status: memberApplications.status,
      count: sql<number>`count(*)`,
    })
    .from(memberApplications)
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
