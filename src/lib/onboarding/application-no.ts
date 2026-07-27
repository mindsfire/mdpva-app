/**
 * Public reference for a submitted application, e.g. `APP-7K4M2X`.
 *
 * Deliberately random, never sequential. A counter would leak how many members
 * have enrolled, and — worse — would be trivially enumerable on the status
 * page, letting anyone walk the list of applications.
 *
 * Alphabet is Crockford base32 minus the ambiguous letters: no I, L, O or U.
 * Members read these over the phone and copy them off a printed sheet, so a
 * character set where 0/O and 1/I/L are distinguishable matters more than the
 * few bits of entropy it costs.
 *
 * 6 characters over a 32-symbol alphabet is ~1.07e9 possibilities, which for a
 * 1400-member association means collisions are effectively impossible — and a
 * unique index catches the theoretical case anyway.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 6;
const PREFIX = "APP-";

export const APPLICATION_NO_PATTERN = new RegExp(
  `^${PREFIX}[${ALPHABET}]{${LENGTH}}$`,
);

/**
 * `randomBytes` is injectable so tests can assert the mapping deterministically
 * rather than merely observing that output looks random.
 */
export function generateApplicationNo(
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes,
): string {
  const bytes = randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i += 1) {
    // Modulo bias across 256 → 32 is nil: 256 is an exact multiple of 32.
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return PREFIX + out;
}

function defaultRandomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}

/**
 * Members transcribe these by hand, so accept the predictable slips —
 * lowercase, missing prefix, and the characters the alphabet deliberately
 * excludes being typed anyway (O for 0, I/L for 1).
 */
export function normalizeApplicationNo(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/^APP[-\s]*/, "")
    .replace(/[\s-]/g, "")
    .replace(/[OQ]/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");

  if (cleaned.length !== LENGTH) return null;
  for (const ch of cleaned) {
    if (!ALPHABET.includes(ch)) return null;
  }
  return PREFIX + cleaned;
}
