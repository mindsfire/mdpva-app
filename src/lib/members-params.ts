/**
 * Pure URL-param helpers for the members directory.
 *
 * Deliberately free of any `@/db` import so client components (pagination,
 * filters) can use these values without dragging the database client — and
 * therefore `dotenv` and the server env schema — into the browser bundle.
 */

import { isProfession, type Profession } from "@/lib/profession";

/** Shared by the members directory and the applications queue. */
export const PER_PAGE_OPTIONS = [100, 200, 500] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];
export const DEFAULT_PER_PAGE: PerPage = 100;

export type MemberStatusFilter = "active" | "inactive" | "suspended";

/** A profession, or `none` for members who have no profession recorded. */
export type ProfessionFilter = Profession | "none";

/** Narrows an untrusted `?profession=`. */
export function parseProfessionFilter(
  value: string | null | undefined,
): ProfessionFilter | undefined {
  return value === "none" || isProfession(value) ? value : undefined;
}

/**
 * Profile gaps the directory can list (`?missing=`), matching the dashboard's
 * profile-completeness card. `city` means a placeholder-looking value ("A",
 * "1") left by the ledger scan, not an empty one — city is required. A
 * missing profession is `?profession=none` instead.
 */
export const MISSING_FILTERS = [
  "photo",
  "phone",
  "dob",
  "nominee",
  "city",
] as const;
export type MissingFilter = (typeof MISSING_FILTERS)[number];

/** Narrows an untrusted `?missing=`. */
export function parseMissing(
  value: string | null | undefined,
): MissingFilter | undefined {
  return MISSING_FILTERS.includes(value as MissingFilter)
    ? (value as MissingFilter)
    : undefined;
}

/**
 * `name` / `name_desc` sort on the displayed full name, `membership` /
 * `membership_desc` on the membership number (ascending is the default), and
 * `newest` on created_at desc. The membership pair is driven by the sortable column
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

/**
 * Applied when there is no `?sort=`. The query, the sort menu and the column
 * headers all read this one value, so the menu and the header arrow always
 * agree with the order the rows actually come back in.
 */
export const DEFAULT_SORT: MembersSort = "membership";

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

/**
 * How many rows the list at `href` will show, given `total` matching rows —
 * read from the destination's `?page=` and `?perPage=`, clamped the way the
 * queries clamp. Sizes a loading skeleton for the page being navigated to;
 * at least 1, so an empty result still draws a row.
 */
export function rowsOnPage(href: string, total: number): number {
  const params = new URL(href, "http://x").searchParams;
  const perPage = parsePerPage(params.get("perPage") ?? undefined);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(parsePage(params.get("page") ?? undefined), totalPages);
  return Math.max(1, Math.min(perPage, total - (page - 1) * perPage));
}
