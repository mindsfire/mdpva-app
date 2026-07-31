import { notFound } from "next/navigation";

import { requireRole } from "@/lib/rbac";
import { getMemberById } from "@/lib/members-query";
import { MemberProfilePageBody } from "@/components/members/member-profile-page-body";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { fullName } from "@/lib/member-name";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireRole("viewer");
  const { id } = await params;
  const member = await getMemberById(id);

  if (!member) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Members", href: "/members" },
          { label: fullName(member.firstName, member.lastName) },
        ]}
      />
      <div className="rounded-lg border border-mdpva-border bg-card p-4 sm:p-5 dark:border-border">
        <MemberProfilePageBody member={member} role={sessionUser.role} />
      </div>
    </div>
  );
}
