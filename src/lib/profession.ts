/**
 * The professions a member can hold — the one list every form, filter, label
 * and validator reads from.
 *
 * Deliberately free of any `@/db` import so client components can use it.
 * The Postgres enum still carries a dead `drone_operator` value (see
 * `professionEnum` in schema.ts); it's never offered or accepted, so it is
 * not listed here.
 */
export const PROFESSIONS = [
  "photographer",
  "videographer",
  "photo_and_video",
  "other",
] as const;

export type Profession = (typeof PROFESSIONS)[number];

export const PROFESSION_LABELS: Record<Profession, string> = {
  photographer: "Photographer",
  videographer: "Videographer",
  photo_and_video: "Photo & Video",
  other: "Other",
};

export function isProfession(value: unknown): value is Profession {
  return PROFESSIONS.includes(value as Profession);
}

/**
 * Display text for a stored profession, or `null` when there's nothing to
 * show. `other` shows the member's own description; an unset or retired
 * value reads as unset.
 */
export function professionLabel(
  profession: string | null | undefined,
  professionOther?: string | null,
): string | null {
  if (profession === "other") return professionOther || PROFESSION_LABELS.other;
  return isProfession(profession) ? PROFESSION_LABELS[profession] : null;
}
