import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/app-shell/page-skeletons";

/** Matches the users page: heading + Add user, then a table of accounts. */
export default function UsersLoading() {
  return (
    <div className="flex flex-col gap-5">
      <BreadcrumbSkeleton />
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
      <div className="rounded-lg border border-mdpva-border dark:border-border">
        <div className="flex items-center gap-4 border-b border-mdpva-border px-4 py-3 dark:border-border">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-3 w-14" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-mdpva-border px-4 py-3 last:border-0 dark:border-border"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-44" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
