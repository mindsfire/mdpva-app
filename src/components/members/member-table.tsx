"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
import { MemberAvatar } from "./member-avatar";
import {
  DeathFundBadge,
  FeesBadge,
  ProfessionLabel,
  StatusBadge,
} from "./member-badges";
import { useMembersSelection } from "./selection";

export function MemberTable({ rows }: { rows: MemberRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selection = useMembersSelection();

  function openMember(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("member", id);
    router.push(`${pathname}?${params.toString()}`);
  }

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
    <Table>
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
          <TableHead>Name</TableHead>
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
            onClick={() => openMember(row.id)}
            className="cursor-pointer"
          >
            {selection ? (
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={selection.isSelected(row.id)}
                  onCheckedChange={() => selection.toggle(row.id)}
                  aria-label={`Select ${row.firstName} ${row.lastName}`}
                />
              </TableCell>
            ) : null}
            <TableCell>
              <div className="flex items-center gap-2.5">
                <MemberAvatar
                  firstName={row.firstName}
                  lastName={row.lastName}
                  photoKey={row.photoKey}
                  className="size-8"
                />
                <span className="font-medium text-foreground">
                  {row.firstName} {row.lastName}
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
