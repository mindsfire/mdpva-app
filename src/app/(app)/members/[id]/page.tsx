import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { requireRole } from "@/lib/rbac";
import { getMemberById } from "@/lib/members-query";
import { Button } from "@/components/ui/button";
import { MemberProfilePageBody } from "@/components/members/member-profile-page-body";

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
      <Button variant="ghost" size="sm" render={<Link href="/" />}>
        <ArrowLeftIcon />
        Back to directory
      </Button>
      <div className="rounded-lg border border-mdpva-border bg-card p-4 dark:border-border">
        <MemberProfilePageBody member={member} role={sessionUser.role} />
      </div>
    </div>
  );
}
