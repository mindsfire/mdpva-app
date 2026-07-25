"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberProfileView } from "@/components/members/member-profile-view";

/**
 * Read-only quick peek at a member, driven by the `?member=<id>` URL param
 * (deep-linkable). Editing deliberately lives on its own full page — a
 * 384px panel is too cramped for the full form — so Edit links out,
 * carrying the directory's current URL as `back`.
 */
export function MemberSheet({
  member,
  role,
}: {
  member: MemberDetail | null;
  role: Role;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("member");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent className="overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Member profile</SheetTitle>
        </SheetHeader>
        {member ? (
          <MemberProfileView
            member={member}
            role={role}
            editHref={`/members/${member.id}/edit?back=${encodeURIComponent(currentUrl)}`}
            onDeleted={close}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Member not found.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
