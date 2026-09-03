/**
 * Whether the onboarding form may be submitted.
 *
 * Pulled out of `OnboardForm` as a pure function so the "photo is mandatory"
 * rule has a client-side unit test independent of React — the actual server
 * enforcement lives in `onboard-submit.ts` and is what a bypass would still
 * hit, but a member should never get that far without a clear inline reason.
 */
export function canSubmitApplication({
  consented,
  hasPhoto,
}: {
  consented: boolean;
  hasPhoto: boolean;
}): boolean {
  return consented && hasPhoto;
}
