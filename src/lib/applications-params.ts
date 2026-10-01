/**
 * Pure URL-param helpers for the applications queue.
 *
 * Kept free of any `@/db` import for the same reason as `members-params`:
 * the pagination control is a client component. Page sizes are shared with
 * the members directory — see `members-params`.
 */

import { DEFAULT_PER_PAGE } from "./members-params";

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
  if (perPage && perPage !== DEFAULT_PER_PAGE) {
    params.set("perPage", String(perPage));
  }
  return `/applications?${params.toString()}`;
}
