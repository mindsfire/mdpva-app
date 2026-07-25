"use client";

import { useRouter } from "next/navigation";

import type { Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";
import { MemberProfileView } from "@/components/members/member-profile-view";

export function MemberProfilePageBody({
  member,
  role,
}: {
  member: MemberDetail;
  role: Role;
}) {
  const router = useRouter();

  return (
    <MemberProfileView
      member={member}
      role={role}
      editHref={`/members/${member.id}/edit`}
      onDeleted={() => router.push("/members")}
    />
  );
}
