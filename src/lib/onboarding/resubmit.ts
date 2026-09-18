/**
 * Whether `status` still allows the member to submit again through the
 * public onboarding form.
 *
 * Rejected is the one state that does — that's the whole point of rejecting
 * rather than silently discarding a bad submission. Pending and approved are
 * locked: an admin is either already looking at the pending one, or already
 * accepted it, and a member re-submitting on top of either is exactly the
 * resubmission abuse this gate exists to stop (spam, flooding the queue,
 * quietly overwriting an approved record before anyone reviews it). Fixing
 * either now requires the office, via the admin edit form.
 *
 * Pure and dependency-free, like `decideVerification` in `verify.ts`, so
 * this policy is directly unit-testable.
 */
export function canResubmit(
  status: "pending" | "approved" | "rejected" | "superseded",
): boolean {
  return status === "rejected";
}
