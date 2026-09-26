/**
 * A member's display name.
 *
 * Members carry a single full name, stored in `first_name` (the legacy
 * `last_name` column is kept, always NULL, for one release so the change is
 * reversible — see drizzle/0009_full_name.sql). Whitespace is collapsed so a
 * stray double space from an old import never shows up in headings, table
 * cells or CSV exports; every display site goes through here.
 *
 * Deliberately dependency-free so both server and client components can import
 * it (see AGENTS.md on shared modules).
 */
export function fullName(name: string | null | undefined): string {
  return (name ?? "").trim().replace(/\s+/g, " ");
}
