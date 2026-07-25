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
export type ProfessionFilter = "photographer" | "videographer" | "both";

/**
 * `name` (last_name asc, default) / `name_desc` (last_name desc) / `newest`
 * (created_at desc).
 */
export type MembersSort = "name" | "name_desc" | "newest";

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
