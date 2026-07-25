"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { MemberForm } from "@/components/members/member-form";
import { Button } from "@/components/ui/button";
import type { MemberDetail } from "@/lib/members-query";

/**
 * Full-page host for the create/edit form. `backHref` is where Cancel and
 * the back link go — the directory page passes its own filtered URL
 * through so returning doesn't lose the operator's search context.
 */
export function MemberFormPage({
  mode,
  member,
  backHref,
}: {
  mode: "create" | "edit";
  member?: MemberDetail | null;
  backHref: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 self-start text-muted-foreground"
          render={<Link href={backHref} />}
        >
          <ArrowLeftIcon />
          Back
        </Button>
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            {mode === "create" ? "Add member" : "Edit member"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "create"
              ? "A member ID is generated automatically once you save."
              : `${member?.firstName} ${member?.lastName} · ${member?.memberId}`}
          </p>
        </div>
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
