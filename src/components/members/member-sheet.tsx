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
import { SheetResizer } from "@/components/members/sheet-resizer";
import { clampPeekWidth, PEEK_MIN_WIDTH } from "@/lib/peek-prefs";

/**
 * Read-only quick peek at a member, driven by the `?member=<id>` URL param
 * (deep-linkable). Editing deliberately lives on its own full page — a
 * narrow panel is too cramped for the full form — so Edit links out,
 * carrying the directory's current URL as `back`.
 */
export function MemberSheet({
  member,
  role,
  initialWidth,
}: {
  member: MemberDetail | null;
  role: Role;
  /** Persisted peek width from the server-read cookie, in px. */
  initialWidth?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panelRef = React.useRef<HTMLDivElement>(null);

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("member");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;
  // Capped at the viewport below: the width cookie is shared with the desktop
  // drawer, so a panel dragged out to 681px would otherwise render that wide
  // on a 390px phone and clip its own labels off-screen.
  const width = clampPeekWidth(initialWidth ?? PEEK_MIN_WIDTH);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent
        ref={panelRef}
        className="overflow-y-auto p-4 sm:max-w-none!"
        style={{ width: `min(${width}px, 100vw)`, maxWidth: "100vw" }}
      >
        <SheetResizer panelRef={panelRef} />
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
