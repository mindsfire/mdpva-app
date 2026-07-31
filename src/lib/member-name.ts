/**
 * Joining a member's name for display.
 *
 * `lastName` is nullable — many Kannada names have no separable surname (see
 * `optionalPersonName`). Interpolating it directly leaves a trailing space that
 * shows up in headings, table cells and CSV exports, so every display site goes
 * through here.
 *
 * Deliberately dependency-free so both server and client components can import
 * it (see AGENTS.md on shared modules).
 */
export function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  return [first, last]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ");
}
