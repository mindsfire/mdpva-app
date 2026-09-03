"use client";

import Link from "next/link";

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

export function MemberCard({ row }: { row: MemberRow }) {
  const selection = useMembersSelection();

  return (
    // The checkbox is a sibling of the link, never a child of it. Nesting a
    // control inside an anchor is invalid HTML, and on touch the tap was
    // reaching the anchor and navigating to the member instead of selecting
    // it — so selection was unusable on a phone. A generous tap target keeps
    // it comfortable at thumb size.
    <div className="flex items-start gap-3 rounded-lg border border-mdpva-border bg-card p-3.5 dark:border-border">
      {selection ? (
        <label className="-m-1.5 flex cursor-pointer items-center p-1.5">
          <Checkbox
            checked={selection.isSelected(row.id)}
            onCheckedChange={() => selection.toggle(row.id)}
            aria-label={`Select ${fullName(row.firstName, row.lastName)}`}
          />
        </label>
      ) : null}
      <Link
        href={`/members/${row.id}`}
        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3"
      >
        <MemberAvatar
          firstName={row.firstName}
          lastName={row.lastName}
          photoKey={row.photoKey}
          updatedAt={row.updatedAt}
          size="lg"
          className="mt-0.5"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-serif text-base font-medium text-foreground">
              {fullName(row.firstName, row.lastName)}
            </span>
            {/* Legacy ledger number, not the generated member ID — the same
              identifier the table leads with. */}
            <span className="shrink-0 text-xs text-muted-foreground">
              {row.legacyId ?? row.memberId}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{row.phone ?? "—"}</span>
            <span aria-hidden="true">·</span>
            <ProfessionLabel profession={row.profession} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <StatusBadge status={row.status} />
            <FeesBadge feesPaidUpto={row.feesPaidUpto} />
            <DeathFundBadge covered={row.deathFundCovered} />
          </div>
        </div>
      </Link>
    </div>
  );
}
