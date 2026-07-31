"use client";

import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberSheet } from "@/components/members/member-sheet";
import { useIsNarrow } from "@/components/members/use-is-narrow";

/** Renders the modal sheet only below `lg`; above it the drawer takes over. */
export function MemberSheetNarrow(props: {
  member: MemberDetail | null;
  role: Role;
  initialWidth?: number;
}) {
  const isNarrow = useIsNarrow();
  if (!isNarrow) return null;
  return <MemberSheet {...props} />;
}
