import type { Bilingual as BilingualStrings } from "@/lib/onboarding/i18n";
import { cn } from "@/lib/utils";

/**
 * Renders an English label with its Kannada counterpart.
 *
 * Both languages live inside a **single** element, which is the point.
 * Buttons here are `inline-flex; align-items: center`, so an English text node
 * and a separate Kannada `<span>` become two flex items — and flex centres
 * items by *box*, not by baseline. Archivo and Noto Sans Kannada place their
 * baselines differently inside an identically-sized box (Kannada reserves more
 * room above the baseline for vowel signs), so the Kannada visibly floated
 * above the English.
 *
 * Wrapping both in one element makes it a single flex item; the text inside is
 * then ordinary inline content, which browsers align on a shared baseline.
 *
 * Keep them together — splitting them back into siblings reintroduces the
 * misalignment, and it is subtle enough to survive a casual review.
 */
export function Bi({
  s,
  sep,
  className,
  knClassName,
}: {
  s: BilingualStrings;
  /** Separator between the two, e.g. "·" on buttons. Omit for labels. */
  sep?: string;
  className?: string;
  knClassName?: string;
}) {
  return (
    <span className={cn("inline", className)}>
      {s.en}
      {sep ? ` ${sep} ` : " "}
      <span className={cn("font-kn", knClassName)}>{s.kn}</span>
    </span>
  );
}
