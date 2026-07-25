import { Skeleton } from "@/components/ui/skeleton";
import {
  BreadcrumbSkeleton,
  CardSkeleton,
} from "@/components/app-shell/page-skeletons";

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

function SectionSkeleton({ fields }: { fields: number }) {
  return (
    <CardSkeleton>
      <Skeleton className="h-3 w-24" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <FieldSkeleton key={i} />
        ))}
      </div>
    </CardSkeleton>
  );
}

/** Matches the add/edit form: photo card on top, then four section cards
 *  in a two-column grid, then the sticky action bar. */
export function MemberFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <BreadcrumbSkeleton />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <CardSkeleton>
        <Skeleton className="h-3 w-24" />
        <div className="mt-3 flex items-center gap-4 rounded-lg border border-mdpva-border p-3 dark:border-border">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        </div>
      </CardSkeleton>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SectionSkeleton fields={5} />
        <SectionSkeleton fields={6} />
        <SectionSkeleton fields={5} />
        <SectionSkeleton fields={3} />
      </div>

      <div className="flex justify-end gap-2 border-t border-mdpva-border py-3 dark:border-border">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
    </div>
  );
}
