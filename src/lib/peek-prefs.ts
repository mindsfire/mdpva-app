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
/**
 * The narrowest the members table may become while the drawer is open.
 * Chosen to keep the sticky name column plus two more columns visible; the
 * remaining columns stay reachable by scrolling, never dropped.
 */
export const MIN_TABLE_WIDTH = 480;

/**
 * Clamp a drawer width to the allowed range.
 *
 * When `containerWidth` is supplied the ceiling also depends on it, so the
 * drawer can never squeeze the table below `MIN_TABLE_WIDTH`. The floor still
 * wins: in a container too narrow to satisfy both, the minimum is returned
 * rather than something unusably small.
 */
export function clampPeekWidth(px: number, containerWidth?: number): number {
  const ceiling =
    containerWidth === undefined
      ? PEEK_MAX_WIDTH
      : Math.min(PEEK_MAX_WIDTH, containerWidth - MIN_TABLE_WIDTH);
  return Math.max(PEEK_MIN_WIDTH, Math.min(ceiling, Math.round(px)));
}

/** Parses `<number>px` from the cookie into a clamped pixel number. */
export function parsePeekWidthCookie(
  value: string | undefined,
): number | undefined {
  if (!value || !/^\d{2,4}px$/.test(value)) return undefined;
  return clampPeekWidth(Number.parseInt(value, 10));
}
