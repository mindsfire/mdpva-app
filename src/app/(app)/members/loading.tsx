import { Skeleton } from "@/components/ui/skeleton";
import {
  BreadcrumbSkeleton,
  MemberCardsSkeleton,
  MemberTableSkeleton,
} from "@/components/app-shell/page-skeletons";

/** Matches the directory: heading + actions, filter chips, sort row, then
 *  a table on desktop and cards on mobile — the same responsive split the
 *  real page uses. */
export default function MembersDirectoryLoading() {
  return (
    <div className="flex flex-col gap-5">
      <BreadcrumbSkeleton />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-28 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </div>

      <MemberTableSkeleton />
      <MemberCardsSkeleton />
    </div>
  );
}
