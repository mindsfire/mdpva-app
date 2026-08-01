import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import type { OnboardingProgress } from "@/lib/onboarding/progress-query";
import { cn } from "@/lib/utils";

/**
 * Onboarding progress for the rollout period.
 *
 * A single stacked bar rather than four tiles: the question staff actually ask
 * is "how much is left", which is a proportion, and four separate numbers make
 * that arithmetic the reader's job.
 */
export function OnboardingProgressCard({
  progress,
}: {
  progress: OnboardingProgress;
}) {
  const { totalMembers, approved, pending, notStarted, cannotSelfVerify } =
    progress;
  if (totalMembers === 0) return null;

  const pct = (n: number) => (n / totalMembers) * 100;
  const segments = [
    { key: "approved", label: "Approved", value: approved, className: "bg-mdpva-accent dark:bg-mdpva-gold" },
    { key: "pending", label: "Awaiting review", value: pending, className: "bg-mdpva-gold/60" },
    { key: "notStarted", label: "Not started", value: notStarted, className: "bg-muted-foreground/20" },
    { key: "cannotSelfVerify", label: "Needs office", value: cannotSelfVerify, className: "bg-destructive/35" },
  ].filter((s) => s.value > 0);

  return (
    <section className="rounded-lg border border-mdpva-border bg-mdpva-white p-4 sm:p-5 dark:border-border dark:bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Member onboarding
        </h2>
        <Link
          href="/applications"
          className="group flex items-center gap-1 text-xs text-mdpva-accent hover:underline dark:text-mdpva-gold"
        >
          Review queue
          <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <p className="mt-2 font-serif text-2xl font-medium text-foreground tabular-nums">
        {approved}
        <span className="text-base text-muted-foreground"> of {totalMembers} complete</span>
      </p>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <span
            key={s.key}
            className={cn("h-full", s.className)}
            style={{ width: `${pct(s.value)}%` }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", s.className)} />
            {s.label}
            <b className="font-medium text-foreground tabular-nums">{s.value}</b>
          </li>
        ))}
      </ul>

      {cannotSelfVerify > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {cannotSelfVerify} member{cannotSelfVerify === 1 ? "" : "s"} can&apos;t
          use the form — no membership number or no usable phone on record. They need
          to be handled at the office.
        </p>
      ) : null}
    </section>
  );
}
