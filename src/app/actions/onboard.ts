"use server";

import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { members } from "@/db/schema";
import {
  checkRateLimit,
  clearFailures,
  recordFailure,
} from "@/lib/rate-limit";
import { applicationRateLimitStore } from "@/lib/onboarding/rate-limit-store";
import {
  clearOnboardSession,
  createOnboardSession,
  createPendingToken,
  readPendingToken,
} from "@/lib/onboarding/session";
import { decideVerification, normalizeLedgerId } from "@/lib/onboarding/verify";
import { normalizePhone } from "@/lib/validation/phone";

export interface VerifyState {
  ok: boolean;
  /** Set only on success — the name to confirm, nothing else. */
  displayName?: string;
  /** Exchanged for a real session by `confirmMemberAction`. */
  pendingToken?: string;
  /** One of the generic i18n keys; never says which half was wrong. */
  error?: "no_match" | "rate_limited";
}

/**
 * Best-effort client IP for rate-limit bucketing. Same caveat as `src/auth.ts`:
 * trusting `x-forwarded-for` is only safe behind a proxy that overwrites it,
 * which Vercel does. The per-ledger-id limit is unaffected by spoofing.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() ?? "unknown";
}

/**
 * Step 1 of onboarding: prove you hold a membership card and the phone on
 * record for it, and receive a cookie scoped to that one member row.
 *
 * Public and unauthenticated by necessity — members have no accounts. What
 * makes that acceptable is that success grants no read access and no write to
 * `members`: it only permits submitting an application for review.
 */
export async function verifyMemberAction(
  rawLedgerId: string,
  rawPhone: string,
): Promise<VerifyState> {
  const ledgerId = normalizeLedgerId(rawLedgerId);
  const phone = normalizePhone(rawPhone);
  const ip = await clientIp();

  // Bucket malformed attempts under a constant so they still count toward the
  // IP limit — otherwise garbage input is a free, unmetered probe.
  const bucket = ledgerId ?? "invalid";

  const limit = await checkRateLimit(bucket, ip, applicationRateLimitStore);
  if (limit.locked) {
    return { ok: false, error: "rate_limited" };
  }

  if (ledgerId === null || phone === null) {
    await recordFailure(bucket, ip, applicationRateLimitStore);
    return { ok: false, error: "no_match" };
  }

  /*
   * Fetch by phone, not by ledger id, then let `decideVerification` require
   * both. Selecting on the *secret* half means a wrong ledger id and a wrong
   * phone follow the same code path and cost the same work — querying by
   * ledger id first would make "this number exists" measurable by timing.
   *
   * Only the four fields the decision needs are selected; the rest of the
   * member row never enters this request.
   */
  const candidates = await db
    .select({
      id: members.id,
      legacyId: members.legacyId,
      normalizedPhone: members.normalizedPhone,
      firstName: members.firstName,
      lastName: members.lastName,
    })
    .from(members)
    .where(
      and(eq(members.normalizedPhone, phone), isNull(members.deletedAt)),
    );

  const outcome = decideVerification(ledgerId, phone, candidates);

  if (!outcome.ok) {
    await recordFailure(bucket, ip, applicationRateLimitStore);
    return { ok: false, error: "no_match" };
  }

  await clearFailures(bucket, ip, applicationRateLimitStore);

  // No cookie yet. The member confirms the name is theirs first — see
  // `confirmMemberAction`.
  const pendingToken = await createPendingToken({
    memberId: outcome.memberId,
    ledgerId,
    displayName: outcome.displayName,
  });

  return { ok: true, displayName: outcome.displayName, pendingToken };
}

/**
 * Ends the onboarding session.
 *
 * Necessary rather than nice-to-have: these forms get filled on shared phones
 * and cyber-café machines, and the cookie is httpOnly, so without this there
 * is no way for a member to hand the device back without leaving a live
 * capability over their record behind.
 */
export async function endOnboardSessionAction(): Promise<void> {
  await clearOnboardSession();
}

/**
 * Step 1b: the member confirmed the name shown is theirs. Only now is the
 * scoped session cookie issued.
 *
 * Splitting this from the lookup is what makes "No, go back" meaningful: a
 * mistyped card number can land on a stranger's record, and backing out must
 * leave no capability behind.
 */
export async function confirmMemberAction(
  pendingToken: string,
): Promise<{ ok: boolean }> {
  const pending = await readPendingToken(pendingToken);
  if (!pending) return { ok: false };

  await createOnboardSession(pending);
  return { ok: true };
}
