"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { hasRole, type Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { DeleteMemberDialog } from "@/components/members/delete-dialog";
import { MemberAvatar } from "@/components/members/member-avatar";
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

const PROFESSION_LABELS: Record<
  NonNullable<MemberDetail["profession"]>,
  string
> = {
  photographer: "Photographer",
  videographer: "Videographer",
  both: "Photo & Video",
};

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
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <MemberAvatar
          firstName={member.firstName}
          lastName={member.lastName}
          photoKey={member.photoKey}
          size="lg"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-serif text-lg font-medium text-foreground">
            {member.firstName} {member.lastName}
          </h2>
          <p className="text-xs text-muted-foreground">
            {member.memberId}
            {member.legacyId ? ` · Legacy ${member.legacyId}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <StatusBadge status={member.status} />
            <FeesBadge feesPaidUpto={member.feesPaidUpto} />
            <DeathFundBadge covered={member.deathFundCovered} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Contact
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Email" value={member.email} />
            <Detail label="Phone" value={member.phone} />
          </div>
        </div>

        <div>
          <h3 className="pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Address
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Detail
              label="Address"
              value={[member.addressLine1, member.addressLine2]
                .filter(Boolean)
                .join(", ")}
            />
            <Detail label="Area" value={member.area} />
            <Detail label="City" value={member.city} />
            <Detail label="State" value={member.state} />
            <Detail label="Pincode" value={member.pincode} />
          </div>
        </div>

        <div>
          <h3 className="pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Association
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Detail
              label="Profession"
              value={
                member.profession
                  ? PROFESSION_LABELS[member.profession]
                  : null
              }
            />
            <Detail label="Business" value={member.businessName} />
            <Detail label="Date of birth" value={member.dob} />
            <Detail label="Blood group" value={member.bloodGroup} />
            <Detail
              label="Fees paid upto"
              value={member.feesPaidUpto}
            />
            <Detail
              label="Death fund"
              value={member.deathFundCovered ? "Covered" : "Not covered"}
            />
          </div>
        </div>

        {member.notes ? (
          <div>
            <h3 className="pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Notes
            </h3>
            <p className="text-sm whitespace-pre-wrap text-foreground">
              {member.notes}
            </p>
          </div>
        ) : null}
      </div>

      {canEdit || canDelete ? (
        <div className="flex justify-end gap-2 border-t border-mdpva-border pt-4 dark:border-border">
          {canDelete ? (
            <DeleteMemberDialog
              memberId={member.id}
              name={`${member.firstName} ${member.lastName}`}
              onDeleted={onDeleted}
              trigger={<Button variant="destructive">Delete</Button>}
            />
          ) : null}
          {canEdit ? (
            <Button render={<Link href={editHref} />}>Edit</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
