"use client";

import * as React from "react";

import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberDrawer } from "@/components/members/member-drawer";
import { MemberDrawerNavProvider } from "@/components/members/member-drawer-nav";
import { useIsNarrow } from "@/components/members/use-is-narrow";

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
  // The drawer is desktop-only; below lg the modal sheet still runs, because
  // 384 + 480 doesn't fit under 864px. Gated with the hook (not a CSS class)
  // so it's genuinely not mounted below lg — otherwise its global keydown
  // listener fights the sheet for arrow keys/Escape on tablet.
  const isNarrow = useIsNarrow();

  return (
    <MemberDrawerNavProvider ids={ids} activeId={activeId}>
      <div ref={containerRef} className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        {activeId && !isNarrow ? (
          <MemberDrawer
            member={member}
            role={role}
            initialWidth={initialWidth}
            containerRef={containerRef}
          />
        ) : null}
      </div>
    </MemberDrawerNavProvider>
  );
}
