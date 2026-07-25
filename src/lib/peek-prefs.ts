/**
 * Member peek-panel width preference.
 *
 * Same rule as `sidebar-prefs`: kept out of the "use client" resizer module
 * so the server layout/page reads the real cookie name rather than a
 * client-reference proxy.
 */
export const PEEK_WIDTH_COOKIE = "member_peek_width";
/** The panel's original fixed width — never allow narrower than this. */
export const PEEK_MIN_WIDTH = 384;
export const PEEK_MAX_WIDTH = 900;
export const PEEK_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function clampPeekWidth(px: number): number {
  return Math.min(PEEK_MAX_WIDTH, Math.max(PEEK_MIN_WIDTH, Math.round(px)));
}

/** Parses `<number>px` from the cookie into a clamped pixel number. */
export function parsePeekWidthCookie(
  value: string | undefined,
): number | undefined {
  if (!value || !/^\d{2,4}px$/.test(value)) return undefined;
  return clampPeekWidth(Number.parseInt(value, 10));
}
