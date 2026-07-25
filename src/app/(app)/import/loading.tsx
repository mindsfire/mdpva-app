import { Skeleton } from "@/components/ui/skeleton";
import {
  BreadcrumbSkeleton,
  CardSkeleton,
} from "@/components/app-shell/page-skeletons";

/** Matches the import/export page: heading, then the export and import cards. */
export default function ImportLoading() {
  return (
    <div className="flex flex-col gap-5">
      <BreadcrumbSkeleton />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <CardSkeleton key={i}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-4 w-full max-w-xl" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-8 w-36 rounded-lg" />
              {i === 1 ? <Skeleton className="h-8 w-40 rounded-lg" /> : null}
            </div>
          </CardSkeleton>
        ))}
      </div>
    </div>
  );
}
