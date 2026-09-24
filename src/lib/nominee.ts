/**
 * Allowed values for a member's nominee relationship.
 *
 * Stored as these English words rather than codes, so every place that shows
 * the value — the member profile, the application review diff, the PDF and
 * the CSV export — can print it as-is. The public form shows each one with
 * its Kannada label from `NOMINEE_RELATIONSHIP_LABELS_KN`.
 *
 * Client-safe: no `@/db` import, so the onboard form can use it.
 */
export const NOMINEE_RELATIONSHIPS = [
  "Spouse",
  "Son",
  "Daughter",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Other",
] as const;

export type NomineeRelationship = (typeof NOMINEE_RELATIONSHIPS)[number];

/** ⚠️ Unreviewed Kannada, like the rest of `onboarding/i18n.ts`. */
export const NOMINEE_RELATIONSHIP_LABELS_KN: Record<NomineeRelationship, string> = {
  Spouse: "ಪತಿ / ಪತ್ನಿ",
  Son: "ಮಗ",
  Daughter: "ಮಗಳು",
  Father: "ತಂದೆ",
  Mother: "ತಾಯಿ",
  Brother: "ಸಹೋದರ",
  Sister: "ಸಹೋದರಿ",
  Other: "ಇತರೆ",
};

export function isNomineeRelationship(v: unknown): v is NomineeRelationship {
  return NOMINEE_RELATIONSHIPS.includes(v as NomineeRelationship);
}
