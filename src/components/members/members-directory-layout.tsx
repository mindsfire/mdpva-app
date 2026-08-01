"use client";

import * as React from "react";

import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberDrawer } from "@/components/members/member-drawer";
import { MemberDrawerNavProvider } from "@/components/members/member-drawer-nav";
import { useIsNarrow } from "@/components/members/use-is-narrow";
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
  // The drawer is desktop-only; below lg the modal sheet still runs, because
  // 384 + 480 doesn't fit under 864px. Gated with the hook (not a CSS class)
  // so it's genuinely not mounted below lg — otherwise its global keydown
  // listener fights the sheet for arrow keys/Escape on tablet.
  const isNarrow = useIsNarrow();
  const showDrawer = !!activeId && !isNarrow;

  return (
    <MemberDrawerNavProvider ids={ids} activeId={activeId}>
      <div
        ref={containerRef}
        className="relative"
        // Only set while the drawer is open: the table's right margin reads
        // this variable and must fall back to 0 when there's no panel to
        // scroll clear of.
        style={
          showDrawer
            ? ({
                [DRAWER_WIDTH_VAR]: `${clampPeekWidth(initialWidth ?? PEEK_MIN_WIDTH)}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {children}
        {showDrawer ? (
          // The drawer floats above the table rather than sitting beside it,
          // so the list keeps its full width and reads as a whole surface with
          // a panel resting on top. `pointer-events-none` on the wrapper means
          // only the panel itself intercepts clicks — the strip of table below
          // it stays clickable. The table gets a matching right margin (see
          // MemberTable) so every column can still be scrolled clear of the
          // panel; nothing is permanently hidden underneath it.
          <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-(--member-drawer-width)">
            <MemberDrawer
              member={member}
              role={role}
              containerRef={containerRef}
            />
          </div>
        ) : null}
      </div>
    </MemberDrawerNavProvider>
  );
}
