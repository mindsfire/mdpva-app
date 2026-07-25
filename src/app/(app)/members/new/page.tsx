import { notFound } from "next/navigation";

import { hasRole, requireRole } from "@/lib/rbac";
import { sanitizeCallbackUrl } from "@/lib/safe-redirect";
import { MemberFormPage } from "@/components/members/member-form-page";

export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await requireRole("viewer");
  if (!hasRole(sessionUser.role, "editor")) {
    notFound();
  }

  const { back } = await searchParams;
  const backHref = sanitizeCallbackUrl(
    typeof back === "string" ? back : undefined,
    "/members",
  );

  return <MemberFormPage mode="create" backHref={backHref} />;
}
