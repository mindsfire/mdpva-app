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
import { MemberForm } from "@/components/members/member-form";
import { MemberProfileView } from "@/components/members/member-profile-view";

/**
 * Desktop sheet driven by the `?member=<id>` URL param (deep-linkable).
 * `?member=new` opens the create form; any other value is a member id
 * whose data is fetched server-side and passed in as `member`.
 */
export function MemberSheet({
  memberId,
  member,
  role,
}: {
  memberId: string;
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

  const isCreate = memberId === "new";

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent className="overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{isCreate ? "Add member" : "Member profile"}</SheetTitle>
        </SheetHeader>
        {isCreate ? (
          <MemberForm mode="create" onCancel={close} onSuccess={close} />
        ) : member ? (
          <MemberProfileView
            member={member}
            role={role}
            onUpdated={() => router.refresh()}
            onDeleted={close}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Member not found.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
