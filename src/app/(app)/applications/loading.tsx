import { Skeleton } from "@/components/ui/skeleton";
import {
  BreadcrumbSkeleton,
  PaginationSkeleton,
  QueueTableSkeleton,
} from "@/components/app-shell/page-skeletons";

/**
 * Matches the applications queue: heading and description, the three status
 * tabs, then the queue table and its pagination. Without this the route fell
 * back to the dashboard's skeleton (stat tiles and panels).
 *
 * loading.tsx can't read `?status=` or know how many rows are coming, so it
 * draws the Pending tab (the default, and the only one with a checkbox
 * column) with enough rows to fill a tall screen. A long queue then loads in
 * below the fold with no visible jump; in-page tab and page changes size
 * their skeleton exactly (see QueueResults).
 */
const FIRST_LOAD_ROWS = 16;
export default function ApplicationsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <BreadcrumbSkeleton />
      {/* The header search is hidden on small screens; the page shows its own. */}
      <Skeleton className="h-8 w-full rounded-lg sm:hidden" />

      <div>
        <Skeleton className="h-8 w-60" />
        <div className="mt-1 flex h-5 items-center">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {[96, 104, 100].map((width) => (
          <Skeleton
            key={width}
            className="h-8 rounded-lg"
            style={{ width }}
          />
        ))}
      </div>

      <QueueTableSkeleton rows={FIRST_LOAD_ROWS} selectable />
      <PaginationSkeleton />
    </div>
  );
}
