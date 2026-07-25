import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared skeleton pieces. Each route's loading.tsx composes these to match
 * that page's real layout — a skeleton whose shape differs from the page
 * that replaces it reads as a broken flash rather than a load.
 */

export function BreadcrumbSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-3" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function PageHeadingSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      {withAction ? <Skeleton className="h-7 w-28 rounded-lg" /> : null}
    </div>
  );
}

/** Card matching the bordered section cards used across the app. */
export function CardSkeleton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-mdpva-border bg-mdpva-white p-4 sm:p-5 dark:border-border dark:bg-card ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

/** Mirrors MemberTable's column widths so rows don't jump on swap. */
export function MemberTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="hidden rounded-lg border border-mdpva-border dark:border-border md:block">
      <div className="flex items-center gap-4 border-b border-mdpva-border px-4 py-3 dark:border-border">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-mdpva-border px-4 py-3 last:border-0 dark:border-border"
        >
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="hidden h-4 w-24 lg:block" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MemberCardsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5 md:hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-mdpva-border p-3.5 dark:border-border"
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
      ))}
    </div>
  );
}
