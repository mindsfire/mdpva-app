import { Skeleton } from "@/components/ui/skeleton";
import {
  BreadcrumbSkeleton,
  MemberCardsSkeleton,
  MemberTableSkeleton,
  PaginationSkeleton,
} from "@/components/app-shell/page-skeletons";

/**
 * loading.tsx can't know how many members are coming, so it draws enough
 * rows to fill a tall screen: a long directory then loads in below the fold
 * with no visible jump. In-page page, page-size and sort changes size their
 * skeleton exactly (see DirectoryResults).
 */
const FIRST_LOAD_ROWS = 16;

/**
 * Matches the directory: heading with Export / Add member, the Filters and
 * Sort buttons, then a table on desktop and cards on mobile — the same
 * responsive split the real page uses — and the pagination bar.
 *
 * It can't read the session either, so it draws the admin's view (checkbox
 * column, both buttons): admins are the directory's main users.
 */
export default function MembersDirectoryLoading() {
  return (
    <div className="flex flex-col gap-5">
      <BreadcrumbSkeleton />
      {/* The header search is hidden on small screens; the page shows its own. */}
      <Skeleton className="h-8 w-full rounded-lg sm:hidden" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-28 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="ml-auto h-7 w-40 rounded-lg" />
        </div>
      </div>

      <div>
        <MemberTableSkeleton rows={FIRST_LOAD_ROWS} selectable />
        <MemberCardsSkeleton rows={FIRST_LOAD_ROWS} selectable />
      </div>
      <PaginationSkeleton />
    </div>
  );
}
