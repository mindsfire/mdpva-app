"use client";

import { useRouter } from "next/navigation";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MemberForm } from "@/components/members/member-form";
import { fullName } from "@/lib/member-name";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { hasRole, type Role } from "@/lib/rbac";
import type { MemberDetail } from "@/lib/members-query";

/**
 * Full-page host for the create/edit form. `backHref` is where Cancel
 * goes — the directory passes its own filtered URL through so returning
 * doesn't lose the operator's search context (the breadcrumb, by
 * contrast, always points at the canonical unfiltered routes).
 */
export function MemberFormPage({
  mode,
  member,
  role,
  backHref,
}: {
  mode: "create" | "edit";
  member?: MemberDetail | null;
  role: Role;
  backHref: string;
}) {
  const router = useRouter();
  // Available for every member being edited, same admin gate as the member
  // profile view's download button — there is nothing to download yet on
  // the create form, since the member doesn't exist until it's saved.
  const canDownload = mode === "edit" && hasRole(role, "admin") && Boolean(member);

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb
        items={
          mode === "create"
            ? [
                { label: "Dashboard", href: "/" },
                { label: "Members", href: "/members" },
                { label: "Add member" },
              ]
            : [
                { label: "Dashboard", href: "/" },
                { label: "Members", href: "/members" },
                {
                  label: fullName(member?.firstName),
                  href: `/members/${member?.id}`,
                },
                { label: "Edit" },
              ]
        }
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            {mode === "create" ? "Add member" : "Edit member"}
          </h1>
          {/* Nothing under the heading when creating: the generated id is no
              longer surfaced in the UI, so explaining it only raised a question
              the form does not answer. */}
          {mode === "create" ? null : (
            <p className="mt-1 text-sm text-muted-foreground">
              {fullName(member?.firstName)}
            </p>
          )}
        </div>
        {canDownload ? (
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/api/members/${member?.id}/pdf`} />}
          >
            <DownloadIcon />
            Download application
          </Button>
        ) : null}
      </div>

      <MemberForm
        mode={mode}
        member={member}
        onCancel={() => router.push(backHref)}
        onSuccess={(result) => router.push(`/members/${result.id}`)}
      />
    </div>
  );
}
