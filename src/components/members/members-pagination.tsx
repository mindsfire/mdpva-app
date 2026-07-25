"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PER_PAGE_OPTIONS, type PerPage } from "@/lib/members-params";
import {
  TransitionLink,
  useDirectoryTransition,
} from "@/components/members/directory-transition";
import { cn } from "@/lib/utils";

/**
 * Page numbers with ellipses: always show first and last, plus a window
 * around the current page. `null` marks a gap.
 */
export function pageItems(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: (number | null)[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push(null);
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push(null);

  items.push(total);
  return items;
}

export function MembersPagination({
  page,
  perPage,
  total,
  totalPages,
}: {
  page: number;
  perPage: PerPage;
  total: number;
  totalPages: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPending, navigate } = useDirectoryTransition();

  function hrefFor(nextPage: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function setPerPage(next: PerPage) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("perPage", String(next));
    // Row count changed, so the old page number is meaningless.
    params.delete("page");
    navigate(`${pathname}?${params.toString()}`);
  }

  const firstRow = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastRow = Math.min(page * perPage, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? (
            "No members"
          ) : (
            <>
              <span className="font-medium text-foreground tabular-nums">
                {firstRow}–{lastRow}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground tabular-nums">
                {total}
              </span>
            </>
          )}
        </p>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="cursor-pointer">
                {isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : null}
                {perPage} / page
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            {PER_PAGE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => setPerPage(option)}
                className="cursor-pointer"
                data-active={option === perPage ? "" : undefined}
              >
                {option} rows per page
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            className="cursor-pointer"
            render={
              page <= 1 ? undefined : <TransitionLink href={hrefFor(page - 1)} />
            }
          >
            <ChevronLeftIcon />
          </Button>

          {pageItems(page, totalPages).map((item, i) =>
            item === null ? (
              <span
                key={`gap-${i}`}
                aria-hidden="true"
                className="px-1 text-sm text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? "default" : "ghost"}
                size="icon-sm"
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cn("cursor-pointer tabular-nums")}
                render={<TransitionLink href={hrefFor(item)} />}
              >
                {item}
              </Button>
            ),
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= totalPages}
            className="cursor-pointer"
            render={
              page >= totalPages ? undefined : (
                <TransitionLink href={hrefFor(page + 1)} />
              )
            }
          >
            <ChevronRightIcon />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
