"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <Table className="min-w-[880px]">
      <TableHeader>
        <TableRow>
          {selection ? (
            <TableHead className="sticky left-0 z-20 w-10 bg-mdpva-white dark:bg-card">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all members on this page"
              />
            </TableHead>
          ) : null}
          <TableHead
            className={cn(
              "sticky z-20 bg-mdpva-white dark:bg-card",
              selection ? "left-10" : "left-0",
            )}
          >
            Name
          </TableHead>
          <TableHead>Member ID</TableHead>
          <TableHead>Legacy ID</TableHead>
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
            onClick={(event) => {
              event.currentTarget.focus();
              open(row.id);
            }}
            aria-current={activeId === row.id ? "true" : undefined}
            className={cn(
              "cursor-pointer",
              // `bg-mdpva-gold/15` and `bg-mdpva-white` are both in the
              // `background-color` group, so twMerge (via `cn`) keeps only
              // the last one — the row's computed background becomes a
              // 15%-alpha translucent color, and the sticky Name cell's
              // `bg-inherit` inherits that translucency, letting other
              // columns show through as the table scrolls horizontally.
              // Using `color-mix` produces a single solid (opaque) color
              // instead of an alpha-blended one, so there's nothing left
              // for twMerge to strip and nothing translucent to inherit.
              activeId === row.id
                ? "bg-[color-mix(in_srgb,var(--color-mdpva-gold)_15%,var(--color-mdpva-white))] dark:bg-[color-mix(in_srgb,var(--color-mdpva-gold)_10%,var(--card))]"
                : "bg-mdpva-white dark:bg-card",
            )}
          >
            {selection ? (
              <TableCell
                className="sticky left-0 z-10 bg-inherit"
                onClick={(event) => event.stopPropagation()}
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
                "sticky z-10 bg-inherit",
                selection ? "left-10" : "left-0",
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
              {row.memberId}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.legacyId ?? "—"}
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
