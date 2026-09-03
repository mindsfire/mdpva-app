/** Narrows the nullable DB enum to the form's union, which uses "" for unset. */
export function isoToDisplayableProfession(
  value: string | null,
): "" | "photographer" | "videographer" | "photo_and_video" | "drone_operator" {
  return value === "photographer" ||
    value === "videographer" ||
    value === "photo_and_video" ||
    value === "drone_operator"
    ? value
    : "";
}
