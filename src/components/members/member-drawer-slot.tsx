"use client";

import * as React from "react";

import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberDrawer } from "@/components/members/member-drawer";
import { useMemberDrawerNav } from "@/components/members/member-drawer-nav";
import { useIsNarrow } from "@/components/members/use-is-narrow";

/**
 * Decides whether the docked drawer is on screen.
 *
 * Reads the *optimistic* selection from the nav context rather than the URL,
 * so a click mounts the panel in the same frame instead of after the server
 * round-trip, and closing removes it immediately — closing needs no data, and
 * waiting on a fetch to do it was the strangest part of the old behaviour.
 *
 * Separate from MembersDirectoryLayout because that component renders the
 * provider and so cannot consume its context.
 */
export function MemberDrawerSlot({
  member,
  role,
  containerRef,
}: {
  member: MemberDetail | null;
  role: Role;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { activeId } = useMemberDrawerNav();
  // Below lg the modal sheet handles this. Gated with the hook (not a CSS
  // class) so the drawer is genuinely not mounted there — otherwise its
  // global keydown listener fights the sheet for arrow keys and Escape.
  const isNarrow = useIsNarrow();

  if (!activeId || isNarrow) return null;

  return (
    <MemberDrawer
      // Remount on selection change so the panel scrolls back to the top:
      // stepping from a long record to a short one otherwise leaves you
      // partway down a member you have not seen the start of.
      key={activeId}
      member={member?.id === activeId ? member : null}
      role={role}
      containerRef={containerRef}
    />
  );
}
