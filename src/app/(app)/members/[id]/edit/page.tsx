import { notFound } from "next/navigation";

import { hasRole, requireRole } from "@/lib/rbac";
import { getMemberById } from "@/lib/members-query";
import { sanitizeCallbackUrl } from "@/lib/safe-redirect";
import { MemberFormPage } from "@/components/members/member-form-page";

export default async function EditMemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await requireRole("viewer");
  if (!hasRole(sessionUser.role, "editor")) {
    notFound();
  }

  const { id } = await params;
  const member = await getMemberById(id);
  if (!member) {
    notFound();
  }

  const { back } = await searchParams;
  const backHref = sanitizeCallbackUrl(
    typeof back === "string" ? back : undefined,
    `/members/${id}`,
  );

  return <MemberFormPage mode="edit" member={member} backHref={backHref} />;
}
