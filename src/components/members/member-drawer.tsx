"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
          same box clipped it out of sight.

          The scrollbar shows only while the pointer is over the panel. It is
          hidden by painting the thumb transparent rather than by removing the
          scrollbar, and `scrollbar-gutter: stable` reserves its track either
          way — so the text never reflows as it appears and disappears. */}
      <div
        className={cn(
          "h-full overflow-y-auto overscroll-contain rounded-lg border border-mdpva-border bg-mdpva-white p-4 shadow-sm dark:border-border dark:bg-card",
          "[scrollbar-gutter:stable] [scrollbar-color:transparent_transparent] [scrollbar-width:thin]",
          "hover:[scrollbar-color:color-mix(in_srgb,var(--muted-foreground)_45%,transparent)_transparent]",
        )}
      >
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

        {/* The panel mounts before its data arrives, so "no member yet" is the
            normal opening state, not an error. A skeleton shaped like the real
            record covers the fetch; "Member not found" is only the truth once
            the navigation has settled and still produced nothing. */}
        {member ? (
          <div className={cn("transition-opacity", isPending && "opacity-50")}>
            <MemberProfileView
              member={member}
              role={role}
              editHref={`/members/${member.id}/edit?back=${encodeURIComponent(currentUrl)}`}
              onDeleted={close}
            />
          </div>
        ) : isPending ? (
          <MemberDrawerSkeleton />
        ) : (
          <p className="text-sm text-muted-foreground">Member not found.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Placeholder shaped like MemberProfileView — identity block, then four
 * labelled sections in the same two-column grid — so the panel does not
 * visibly re-lay-out when the real record replaces it.
 */
function MemberDrawerSkeleton() {
  return (
    <div className="@container" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>

      {[0, 1, 2, 3].map((section) => (
        <div key={section} className="mt-6">
          <Skeleton className="h-3 w-24" />
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 @sm:grid-cols-2">
            {[0, 1, 2, 3].map((field) => (
              <div key={field} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
