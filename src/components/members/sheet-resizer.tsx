"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  clampPeekWidth,
  PEEK_COOKIE_MAX_AGE,
  PEEK_MIN_WIDTH,
  PEEK_WIDTH_COOKIE,
} from "@/lib/peek-prefs";

/**
 * Drag handle on the peek sheet's leading (left) edge. The sheet is anchored
 * to the right, so its width is `viewportWidth - clientX`. Only ever widens
 * past the original 384px — dragging narrower is clamped, per the design
 * decision that the default is already the minimum comfortable width.
 */
export function SheetResizer({ panelRef }: { panelRef: React.RefObject<HTMLDivElement | null> }) {
  const [dragging, setDragging] = React.useState(false);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const panel = panelRef.current;
      if (!panel) return;

      setDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      let width = clampPeekWidth(panel.getBoundingClientRect().width);

      function onMove(moveEvent: PointerEvent) {
        width = clampPeekWidth(window.innerWidth - moveEvent.clientX);
        panel!.style.width = `${width}px`;
        panel!.style.maxWidth = `${width}px`;
      }

      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setDragging(false);
        document.cookie = `${PEEK_WIDTH_COOKIE}=${width}px; path=/; max-age=${PEEK_COOKIE_MAX_AGE}; SameSite=Lax`;
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [panelRef],
  );

  function reset() {
    const panel = panelRef.current;
    if (panel) {
      panel.style.width = `${PEEK_MIN_WIDTH}px`;
      panel.style.maxWidth = `${PEEK_MIN_WIDTH}px`;
    }
    document.cookie = `${PEEK_WIDTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      onPointerDown={onPointerDown}
      onDoubleClick={reset}
      title="Drag to widen · double-click to reset"
      className={cn(
        "absolute inset-y-0 left-0 z-50 hidden w-1.5 cursor-col-resize touch-none sm:block",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors",
        "hover:after:bg-mdpva-accent/50 dark:hover:after:bg-mdpva-gold/50",
        dragging && "after:bg-mdpva-accent/70 dark:after:bg-mdpva-gold/70",
      )}
    />
  );
}
