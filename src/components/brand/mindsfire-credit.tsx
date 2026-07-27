import Image from "next/image";

import logo from "@/assets/brand/mindsfire-logo.svg";
import { cn } from "@/lib/utils";

/**
 * Build credit for Mindsfire.
 *
 * Uses the mark in its own colours rather than an outlined or monochrome
 * treatment. The logo is three heavily-overlapping stacked bars whose identity
 * *is* the layering — outlining it merges the strokes into an indistinct glyph
 * at credit size (~16px), and flattening it to one colour merges the shapes for
 * the same reason. The colour mark stays legible small, which a credit line
 * needs more than it needs to be visually quiet.
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
      <Image
        src={logo}
        alt=""
        width={16}
        height={16}
        className="shrink-0 rounded-[3px] opacity-80 transition-opacity group-hover:opacity-100"
      />
      <span className="font-medium">
        {compact ? "Mindsfire" : "Mindsfire Private Limited"}
      </span>
    </a>
  );
}
