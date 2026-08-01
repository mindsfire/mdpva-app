"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberProfileView } from "@/components/members/member-profile-view";
import { SheetResizer } from "@/components/members/sheet-resizer";
import {
  MemberDrawerKeys,
  useMemberDrawerNav,
} from "@/components/members/member-drawer-nav";

/**
 * Non-modal member detail panel docked to the right of the directory.
 *
 * Deliberately not a `Sheet`: the Radix sheet is modal, so it dimmed the
 * table, trapped focus, and had to be closed before another member could be
 * opened. A plain panel keeps the list visible and clickable, which is the
 * whole point of the redesign (see
 * docs/specs/2026-07-31-member-detail-drawer.md).
 */
export function MemberDrawer({
  member,
  role,
  containerRef,
}: {
  member: MemberDetail | null;
  role: Role;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { close, isPending } = useMemberDrawerNav();

  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;

  // Pinned directly beneath the app's sticky header (z-40, 56px tall) and
  // sized to the rest of the viewport, so no strip of table shows above or
  // below it while the list scrolls past.
  //
  // `overscroll-contain` below stops scroll chaining to the page: without it,
  // reaching the end of the drawer hands the wheel to the document and the
  // whole directory scrolls out from under you mid-read.
  return (
    <div
      ref={panelRef}
      className="sticky top-14 h-[calc(100vh-4.5rem)] w-(--member-drawer-width) shrink-0"
      role="region"
      aria-label="Member details"
      aria-busy={isPending}
    >
      <SheetResizer
        panelRef={panelRef}
        containerRef={containerRef}
        varTargetRef={containerRef}
      />
      <MemberDrawerKeys regionRef={containerRef} />

      {/* The scroll area is a child, not this element: the resize handle sits
          in the gap to the left of the panel, and an `overflow-y-auto` on the
          same box clipped it out of sight. */}
      <div className="h-full overflow-y-auto overscroll-contain rounded-lg border border-mdpva-border bg-mdpva-white p-4 shadow-sm dark:border-border dark:bg-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2Icon className="size-3 animate-spin" />
                Loading…
              </span>
            ) : (
              "↑ ↓ to move · Esc to close"
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            aria-label="Close member details"
          >
            <XIcon />
          </Button>
        </div>

        {/* Dimmed rather than replaced while loading: swapping to a skeleton on
          every arrow-key step would flash the whole panel. */}
        <div className={cn("transition-opacity", isPending && "opacity-50")}>
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
        </div>
      </div>
    </div>
  );
}
