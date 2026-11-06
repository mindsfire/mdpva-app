import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/app-shell/page-skeletons";

/** Matches the donations page: heading + Add, then the list. */
export default function DonationsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <BreadcrumbSkeleton />
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
      <div className="rounded-lg border border-mdpva-border dark:border-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-mdpva-border px-4 py-2.5 last:border-0 dark:border-border"
          >
            <Skeleton className="size-11 rounded-md" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
