/**
 * Pure URL-param helpers for the applications queue.
 *
 * Kept free of any `@/db` import for the same reason as `members-params`:
 * the pagination control is a client component.
 */

export const APPLICATION_PER_PAGE_OPTIONS = [100, 200, 500] as const;
export type ApplicationPerPage = (typeof APPLICATION_PER_PAGE_OPTIONS)[number];
export const DEFAULT_APPLICATION_PER_PAGE: ApplicationPerPage = 100;

export type ApplicationTab = "pending" | "approved" | "rejected";
export const APPLICATION_TABS: readonly ApplicationTab[] = [
  "pending",
  "approved",
  "rejected",
] as const;

/** Narrows an untrusted `?status=`; anything unknown falls back to pending. */
export function parseApplicationTab(value: string | undefined): ApplicationTab {
  return APPLICATION_TABS.includes(value as ApplicationTab)
    ? (value as ApplicationTab)
    : "pending";
}

export function parseApplicationPerPage(
  value: string | undefined,
): ApplicationPerPage {
  const n = Number(value);
  return (APPLICATION_PER_PAGE_OPTIONS as readonly number[]).includes(n)
    ? (n as ApplicationPerPage)
    : DEFAULT_APPLICATION_PER_PAGE;
}

/**
 * The tab link for `tab`, carrying over the search and page size but not the
 * page number — page 3 of Pending means nothing on Approved.
 */
export function applicationTabHref(
  tab: ApplicationTab,
  { q, perPage }: { q?: string; perPage?: number },
): string {
  const params = new URLSearchParams({ status: tab });
  if (q) params.set("q", q);
  if (perPage && perPage !== DEFAULT_APPLICATION_PER_PAGE) {
    params.set("perPage", String(perPage));
  }
  return `/applications?${params.toString()}`;
}
