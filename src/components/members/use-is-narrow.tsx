"use client";

import * as React from "react";

/** Matches the Tailwind `lg` breakpoint used to switch to the docked drawer. */
const NARROW_QUERY = "(max-width: 1023.98px)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(NARROW_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/**
 * True below the `lg` breakpoint, where the modal sheet is still used.
 *
 * The server snapshot is `false` deliberately: the drawer is the desktop
 * experience, so rendering nothing on the server means desktop is correct on
 * first paint with no modal flash. Narrow viewports get the sheet one frame
 * after hydration, which is invisible in practice because the member data is
 * already server-rendered.
 */
export function useIsNarrow(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
}
