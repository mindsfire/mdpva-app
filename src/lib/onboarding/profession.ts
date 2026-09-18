/**
 * Narrows the nullable DB enum to the form's union, which uses "" for unset.
 *
 * `drone_operator` is excluded on purpose: it's no longer offered on the
 * public form, so a member whose existing application has it sees the field
 * as unset and must pick one of the current options — same as if they'd
 * never chosen one.
 */
export function isoToDisplayableProfession(
  value: string | null,
): "" | "photographer" | "videographer" | "photo_and_video" | "other" {
  return value === "photographer" ||
    value === "videographer" ||
    value === "photo_and_video" ||
    value === "other"
    ? value
    : "";
}
