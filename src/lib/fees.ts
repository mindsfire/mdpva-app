/**
 * Fees are considered paid when `feesPaidUpto` (a year) is greater than or
 * equal to the current year. Membership auto-expires every Jan 1 with zero
 * data churn since this is derived, not stored.
 */
export function isFeesPaid(
  feesPaidUpto: number | null,
  now: Date = new Date(),
): boolean {
  if (feesPaidUpto === null) {
    return false;
  }
  return feesPaidUpto >= now.getFullYear();
}
