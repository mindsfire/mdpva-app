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
import { photoUrl } from "@/lib/photo-url";
import {
  DeathFundBadge,
  FeesBadge,
  initials,
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
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Mobile keeps the circular avatar. On desktop the photo is shown as
            a portrait close to the 7:9 it is stored at (600x771): a small
            circle crops the sides off a passport photo and is too small to
            recognise a face in. */}
        <MemberAvatar
          firstName={member.firstName}
          lastName={member.lastName}
          photoKey={member.photoKey}
          updatedAt={member.updatedAt}
          size="lg"
          className="sm:hidden"
        />
        <MemberPortrait
          firstName={member.firstName}
          lastName={member.lastName}
          photoKey={member.photoKey}
          updatedAt={member.updatedAt}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:gap-1.5 sm:pt-0.5">
          <h2 className="font-serif text-lg font-medium text-foreground sm:text-xl">
            {fullName(member.firstName, member.lastName)}
          </h2>
          {/* Membership No. is the only identifier shown: it is what members
              quote and what the office looks them up by. Always rendered even
              when empty, so an operator can see at a glance that a member has
              no number yet. The generated MDPVA-YYYY-NNNN value stays in
              search and the CSV export, but is off the profile deliberately —
              two identifiers side by side was the confusion to avoid. */}
          <p className="text-xs text-muted-foreground">
            Membership No.:{" "}
            <span className={member.legacyId ? "text-foreground" : undefined}>
              {member.legacyId ?? "—"}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-1.5">
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

/**
 * Desktop-only portrait. Photos are stored at 7:9 (600x771 after
 * `processLegacyPhoto`), so the frame matches that ratio and the image fills
 * it without distortion. Sized a little under its stored width, and wider
 * again once the panel is roomy.
 */
function MemberPortrait({
  firstName,
  lastName,
  photoKey,
  updatedAt,
}: {
  firstName: string;
  lastName: string | null;
  photoKey: string | null;
  updatedAt: Date | null;
}) {
  const name = fullName(firstName, lastName);
  const src = photoUrl(photoKey, updatedAt);

  return (
    <div className="hidden aspect-[7/9] w-32 shrink-0 overflow-hidden rounded-lg ring-1 ring-mdpva-gold/60 sm:block @2xl:w-40">
      {src ? (
        // Served by our own /api/photos route, which already resizes and
        // caches, so next/image would add a second optimisation pass.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center bg-mdpva-gold/20 font-serif text-2xl text-mdpva-accent dark:text-mdpva-gold">
          {initials(firstName, lastName)}
        </div>
      )}
    </div>
  );
}
