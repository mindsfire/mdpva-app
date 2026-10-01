import { Skeleton } from "@/components/ui/skeleton";
import { CardSkeleton } from "@/components/app-shell/page-skeletons";

/**
 * A skeleton bar centred in a box of the real text's line height, so each
 * row is as tall as the text that replaces it rather than the bar.
 */
function Line({ box, className }: { box: string; className: string }) {
  return (
    <div className={`flex items-center ${box}`}>
      <Skeleton className={className} />
    </div>
  );
}

/** Mirrors BarRow: a text-sm label/count line over a 6px bar, py-1. */
function BarRowSkeleton({ labelWidth }: { labelWidth: string }) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex h-5 items-center justify-between gap-2">
        <Skeleton className={`h-3.5 ${labelWidth}`} />
        <Skeleton className="h-3.5 w-16" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  );
}

const PROFESSION_LABEL_WIDTHS = ["w-24", "w-24", "w-24", "w-12", "w-14"];
const COMPLETENESS_LABEL_WIDTHS = ["w-16", "w-20", "w-14", "w-24", "w-12", "w-10"];

/**
 * Matches the dashboard block for block, at each block's real height:
 * breadcrumb, onboarding progress, logo heading, 3 stat tiles, then the
 * profession, completeness and recently-added panels.
 *
 * Like the other loading.tsx files it can't read the session, so it draws
 * the admin's view (progress card, Add member button) — admins are the
 * dashboard's main users.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Line box="h-5" className="h-4 w-20" />

      {/* OnboardingProgressCard */}
      <CardSkeleton>
        <div className="flex h-4 items-center justify-between gap-2">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Line box="mt-2 h-8" className="h-6 w-48" />
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {["w-20", "w-28", "w-24", "w-24"].map((w, i) => (
            <Line key={i} box="h-4" className={`h-3 ${w}`} />
          ))}
        </div>
        <div className="mt-3 flex flex-col">
          <Line box="h-4" className="h-3 w-full" />
          <Line box="h-4 lg:hidden" className="h-3 w-2/3" />
        </div>
      </CardSkeleton>

      {/* Heading: logo, title and subtitle, Add member */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <Skeleton className="hidden size-[52px] rounded-full sm:block" />
          <div>
            <Line box="h-8" className="h-6 w-36" />
            <Line box="mt-1 h-5" className="h-3.5 w-52" />
          </div>
        </div>
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        {["w-24", "w-28", "w-20"].map((labelWidth, i) => (
          <CardSkeleton
            key={i}
            className={i === 0 ? "col-span-2 sm:col-span-1" : undefined}
          >
            <div className="flex flex-col gap-3">
              <div className="flex h-4 items-center justify-between gap-2">
                <Skeleton className={`h-3 ${labelWidth}`} />
                <Skeleton className="size-4 rounded" />
              </div>
              <div className="flex items-end gap-2">
                <Skeleton className="h-[30px] w-20 sm:h-9" />
                <Skeleton className="mb-0.5 h-3 w-20" />
              </div>
            </div>
          </CardSkeleton>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton>
          <Line box="h-5" className="h-3.5 w-28" />
          <div className="mt-3 flex flex-col gap-2">
            {PROFESSION_LABEL_WIDTHS.map((w, i) => (
              <BarRowSkeleton key={i} labelWidth={w} />
            ))}
          </div>
        </CardSkeleton>

        <CardSkeleton>
          <Line box="h-5" className="h-3.5 w-40" />
          <Line box="mt-1 h-4" className="h-3 w-44" />
          <div className="mt-3 flex flex-col gap-2">
            {COMPLETENESS_LABEL_WIDTHS.map((w, i) => (
              <BarRowSkeleton key={i} labelWidth={w} />
            ))}
          </div>
        </CardSkeleton>

        {/* Recently added: unpadded card, header row, then p-2 list rows */}
        <div className="rounded-lg border border-mdpva-border bg-mdpva-white dark:border-border dark:bg-card">
          <div className="flex items-center justify-between gap-2 p-4 pb-0 sm:p-5 sm:pb-0">
            <Line box="h-5" className="h-3.5 w-32" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
          <div className="divide-y divide-mdpva-border p-2 dark:divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Line box="h-5" className="h-3.5 w-32" />
                  <Line box="h-4" className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
