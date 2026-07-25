import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbSkeleton } from "@/components/app-shell/page-skeletons";

/** Matches the profile card: avatar + identity block with actions on the
 *  right, then the detail sections in a two-column grid. */
export default function MemberProfileLoading() {
  return (
    <div className="flex flex-col gap-4">
      <BreadcrumbSkeleton />
      <div className="rounded-lg border border-mdpva-border bg-card p-4 sm:p-5 dark:border-border">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-3">
            <Skeleton className="size-14 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-28" />
              <div className="flex gap-1.5 pt-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-7 w-16 rounded-lg" />
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, section) => (
              <div key={section} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
