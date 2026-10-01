"use client";

import { QueueTableSkeleton } from "@/components/app-shell/page-skeletons";
import { useDirectoryTransition } from "@/components/members/directory-transition";
import {
  queueSkeletonShape,
  type ApplicationTab,
} from "@/lib/applications-params";

/**
 * Swaps the queue for a skeleton while a tab, page or page-size change
 * loads. The skeleton is shaped like the *destination* — its row count and
 * whether it has the checkbox column — so it lines up with the table that
 * replaces it rather than the one being left.
 */
export function QueueResults({
  counts,
  children,
}: {
  counts: Record<ApplicationTab, number>;
  children: React.ReactNode;
}) {
  const { isPending, pendingHref } = useDirectoryTransition();

  if (isPending && pendingHref) {
    const { rows, selectable } = queueSkeletonShape(pendingHref, counts);
    return (
      <div aria-busy>
        <QueueTableSkeleton rows={rows} selectable={selectable} />
      </div>
    );
  }

  return <div>{children}</div>;
}
