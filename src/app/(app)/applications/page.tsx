import { Suspense } from "react";
import Link from "next/link";

import {
  applicationCounts,
  listApplications,
} from "@/app/actions/applications";
import { QueueTable } from "@/components/applications/queue-table";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { QueueResults } from "@/components/applications/queue-results";
import {
  DirectoryTransitionProvider,
  TransitionLink,
} from "@/components/members/directory-transition";
import { MembersPagination } from "@/components/members/members-pagination";
import { SearchInput } from "@/components/members/search-input";
import { Button } from "@/components/ui/button";
import {
  applicationTabHref,
  parseApplicationTab,
  type ApplicationTab,
} from "@/lib/applications-params";
import { parsePage, parsePerPage } from "@/lib/members-params";
import { cn } from "@/lib/utils";

const TABS: { key: ApplicationTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = parseApplicationTab(first(params.status));
  const q = first(params.q)?.trim() || undefined;
  const perPage = parsePerPage(first(params.perPage));

  const [{ rows, total, page, totalPages }, counts] = await Promise.all([
    listApplications({
      status,
      q,
      page: parsePage(first(params.page)),
      perPage,
    }),
    applicationCounts(q),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb
        items={[{ label: "Dashboard", href: "/" }, { label: "Applications" }]}
      />
      {/* The header search is hidden on small screens. */}
      <div className="sm:hidden">
        <Suspense fallback={null}>
          <SearchInput />
        </Suspense>
      </div>

      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Member applications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Details members submitted about themselves. Nothing reaches the
          directory until it&apos;s approved here.
        </p>
      </div>

      {/* One transition shared by the tabs and the pagination, so either
          swaps the table for its skeleton while the next list loads. */}
      <DirectoryTransitionProvider>
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map((tab) => (
            <TransitionLink
              key={tab.key}
              href={applicationTabHref(tab.key, { q, perPage })}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                status === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="text-xs tabular-nums opacity-80">
                {counts[tab.key]}
              </span>
            </TransitionLink>
          ))}
        </div>

        <QueueResults counts={counts}>
          {q && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-mdpva-border py-16 text-center dark:border-border">
              <p className="text-muted-foreground">
                No {status} applications match &ldquo;{q}&rdquo;.
              </p>
              <Button
                variant="outline"
                render={<Link href={applicationTabHref(status, { perPage })} />}
              >
                Clear search
              </Button>
            </div>
          ) : (
            // Bulk approve only makes sense on the pending tab. Selection
            // covers the current page only.
            <QueueTable rows={rows} selectable={status === "pending"} />
          )}
        </QueueResults>

        {/* Outside the results, as on Members, so it stays put (with its
            spinner) while the next page loads. */}
        {total > 0 ? (
          <Suspense fallback={null}>
            <MembersPagination
              page={page}
              perPage={perPage}
              total={total}
              totalPages={totalPages}
              emptyLabel="No applications"
            />
          </Suspense>
        ) : null}
      </DirectoryTransitionProvider>
    </div>
  );
}
