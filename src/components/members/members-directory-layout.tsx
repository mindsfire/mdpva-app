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
        className="flex items-start gap-4"
        // Only set while the drawer is open. The drawer's width reads it, and
        // the resizer writes it, so a drag moves the panel and the column it
        // leaves for the table together without a re-render.
        style={
          showDrawer
            ? ({
                [DRAWER_WIDTH_VAR]: `${clampPeekWidth(initialWidth ?? PEEK_MIN_WIDTH)}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {/* The page heading, its Export/Add buttons and the filter row live
            inside this column, not above it — so opening the drawer hands the
            whole right-hand strip over, top to bottom, and closing it returns
            them to full width. */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">{children}</div>
        {showDrawer ? (
          <MemberDrawer
            member={member}
            role={role}
            containerRef={containerRef}
          />
        ) : null}
      </div>
    </MemberDrawerNavProvider>
  );
}
