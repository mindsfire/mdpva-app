/**
 * Pure URL-param helpers for the members directory.
 *
 * Deliberately free of any `@/db` import so client components (pagination,
 * filters) can use these values without dragging the database client — and
 * therefore `dotenv` and the server env schema — into the browser bundle.
 */

export const PER_PAGE_OPTIONS = [10, 25, 100] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];
export const DEFAULT_PER_PAGE: PerPage = 10;

export type MemberStatusFilter = "active" | "inactive" | "suspended";
export type ProfessionFilter =
  | "photographer"
  | "videographer"
  | "photo_and_video"
  | "drone_operator";

/**
 * `name` / `name_desc` sort on the displayed full name (the default),
 * `membership` / `membership_desc` on the membership number, and `newest` on
 * created_at desc. The membership pair is driven by the sortable column
 * header in the table as well as the sort menu.
 */
export type MembersSort =
  | "name"
  | "name_desc"
  | "membership"
  | "membership_desc"
  | "newest";

export const MEMBERS_SORTS: readonly MembersSort[] = [
  "name",
  "name_desc",
  "membership",
  "membership_desc",
  "newest",
] as const;

/** Narrows an untrusted `?sort=` value. */
export function parseSort(value: string | undefined): MembersSort | undefined {
  return MEMBERS_SORTS.includes(value as MembersSort)
    ? (value as MembersSort)
    : undefined;
}

export function parsePerPage(value: string | undefined): PerPage {
  const n = Number(value);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n)
    ? (n as PerPage)
    : DEFAULT_PER_PAGE;
}

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
