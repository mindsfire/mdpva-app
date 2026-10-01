"use client";

import * as React from "react";

const numberFmt = new Intl.NumberFormat("en-IN");

/** Fast start, long gentle settle — the count glides into its final value. */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/**
 * A number that counts up from 0 to `value` on mount.
 *
 * The final value is laid out invisibly underneath, so the number's box is
 * its final width from the first frame — neighbouring text (a tile's hint, a
 * right-aligned count) never shifts while the digits roll. Screen readers get
 * the final value only, and reduced-motion users see it straight away.
 */
export function CountUp({
  value,
  duration = 1400,
  className,
}: {
  value: number;
  /** Milliseconds. */
  duration?: number;
  className?: string;
}) {
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    // Reduced motion lands on the final value in the first frame.
    const total = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : duration;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const progress = total > 0 ? Math.min(1, (now - start) / total) : 1;
      setCurrent(Math.round(easeOutExpo(progress) * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const final = numberFmt.format(value);
  return (
    // Digits right-aligned in the final-width box, so they roll in place
    // like an odometer.
    <span className={`inline-grid justify-items-end tabular-nums ${className ?? ""}`}>
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {final}
      </span>
      <span className="col-start-1 row-start-1" aria-hidden>
        {numberFmt.format(current)}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
