"use client";

import * as React from "react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  clampSidebarWidth,
  SIDEBAR_WIDTH_COOKIE,
  SIDEBAR_WIDTH_COOKIE_MAX_AGE,
} from "@/lib/sidebar-prefs";

/**
 * Drag handle on the sidebar's trailing edge. The sidebar container is
 * `fixed` at the viewport's left edge, so the pointer's clientX *is* the
 * desired width. Writes `--sidebar-width` straight to the wrapper element
 * during the drag (bypassing React so the edge tracks the pointer without
 * re-render churn) and persists the final width to a cookie, which the
 * server layout reads back so there's no resize flash on the next load.
 */
export function SidebarResizer() {
  const { state, isMobile } = useSidebar();
  const [dragging, setDragging] = React.useState(false);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const wrapper = event.currentTarget.closest<HTMLElement>(
        '[data-slot="sidebar-wrapper"]',
      );
      const container = event.currentTarget.closest<HTMLElement>(
        '[data-slot="sidebar-container"]',
      );
      if (!wrapper || !container) return;

      setDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      // Seed with the current width so a click without movement is a no-op.
      let width = clampSidebarWidth(container.getBoundingClientRect().width);

      function onMove(moveEvent: PointerEvent) {
        width = clampSidebarWidth(moveEvent.clientX);
        wrapper!.style.setProperty("--sidebar-width", `${width}px`);
      }

      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setDragging(false);
        document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${width}px; path=/; max-age=${SIDEBAR_WIDTH_COOKIE_MAX_AGE}; SameSite=Lax`;
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [],
  );

  function reset(event: React.MouseEvent<HTMLDivElement>) {
    const wrapper = event.currentTarget.closest<HTMLElement>(
      '[data-slot="sidebar-wrapper"]',
    );
    wrapper?.style.removeProperty("--sidebar-width");
    document.cookie = `${SIDEBAR_WIDTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }

  // Nothing to resize when collapsed to icons or in the mobile drawer.
  if (isMobile || state === "collapsed") return null;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={onPointerDown}
      onDoubleClick={reset}
      title="Drag to resize · double-click to reset"
      className={cn(
        "absolute inset-y-0 right-0 z-30 hidden w-1.5 translate-x-1/2 cursor-col-resize touch-none md:block",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors",
        "hover:after:bg-mdpva-accent/50 dark:hover:after:bg-mdpva-gold/50",
        dragging && "after:bg-mdpva-accent/70 dark:after:bg-mdpva-gold/70",
      )}
    />
  );
}
