import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { PlusIcon } from "lucide-react";

import { hasRole, requireRole } from "@/lib/rbac";
import {
  getMemberById,
  searchMembers,
  type MembersQueryParams,
} from "@/lib/members-query";
import { parsePage, parsePerPage, parseSort } from "@/lib/members-params";
import { Button } from "@/components/ui/button";
import { MemberFilters } from "@/components/members/filters";
import { MemberCard } from "@/components/members/member-card";
import { MemberTable } from "@/components/members/member-table";
import { MemberSheetNarrow } from "@/components/members/member-sheet-narrow";
import { MembersDirectoryLayout } from "@/components/members/members-directory-layout";
import { MembersPagination } from "@/components/members/members-pagination";
import {
  DirectoryResults,
  DirectoryTransitionProvider,
} from "@/components/members/directory-transition";
import { SearchInput } from "@/components/members/search-input";
import { MembersSelectionProvider } from "@/components/members/selection";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { parsePeekWidthCookie, PEEK_WIDTH_COOKIE } from "@/lib/peek-prefs";
import { ExportCsvDialog } from "@/components/members/export-dialog";
import { ALL_EXPORT_FIELDS } from "@/lib/csv/member-csv";
import {
  EXPORT_FIELDS_COOKIE,
  parseExportFieldsCookie,
} from "@/lib/export-prefs";

type SearchParams = Record<string, string | string[] | undefined>;

function withParams(
  path: string,
  currentParams: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toQueryParams(searchParams: SearchParams): MembersQueryParams {
  const status = first(searchParams.status);
  const profession = first(searchParams.profession);
  const sort = first(searchParams.sort);
  return {
    q: first(searchParams.q),
    status:
      status === "active" || status === "inactive" || status === "suspended"
        ? status
        : undefined,
    profession:
      profession === "photographer" ||
      profession === "videographer" ||
      profession === "both"
        ? profession
        : undefined,
    feesDue: first(searchParams.feesDue) === "true",
    deathFund: first(searchParams.deathFund) === "true",
    sort: parseSort(sort),
    page: parsePage(first(searchParams.page)),
    perPage: parsePerPage(first(searchParams.perPage)),
  };
}

export default async function MembersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sessionUser = await requireRole("viewer");

  const resolvedSearchParams = await searchParams;
  const params = toQueryParams(resolvedSearchParams);
  const { rows, total, page, perPage, totalPages } = await searchMembers(params);

  const memberParam =
    typeof resolvedSearchParams.member === "string"
      ? resolvedSearchParams.member
      : undefined;
  const selectedMember = memberParam ? await getMemberById(memberParam) : null;
  const cookieStore = await cookies();
  const peekWidth = parsePeekWidthCookie(
    cookieStore.get(PEEK_WIDTH_COOKIE)?.value,
  );
  // Remembered export selection; falls back to all fields for a first-time or
  // corrupted cookie.
  const exportFields =
    parseExportFieldsCookie(cookieStore.get(EXPORT_FIELDS_COOKIE)?.value) ??
    ALL_EXPORT_FIELDS;

  const currentParams: Record<string, string | undefined> = {
    q: params.q,
    status: params.status,
    profession: params.profession,
    feesDue: params.feesDue ? "true" : undefined,
    deathFund: params.deathFund ? "true" : undefined,
    sort: params.sort,
    perPage:
      params.perPage && params.perPage !== 10 ? String(params.perPage) : undefined,
  };

  // Carried into the create form so Cancel returns to this exact filtered view.
  const backToDirectory = withParams("/members", currentParams);

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Members" }]} />
      <div className="sm:hidden">
        <Suspense fallback={null}>
          <SearchInput />
        </Suspense>
      </div>

      <DirectoryTransitionProvider>
        <MembersSelectionProvider
          isAdmin={hasRole(sessionUser.role, "admin")}
          ids={rows.map((row) => row.id)}
        >
          {/* The drawer must render whenever `?member=` is present, even when
              the current filters return zero rows — otherwise a deep link
              like `?q=zzzz&member=<id>` orphans the param on desktop while
              still showing the sheet below lg. `ids: []` and a no-op
              `step()` are already tolerated by MemberDrawerNavProvider. */}
          <MembersDirectoryLayout
            ids={rows.map((row) => row.id)}
            activeId={memberParam ?? null}
            member={selectedMember}
            role={sessionUser.role}
            initialWidth={peekWidth}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
                  Members
                </h1>
                <div className="flex items-center gap-2">
                  {hasRole(sessionUser.role, "admin") ? (
                    <ExportCsvDialog
                      initialFields={exportFields}
                      currentParams={currentParams}
                    />
                  ) : null}
                  {hasRole(sessionUser.role, "editor") ? (
                    <Button
                      render={
                        <Link
                          href={`/members/new?back=${encodeURIComponent(backToDirectory)}`}
                        />
                      }
                      size="sm"
                    >
                      <PlusIcon />
                      Add member
                    </Button>
                  ) : null}
                </div>
              </div>
              <Suspense fallback={null}>
                <MemberFilters />
              </Suspense>
            </div>

            {rows.length === 0 ? (
              <div
                className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-mdpva-border py-16 text-center dark:border-border"
              >
                <p className="text-muted-foreground">No members match.</p>
                <Button variant="outline" render={<Link href="/members" />}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <DirectoryResults rowCount={perPage}>
                  <div className="hidden rounded-lg border border-mdpva-border dark:border-border md:block">
                    <MemberTable rows={rows} />
                  </div>
                  <div className="flex flex-col gap-2.5 md:hidden">
                    {rows.map((row) => (
                      <MemberCard key={row.id} row={row} />
                    ))}
                  </div>
                </DirectoryResults>
                <MembersPagination
                  page={page}
                  perPage={perPage}
                  total={total}
                  totalPages={totalPages}
                />
              </div>
            )}
          </MembersDirectoryLayout>
        </MembersSelectionProvider>
      </DirectoryTransitionProvider>

      {memberParam ? (
        <MemberSheetNarrow
          member={selectedMember}
          role={sessionUser.role}
          initialWidth={peekWidth}
        />
      ) : null}
    </div>
  );
}
