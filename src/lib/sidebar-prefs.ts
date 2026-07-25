/**
 * Shared sidebar preference constants.
 *
 * Deliberately NOT in the "use client" resizer module: a server component
 * importing a value from a client module gets a client-reference proxy
 * rather than the value itself, so `cookies().get(...)` would silently
 * look up the wrong key.
 */
export const SIDEBAR_WIDTH_COOKIE = "sidebar_width";
export const SIDEBAR_STATE_COOKIE = "sidebar_state";
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 340;
export const SIDEBAR_WIDTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Clamped so the sidebar can never be dragged to an unusable width. */
export function clampSidebarWidth(px: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(px)));
}

/** Only accept a plain `<number>px` value from the cookie. */
export function parseSidebarWidthCookie(
  value: string | undefined,
): string | undefined {
  return value && /^\d{2,4}px$/.test(value) ? value : undefined;
}
