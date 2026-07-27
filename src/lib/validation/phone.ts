/**
 * Indian mobile number normalization.
 *
 * The scanned ledger holds the same number written a dozen ways —
 * `9845011234`, `+91 98450 11234`, `098450-11234`, `91-9845011234`. Onboarding
 * verification compares a member's typed number against that stored value, so
 * both sides must reduce to one canonical form or real members silently fail to
 * verify.
 *
 * Pure and dependency-free — the comparison logic is security-relevant enough
 * to want direct unit tests over it.
 */

/** Canonical stored form: exactly 10 digits, no country code, no separators. */
export const PHONE_LENGTH = 10;

/** India assigns mobile numbers starting 6–9; 0–5 are landline/service ranges. */
const MOBILE_FIRST_DIGIT = /^[6-9]/;

/**
 * Placeholder junk that appears in hand-kept ledgers where a number was
 * unknown. Accepting these would be a real hole: several members would share
 * `9999999999`, and anyone could verify as any of them.
 */
function isPlaceholder(digits: string): boolean {
  // All one digit — 9999999999, 8888888888.
  if (/^(\d)\1{9}$/.test(digits)) return true;

  // Straight ascending or descending runs — 9876543210, 6789012345.
  // Compared mod 10 so a run that wraps past 9→0 (or 0→9) still counts; a
  // clerk filling a blank writes 6789012345 as readily as 1234567890.
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i += 1) {
    const prev = Number(digits[i - 1]);
    const curr = Number(digits[i]);
    if (curr !== (prev + 1) % 10) ascending = false;
    if (curr !== (prev + 9) % 10) descending = false;
  }
  return ascending || descending;
}

/**
 * Reduces any written form to 10 digits, or returns `null` if it can't be a
 * valid Indian mobile number.
 *
 * Country/trunk prefixes are only stripped when doing so *lands on exactly 10
 * digits* — otherwise a legitimate number that happens to begin with 91 (e.g.
 * 9198765432) would be silently mutilated.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;

  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (digits.length === 13 && digits.startsWith("091")) {
    digits = digits.slice(3);
  }

  if (digits.length !== PHONE_LENGTH) return null;
  if (!MOBILE_FIRST_DIGIT.test(digits)) return null;
  if (isPlaceholder(digits)) return null;

  return digits;
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return normalizePhone(raw) !== null;
}

/**
 * Constant-time-ish equality for the verification check. Both sides are
 * normalized first, so formatting differences never cause a false mismatch.
 *
 * Returns false when either side fails to normalize — a member whose ledger row
 * carries junk cannot self-verify, by design (they visit the office instead).
 */
export function phoneMatches(
  submitted: string | null | undefined,
  stored: string | null | undefined,
): boolean {
  const a = normalizePhone(submitted);
  const b = normalizePhone(stored);
  return a !== null && b !== null && a === b;
}

/** `9845011234` → `98450 11234`, the way Indian numbers are read aloud. */
export function formatPhone(raw: string | null | undefined): string {
  const normalized = normalizePhone(raw);
  if (normalized === null) return raw?.trim() ?? "";
  return `${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}
