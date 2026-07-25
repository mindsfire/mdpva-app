/**
 * Generates a member-facing ID in the form `MDPVA-YYYY-NNNN`.
 * The sequence portion is zero-padded to at least 4 digits and comes from
 * the `members_seq` Postgres sequence (see scripts/seed.ts / member creation).
 */
export function generateMemberId(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`generateMemberId: invalid year "${year}"`);
  }
  if (!Number.isInteger(seq) || seq <= 0) {
    throw new Error(`generateMemberId: seq must be a positive integer, got "${seq}"`);
  }

  const paddedSeq = String(seq).padStart(4, "0");
  return `MDPVA-${year}-${paddedSeq}`;
}
