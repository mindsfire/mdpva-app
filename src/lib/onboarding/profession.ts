/** Narrows the nullable DB enum to the form's union, which uses "" for unset. */
export function isoToDisplayableProfession(
  value: string | null,
): "" | "photographer" | "videographer" | "both" | "drone_operator" {
  return value === "photographer" ||
    value === "videographer" ||
    value === "both" ||
    value === "drone_operator"
    ? value
    : "";
}
