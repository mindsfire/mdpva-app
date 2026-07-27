import Image from "next/image";

import logo from "@/assets/brand/mindsfire-logo.svg";
import { cn } from "@/lib/utils";

/**
 * Build credit for Mindsfire.
 *
 * The asset is the bare mark: the source favicon's cream rounded-square plate
 * has been dropped and the viewBox tightened to the artwork's measured bounds
 * (362x157 within the original 512 canvas). A container plate would read as a
 * second, competing badge next to MDPVA's own seal.
 *
 * Uses the mark in its own colours rather than an outlined or monochrome
 * treatment. It's three heavily-overlapping stacked bars whose identity *is*
 * the layering — outlining merges the strokes into an indistinct glyph at this
 * size, and flattening to one colour merges the shapes for the same reason.
 *
 * The source's drop-shadow filter is also stripped: at 16px it produced a
 * pixel-identical render, so it was pure cost.
 *
 * "Powered by" rather than "Developed by": Mindsfire hosts and maintains this
 * app, so it describes an ongoing relationship rather than a one-time handover.
 */
export function MindsfireCredit({
  className,
  /**
   * Drops "Private Limited". The sidebar is user-resizable down to 180px,
   * where the full legal name wraps onto three lines and reads as broken
   * layout rather than a credit. The full name stays on the public footer,
   * which has the width for it.
   */
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <a
      href="https://mindsfire.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground",
        // Compact sits in a sidebar the user can drag to 180px, where even
        // "Powered by Mindsfire" overruns. Allowed to wrap to two tidy lines
        // there; the wide public footer stays on one.
        compact ? "flex-wrap" : "whitespace-nowrap",
        className,
      )}
    >
      <span>Powered by</span>
      {/* 32x14 keeps the mark's true 2.3:1 aspect — it's a wide stacked-bar
          mark, so a square box would letterbox or distort it. */}
      <Image
        src={logo}
        alt=""
        width={32}
        height={14}
        className="shrink-0 opacity-85 transition-opacity group-hover:opacity-100"
      />
      <span className="font-medium">
        {compact ? "Mindsfire" : "Mindsfire Private Limited"}
      </span>
    </a>
  );
}
