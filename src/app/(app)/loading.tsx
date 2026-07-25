import { Skeleton } from "@/components/ui/skeleton";
import {
  BreadcrumbSkeleton,
  CardSkeleton,
  PageHeadingSkeleton,
} from "@/components/app-shell/page-skeletons";

/** Matches the dashboard: 4 stat tiles, then a 2/3 split of two panels. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <BreadcrumbSkeleton />
      <PageHeadingSkeleton withAction />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="size-4 rounded" />
              </div>
              <Skeleton className="h-9 w-16" />
            </div>
          </CardSkeleton>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <CardSkeleton className="lg:col-span-2">
          <Skeleton className="h-4 w-28" />
          <div className="mt-4 flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-6" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </CardSkeleton>

        <CardSkeleton className="lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-3 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      </div>
    </div>
  );
}
