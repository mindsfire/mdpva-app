"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { hasRole, type Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { buildMemberSections } from "@/lib/member-sections";
import { DeleteMemberDialog } from "@/components/members/delete-dialog";
import { MemberAvatar } from "@/components/members/member-avatar";
import { fullName } from "@/lib/member-name";
import {
  DeathFundBadge,
  FeesBadge,
  StatusBadge,
} from "@/components/members/member-badges";

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {/* break-words: long emails would otherwise overflow into the next column */}
      <span className="text-sm break-words text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export function MemberProfileView({
  member,
  role,
  editHref,
  onDeleted,
}: {
  member: MemberDetail;
  role: Role;
  /** Where the Edit button goes; callers pass a `?back=` so Cancel returns here. */
  editHref: string;
  onDeleted?: () => void;
}) {
  const canEdit = hasRole(role, "editor");
  const canDelete = hasRole(role, "admin");

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <MemberAvatar
          firstName={member.firstName}
          lastName={member.lastName}
          photoKey={member.photoKey}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-serif text-lg font-medium text-foreground">
            {fullName(member.firstName, member.lastName)}
          </h2>
          <p className="text-xs text-muted-foreground">{member.memberId}</p>
          {/* Always shown, even when empty: at the desk an operator needs to
              know whether this member has an old printed ID card number. */}
          <p className="text-xs text-muted-foreground">
            Legacy ID:{" "}
            <span className={member.legacyId ? "text-foreground" : undefined}>
              {member.legacyId ?? "—"}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <StatusBadge status={member.status} />
            <FeesBadge feesPaidUpto={member.feesPaidUpto} />
            <DeathFundBadge covered={member.deathFundCovered} />
          </div>
        </div>

        {canEdit || canDelete ? (
          <div className="flex shrink-0 items-center gap-2">
            {canDelete ? (
              <DeleteMemberDialog
                memberId={member.id}
                name={fullName(member.firstName, member.lastName)}
                onDeleted={onDeleted}
                trigger={
                  <Button variant="destructive" size="sm">
                    Delete
                  </Button>
                }
              />
            ) : null}
            {canEdit ? (
              <Button size="sm" render={<Link href={editHref} />}>
                Edit
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {buildMemberSections(member).map((section) => (
          <div key={section.title}>
            <h3 className="pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {section.title}
            </h3>
            {/* Notes can be long prose; everything else is short pairs. */}
            {section.title === "Notes" ? (
              <p className="text-sm whitespace-pre-wrap text-foreground">
                {section.fields[0]?.value ?? "—"}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @2xl:grid-cols-3">
                {section.fields.map((field) => (
                  <Detail
                    key={field.label}
                    label={field.label}
                    value={field.value}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
