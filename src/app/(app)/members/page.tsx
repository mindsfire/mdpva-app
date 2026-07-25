import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon } from "lucide-react";

import { hasRole, requireRole } from "@/lib/rbac";
import {
  getMemberById,
  searchMembers,
  type MembersQueryParams,
} from "@/lib/members-query";
import { Button } from "@/components/ui/button";
import { MemberFilters } from "@/components/members/filters";
import { MemberCard } from "@/components/members/member-card";
import { MemberTable } from "@/components/members/member-table";
import { MemberSheet } from "@/components/members/member-sheet";
import { LoadMore } from "@/components/members/load-more";
import { SearchInput } from "@/components/members/search-input";

type SearchParams = Record<string, string | string[] | undefined>;

function exportHref(currentParams: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/api/export/members?${query}` : "/api/export/members";
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
    sort:
      sort === "name" || sort === "name_desc" || sort === "newest"
        ? sort
        : undefined,
    cursor: first(searchParams.cursor),
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
  const { rows, nextCursor } = await searchMembers(params);

  const memberParam =
    typeof resolvedSearchParams.member === "string"
      ? resolvedSearchParams.member
      : undefined;
  const selectedMember =
    memberParam && memberParam !== "new"
      ? await getMemberById(memberParam)
      : null;

  const currentParams: Record<string, string | undefined> = {
    q: params.q,
    status: params.status,
    profession: params.profession,
    feesDue: params.feesDue ? "true" : undefined,
    deathFund: params.deathFund ? "true" : undefined,
    sort: params.sort,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="sm:hidden">
        <Suspense fallback={null}>
          <SearchInput />
        </Suspense>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
            Members
          </h1>
          <div className="flex items-center gap-2">
            {hasRole(sessionUser.role, "admin") ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={exportHref(currentParams)} download />}
              >
                Export CSV
              </Button>
            ) : null}
            {hasRole(sessionUser.role, "editor") ? (
              <Button render={<Link href="/members?member=new" />} size="sm">
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
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-mdpva-border py-16 text-center dark:border-border">
          <p className="text-muted-foreground">No members match.</p>
          <Button variant="outline" render={<Link href="/members" />}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden rounded-lg border border-mdpva-border dark:border-border md:block">
            <MemberTable rows={rows} />
          </div>
          <div className="flex flex-col gap-2.5 md:hidden">
            {rows.map((row) => (
              <MemberCard key={row.id} row={row} />
            ))}
          </div>
          {nextCursor ? (
            <LoadMore currentParams={currentParams} nextCursor={nextCursor} />
          ) : null}
        </>
      )}

      {memberParam ? (
        <MemberSheet
          memberId={memberParam}
          member={selectedMember}
          role={sessionUser.role}
        />
      ) : null}
    </div>
  );
}
