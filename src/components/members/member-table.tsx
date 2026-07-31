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
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all members on this page"
              />
            </TableHead>
          ) : null}
          <TableHead className="sticky left-0 z-20 bg-mdpva-white dark:bg-card">
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
            onClick={() => open(row.id)}
            aria-current={activeId === row.id ? "true" : undefined}
            className={cn(
              "cursor-pointer bg-mdpva-white dark:bg-card",
              activeId === row.id &&
                "bg-mdpva-gold/15 dark:bg-mdpva-gold/10",
            )}
          >
            {selection ? (
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={selection.isSelected(row.id)}
                  onCheckedChange={() => selection.toggle(row.id)}
                  aria-label={`Select ${fullName(row.firstName, row.lastName)}`}
                />
              </TableCell>
            ) : null}
            <TableCell className="sticky left-0 z-10 bg-inherit">
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
