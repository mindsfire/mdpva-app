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
/**
 * Ceiling for the drawer. Generous because the directory is full-width on a
 * wide monitor: at 2560px the container leaves well over 1500px spare, and
 * capping at 900 left the space unused. `MIN_TABLE_WIDTH` still guarantees
 * the table its share, so this only binds on genuinely large screens.
 */
export const PEEK_MAX_WIDTH = 1400;
export const PEEK_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
/**
 * The narrowest the members table may become while the drawer is open.
 * Chosen to keep the sticky name column plus two more columns visible; the
 * remaining columns stay reachable by scrolling, never dropped.
 */
export const MIN_TABLE_WIDTH = 480;
/**
 * The `gap-4` between the table region and the drawer. It sits inside the
 * container too, so the ceiling has to reserve it — otherwise the table
 * settles at `MIN_TABLE_WIDTH − 16` when the drawer is dragged fully open.
 */
export const DRAWER_GAP = 16;

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
      : Math.min(
          PEEK_MAX_WIDTH,
          containerWidth - MIN_TABLE_WIDTH - DRAWER_GAP,
        );
  return Math.max(PEEK_MIN_WIDTH, Math.min(ceiling, Math.round(px)));
}

/** Parses `<number>px` from the cookie into a clamped pixel number. */
export function parsePeekWidthCookie(
  value: string | undefined,
): number | undefined {
  if (!value || !/^\d{2,4}px$/.test(value)) return undefined;
  return clampPeekWidth(Number.parseInt(value, 10));
}
