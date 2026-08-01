"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  clampPeekWidth,
  PEEK_COOKIE_MAX_AGE,
  PEEK_MIN_WIDTH,
  PEEK_WIDTH_COOKIE,
} from "@/lib/peek-prefs";

/**
 * Custom property the docked drawer is sized with. Writing it once during a
 * drag resizes the panel — and so the column left for the table — without a
 * re-render per pointermove.
 */
export const DRAWER_WIDTH_VAR = "--member-drawer-width";

/**
 * Drag handle on the panel's leading (left) edge. The panel is anchored to the
 * right, so its width is `containerRight - clientX` or `viewportWidth - clientX`
 * depending on whether a container is supplied. Only ever widens past the original
 * 384px — dragging narrower is clamped, per the design decision that the default
 * is already the minimum comfortable width.
 */
export function SheetResizer({
  panelRef,
  containerRef,
  varTargetRef,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  /**
   * When supplied, the drag writes `DRAWER_WIDTH_VAR` on this element instead
   * of setting an inline width on the panel — the docked drawer is sized off
   * that variable, and so is the space the table can scroll into. The modal
   * sheet passes nothing and keeps the direct-width behaviour.
   */
  varTargetRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * When supplied, the drawer's maximum width also depends on this element's
   * width, so it can never squeeze the table below `MIN_TABLE_WIDTH`. The
   * modal sheet on mobile passes nothing and keeps the viewport-based ceiling.
   */
  containerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [dragging, setDragging] = React.useState(false);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const panel = panelRef.current;
      if (!panel) return;

      setDragging(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const containerWidth = containerRef?.current?.getBoundingClientRect().width;
      let width = clampPeekWidth(
        panel.getBoundingClientRect().width,
        containerWidth,
      );

      function applyWidth(px: number) {
        const varTarget = varTargetRef?.current;
        if (varTarget) {
          varTarget.style.setProperty(DRAWER_WIDTH_VAR, `${px}px`);
          return;
        }
        panel!.style.width = `${px}px`;
        panel!.style.maxWidth = `${px}px`;
      }

      function onMove(moveEvent: PointerEvent) {
        // The panel is right-anchored, so its width is the distance from the
        // pointer to the container's right edge.
        const right =
          containerRef?.current?.getBoundingClientRect().right ??
          window.innerWidth;
        width = clampPeekWidth(right - moveEvent.clientX, containerWidth);
        applyWidth(width);
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
    [panelRef, containerRef, varTargetRef],
  );

  function reset() {
    const varTarget = varTargetRef?.current;
    if (varTarget) {
      varTarget.style.setProperty(DRAWER_WIDTH_VAR, `${PEEK_MIN_WIDTH}px`);
    } else {
      const panel = panelRef.current;
      if (panel) {
        panel.style.width = `${PEEK_MIN_WIDTH}px`;
        panel.style.maxWidth = `${PEEK_MIN_WIDTH}px`;
      }
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
      title="Drag to resize · double-click to reset"
      className={cn(
        "absolute inset-y-0 z-50 hidden cursor-col-resize touch-none sm:flex sm:items-center sm:justify-center",
        // Docked, the handle lives in the gap between table and drawer so it
        // reads as the seam between two panes rather than a sliver of the
        // panel. The modal sheet keeps it on its own left edge.
        varTargetRef ? "-left-4 w-4" : "left-0 w-1.5",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors",
        "hover:after:bg-mdpva-accent/50 dark:hover:after:bg-mdpva-gold/50",
        dragging && "after:bg-mdpva-accent/70 dark:after:bg-mdpva-gold/70",
      )}
    >
      {/* A grip at the vertical centre: the hairline alone gave no hint that
          the seam was draggable. */}
      {varTargetRef ? (
        <span
          className={cn(
            "relative z-10 flex h-9 w-4 items-center justify-center rounded-full border border-mdpva-border bg-mdpva-white text-muted-foreground transition-colors dark:border-border dark:bg-card",
            "hover:border-mdpva-accent/60 hover:text-foreground dark:hover:border-mdpva-gold/60",
            dragging &&
              "border-mdpva-accent/70 text-foreground dark:border-mdpva-gold/70",
          )}
        >
          <GripVerticalIcon className="size-3" />
        </span>
      ) : null}
    </div>
  );
}
