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
import { clampPeekWidth, PEEK_MIN_WIDTH } from "@/lib/peek-prefs";

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
  initialWidth,
  containerRef,
}: {
  member: MemberDetail | null;
  role: Role;
  initialWidth?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { close, isPending } = useMemberDrawerNav();

  const width = clampPeekWidth(initialWidth ?? PEEK_MIN_WIDTH);
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;

  return (
    <div
      ref={panelRef}
      style={{ width, maxWidth: width }}
      className="sticky top-4 max-h-[calc(100vh-2rem)] shrink-0 overflow-y-auto rounded-lg border border-mdpva-border p-4 dark:border-border"
      role="region"
      aria-label="Member details"
      aria-busy={isPending}
    >
      <SheetResizer panelRef={panelRef} containerRef={containerRef} />
      <MemberDrawerKeys regionRef={containerRef} />

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
  );
}
