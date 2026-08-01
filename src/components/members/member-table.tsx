"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import type { MemberRow } from "@/lib/members-query";
import { fullName } from "@/lib/member-name";
import { MemberAvatar } from "./member-avatar";
import {
  DeathFundBadge,
  FeesBadge,
  ProfessionLabel,
  StatusBadge,
} from "./member-badges";
import { useMembersSelection } from "./selection";
import { useMemberDrawerNav } from "@/components/members/member-drawer-nav";
import { useDirectoryTransition } from "@/components/members/directory-transition";
import type { MembersSort } from "@/lib/members-params";
import { cn } from "@/lib/utils";

export function MemberTable({ rows }: { rows: MemberRow[] }) {
  const { activeId, open } = useMemberDrawerNav();
  const selection = useMembersSelection();

  const allSelected =
    !!selection && rows.length > 0 && rows.every((row) => selection.isSelected(row.id));
  const someSelected =
    !!selection && !allSelected && rows.some((row) => selection.isSelected(row.id));

  function toggleAll() {
    if (!selection) return;
    if (allSelected) {
      for (const row of rows) {
        if (selection.isSelected(row.id)) selection.toggle(row.id);
      }
    } else {
      for (const row of rows) {
        if (!selection.isSelected(row.id)) selection.toggle(row.id);
      }
    }
  }

  // The checkbox column carries `min-w-10` as well as `w-10`: under table
  // auto-layout a bare `width` is only a suggestion, and it collapsed to its
  // 32px content, leaving an 8px slot between it and the Name column (pinned
  // at `left-10`) through which scrolled cells showed. The two must agree.
  return (
    <Table
      className="min-w-[800px]"
      // Matches the drawer: the horizontal scrollbar's thumb is transparent
      // until the pointer is over the table, and `scrollbar-gutter: stable`
      // holds its track open either way so rows never shift as it appears.
      containerClassName={cn(
        "[scrollbar-gutter:stable] [scrollbar-color:transparent_transparent] [scrollbar-width:thin]",
        "hover:[scrollbar-color:color-mix(in_srgb,var(--muted-foreground)_45%,transparent)_transparent]",
      )}
    >
      <TableHeader>
        {/* The header row is painted explicitly so the sticky cells below can
            inherit it. They used to hard-code `bg-mdpva-white dark:bg-card`,
            which is the *body row* colour — a visibly lighter block than the
            rest of the header, which is transparent and shows the page behind
            it. `hover:` is pinned to the same colour because TableRow carries
            `hover:bg-muted/50`, and a translucent hover would be inherited by
            the sticky cells and let scrolled columns show through. */}
        <TableRow className="bg-mdpva-paper hover:bg-mdpva-paper dark:bg-background dark:hover:bg-background">
          {selection ? (
            <TableHead className="sticky left-0 z-20 w-10 min-w-10 bg-inherit">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all members on this page"
              />
            </TableHead>
          ) : null}
          {/* Membership No. leads, and it and Name are both pinned, so
              scrolling right never leaves you unsure which row you are on.
              Each offset must equal the total width of the columns to its
              left exactly, or scrolled cells show through the seam — hence
              the explicit w-36/min-w-36 and the 184px (40 + 144) for Name.
              w-36 is chosen to exceed the header text's own min-content width
              (~120px): a narrower value is silently ignored by table layout,
              which is what made Name overlap this column by 8px. */}
          <SortableHead
            label="Membership No."
            asc="membership"
            desc="membership_desc"
            className={cn(
              "sticky z-20 w-36 min-w-36 bg-inherit",
              selection ? "left-10" : "left-0",
            )}
          />
          <SortableHead
            label="Name"
            asc="name"
            desc="name_desc"
            className={cn(
              "sticky z-20 bg-inherit",
              selection ? "left-[184px]" : "left-36",
            )}
          />
          <TableHead>Phone</TableHead>
          <TableHead>Profession</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Fees</TableHead>
          <TableHead>Death Fund</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            tabIndex={0}
            role="row"
            aria-roledescription="Activatable row: press Enter to view member details"
            aria-label={`View details for ${fullName(row.firstName, row.lastName)}`}
            onClick={(event) => {
              event.currentTarget.focus();
              open(row.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.currentTarget.focus();
                open(row.id);
              }
            }}
            aria-current={activeId === row.id ? "true" : undefined}
            className={cn(
              "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
              // `bg-mdpva-gold/15` and `bg-mdpva-white` are both in the
              // `background-color` group, so twMerge (via `cn`) keeps only
              // the last one — the row's computed background becomes a
              // 15%-alpha translucent color, and the sticky Name cell's
              // `bg-inherit` inherits that translucency, letting other
              // columns show through as the table scrolls horizontally.
              // Using `color-mix` produces a single solid (opaque) color
              // instead of an alpha-blended one, so there's nothing left
              // for twMerge to strip and nothing translucent to inherit.
              //
              // `TableRow` also carries `hover:bg-muted/50`, which is in a
              // different tailwind-merge group (it's a state-variant utility,
              // not a plain `bg-*`) so twMerge keeps BOTH it and our `bg-*`
              // classes — on hover the browser applies both, and since both
              // are backgrounds on the same element the later one in the
              // generated stylesheet wins, which for `hover:` is not
              // guaranteed to be ours. Rather than fight the cascade, we
              // neutralise the inherited hover utility with an explicit
              // `hover:bg-[...]` using the same opaque `color-mix` colors, so
              // hovering never reintroduces alpha.
              activeId === row.id
                ? "bg-[color-mix(in_srgb,var(--color-mdpva-gold)_15%,var(--color-mdpva-white))] hover:bg-[color-mix(in_srgb,var(--color-mdpva-gold)_15%,var(--color-mdpva-white))] dark:bg-[color-mix(in_srgb,var(--color-mdpva-gold)_10%,var(--card))] dark:hover:bg-[color-mix(in_srgb,var(--color-mdpva-gold)_10%,var(--card))]"
                : "bg-mdpva-white hover:bg-[color-mix(in_srgb,var(--color-muted)_50%,var(--color-mdpva-white))] dark:bg-card dark:hover:bg-[color-mix(in_srgb,var(--color-muted)_50%,var(--card))]",
            )}
          >
            {selection ? (
              <TableCell
                className="sticky left-0 z-10 w-10 min-w-10 bg-inherit"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <Checkbox
                  checked={selection.isSelected(row.id)}
                  onCheckedChange={() => selection.toggle(row.id)}
                  aria-label={`Select ${fullName(row.firstName, row.lastName)}`}
                />
              </TableCell>
            ) : null}
            <TableCell
              className={cn(
                "sticky z-10 w-36 min-w-36 bg-inherit text-muted-foreground",
                selection ? "left-10" : "left-0",
              )}
            >
              {row.legacyId ?? "—"}
            </TableCell>
            <TableCell
              className={cn(
                "sticky z-10 bg-inherit",
                selection ? "left-[184px]" : "left-36",
              )}
            >
              <div className="flex items-center gap-2.5">
                <MemberAvatar
                  firstName={row.firstName}
                  lastName={row.lastName}
                  photoKey={row.photoKey}
                  className="size-8"
                />
                <span className="font-medium text-foreground">
                  {fullName(row.firstName, row.lastName)}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.phone ?? "—"}
            </TableCell>
            <TableCell>
              <ProfessionLabel profession={row.profession} />
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status} />
            </TableCell>
            <TableCell>
              <FeesBadge feesPaidUpto={row.feesPaidUpto} />
            </TableCell>
            <TableCell>
              <DeathFundBadge covered={row.deathFundCovered} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Column header that sorts the directory.
 *
 * Sorting lives in the URL like every other directory control, so a sorted
 * view is linkable and survives a reload. Navigating through the shared
 * directory transition means a sort shows the same skeleton a page change
 * does, rather than freezing on the old order.
 */
function SortableHead({
  label,
  asc: ascValue,
  desc: descValue,
  className,
}: {
  label: string;
  asc: MembersSort;
  desc: MembersSort;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useDirectoryTransition();

  const current = searchParams.get("sort");
  const isAsc = current === ascValue;
  const isDesc = current === descValue;
  // First click sorts ascending; clicking the active column flips it.
  const next = isAsc ? descValue : ascValue;

  function sort() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", next);
    // A new order invalidates the current page position.
    params.delete("page");
    navigate(`${pathname}?${params.toString()}`);
  }

  return (
    <TableHead
      className={className}
      aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
    >
      <button
        type="button"
        onClick={sort}
        className="-mx-1.5 flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`Sort by ${label}, ${next.endsWith("_desc") ? "descending" : "ascending"}`}
      >
        {label}
        {isAsc ? (
          <ArrowUpIcon className="size-3.5" />
        ) : isDesc ? (
          <ArrowDownIcon className="size-3.5" />
        ) : (
          // Always rendered, just faint, so the column reads as sortable
          // before it is used — and so the header never changes width when
          // the icon swaps in.
          <ChevronsUpDownIcon className="size-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
