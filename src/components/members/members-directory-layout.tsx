"use client";

import * as React from "react";

import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberDrawerNavProvider } from "@/components/members/member-drawer-nav";
import { MemberDrawerSlot } from "@/components/members/member-drawer-slot";
import { DRAWER_WIDTH_VAR } from "@/components/members/sheet-resizer";
import { clampPeekWidth, PEEK_MIN_WIDTH } from "@/lib/peek-prefs";

/**
 * Desktop directory shell: results on the left, drawer docked right.
 *
 * Exists as a client component only because the resizer needs a ref to the
 * row that bounds it — the table and rows inside `children` stay server
 * components.
 */
export function MembersDirectoryLayout({
  ids,
  activeId,
  member,
  role,
  initialWidth,
  children,
}: {
  ids: string[];
  activeId: string | null;
  member: MemberDetail | null;
  role: Role;
  initialWidth?: number;
  children: React.ReactNode;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <MemberDrawerNavProvider ids={ids} activeId={activeId}>
      <div
        ref={containerRef}
        className="flex items-start gap-4"
        // Always set, not just while the drawer is open: MemberDrawerSlot
        // mounts the panel optimistically on click, before this component's
        // `activeId` prop catches up, and a panel sized off a variable that
        // did not exist yet would flash at the wrong width.
        style={
          {
            [DRAWER_WIDTH_VAR]: `${clampPeekWidth(initialWidth ?? PEEK_MIN_WIDTH)}px`,
          } as React.CSSProperties
        }
      >
        {/* The page heading, its Export/Add buttons and the filter row live
            inside this column, not above it — so opening the drawer hands the
            whole right-hand strip over, top to bottom, and closing it returns
            them to full width. */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
        <MemberDrawerSlot
          member={member}
          role={role}
          containerRef={containerRef}
        />
      </div>
    </MemberDrawerNavProvider>
  );
}
