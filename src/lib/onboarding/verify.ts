/**
 * Onboarding verification rules.
 *
 * Pure and DB-free so the security-relevant decisions here are directly
 * unit-testable: which submissions are even worth a lookup, and what a caller
 * is allowed to learn from the outcome.
 */

import { normalizePhone } from "@/lib/validation/phone";
import { sanitizeText } from "@/lib/validation/text-safety";

/**
 * Ledger IDs run 1–1400. Accepting a wider range would just add pointless
 * lookups, and accepting non-digits would let someone probe with SQL-ish or
 * unicode payloads even though Drizzle parameterizes.
 */
export const MIN_LEDGER_ID = 1;
export const MAX_LEDGER_ID = 9999;

/**
 * Members write their card number as "417", "0417", "MDPVA/417" or
 * "no. 417". Reduce to the bare integer, then render canonically so the
 * comparison against `legacy_id` is exact.
 *
 * Returns null when there's no plausible ledger number in the input.
 */
export function normalizeLedgerId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = sanitizeText(raw).replace(/\D/g, "");
  if (digits.length === 0) return null;
  const n = Number(digits);
  if (!Number.isInteger(n) || n < MIN_LEDGER_ID || n > MAX_LEDGER_ID) {
    return null;
  }
  return String(n);
}

export type VerifyOutcome =
  | { ok: true; memberId: string; displayName: string }
  | { ok: false; reason: "invalid_input" | "no_match" | "rate_limited" };

export interface VerifiableMember {
  id: string;
  legacyId: string | null;
  normalizedPhone: string | null;
  firstName: string;
  lastName: string;
}

/**
 * Decides an outcome given the candidate rows a lookup returned.
 *
 * Both `legacy_id` and phone must match. Phone is the actual secret — ledger
 * IDs are a small enumerable range — so a row whose stored phone doesn't
 * normalize can never be claimed, by design: that member visits the office
 * instead (spec §3.6/§3.7).
 *
 * Deliberately collapses "no such ledger id" and "wrong phone" into one
 * `no_match`. Distinguishing them would turn the form into an oracle for which
 * membership numbers exist.
 */
export function decideVerification(
  submittedLedgerId: string | null | undefined,
  submittedPhone: string | null | undefined,
  candidates: VerifiableMember[],
): VerifyOutcome {
  const ledgerId = normalizeLedgerId(submittedLedgerId);
  const phone = normalizePhone(submittedPhone);

  if (ledgerId === null || phone === null) {
    return { ok: false, reason: "invalid_input" };
  }

  const match = candidates.find(
    (c) =>
      c.legacyId != null &&
      normalizeLedgerId(c.legacyId) === ledgerId &&
      c.normalizedPhone != null &&
      c.normalizedPhone === phone,
  );

  if (!match) return { ok: false, reason: "no_match" };

  return {
    ok: true,
    memberId: match.id,
    // Name only. Enough for "is this you?", which a member who mistyped their
    // ledger number needs before overwriting a stranger's record — and nothing
    // beyond it, so a lucky guess yields no address, email or fee status.
    displayName: `${match.firstName} ${match.lastName}`.trim(),
  };
}
