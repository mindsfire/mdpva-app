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
    <Link
      href={`/members/${row.id}`}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-mdpva-border bg-card p-3.5 dark:border-border"
    >
      {selection ? (
        <span
          className="mt-0.5 flex items-center"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            selection.toggle(row.id);
          }}
        >
          <Checkbox
            checked={selection.isSelected(row.id)}
            aria-label={`Select ${fullName(row.firstName, row.lastName)}`}
          />
        </span>
      ) : null}
      <MemberAvatar
        firstName={row.firstName}
        lastName={row.lastName}
        photoKey={row.photoKey}
        size="lg"
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-serif text-base font-medium text-foreground">
            {fullName(row.firstName, row.lastName)}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {row.memberId}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{row.phone ?? "—"}</span>
          <span aria-hidden="true">·</span>
          <ProfessionLabel profession={row.profession} />
          {row.legacyId ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Legacy {row.legacyId}</span>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <StatusBadge status={row.status} />
          <FeesBadge feesPaidUpto={row.feesPaidUpto} />
          <DeathFundBadge covered={row.deathFundCovered} />
        </div>
      </div>
    </Link>
  );
}
