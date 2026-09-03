/**
 * Aadhaar (Indian national ID) number validation.
 *
 * A 12-digit number is not enough to trust: any random 12 digits passes a
 * regex. The actual guardrail UIDAI builds into the number is a Verhoeff
 * checksum over the last digit — a check digit that catches typos and
 * transpositions (unlike a simple sum, Verhoeff detects all single-digit
 * errors and all adjacent transpositions). A length/regex-only check would
 * accept large volumes of fabricated numbers.
 *
 * Pure and dependency-free — mirrors phone.ts, so it can be unit tested
 * without touching the crypto/storage layer.
 */

const AADHAAR_LENGTH = 12;

/** UIDAI never issues an Aadhaar starting with 0 or 1. */
const FIRST_DIGIT = /^[2-9]/;

// Verhoeff algorithm tables (standard, from the ISO/IEC 7064 family).
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** True when `digits` (12 chars, already digit-only) passes the Verhoeff check. */
function verhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const digit = Number(reversed[i]);
    c = D[c][P[i % 8][digit]];
  }
  return c === 0;
}

/** Strips spaces/hyphens; returns 12 digits or `null` if that isn't possible. */
export function normalizeAadhaar(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = raw.replace(/[\s-]/g, "");
  if (digits.length !== AADHAAR_LENGTH) return null;
  if (!/^\d+$/.test(digits)) return null;
  return digits;
}

/**
 * `true` only for a 12-digit number, starting 2–9, whose Verhoeff check digit
 * is correct. Accepts loosely-formatted input (spaces/hyphens) via
 * `normalizeAadhaar` first.
 */
export function isValidAadhaar(raw: string | null | undefined): boolean {
  const digits = normalizeAadhaar(raw);
  if (digits === null) return false;
  if (!FIRST_DIGIT.test(digits)) return false;
  return verhoeffValid(digits);
}

/**
 * `"XXXX XXXX 1234"` — for UI display and any log line that must reference an
 * Aadhaar. Never format the full number for display or logs.
 */
export function maskAadhaar(last4: string | null | undefined): string {
  if (!last4 || last4.length !== 4) return "XXXX XXXX XXXX";
  return `XXXX XXXX ${last4}`;
}
