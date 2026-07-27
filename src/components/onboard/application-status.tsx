"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { endOnboardSessionAction } from "@/app/actions/onboard";
import { Button } from "@/components/ui/button";
import { STRINGS as S } from "@/lib/onboarding/i18n";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export interface StatusProps {
  applicationNo: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  onEdit: () => void;
}

/**
 * What a returning member sees after verifying, when they already have an
 * application on file.
 *
 * This exists because without it the flow is actively misleading: a member who
 * submits, comes back, and is handed a blank form has no way to tell whether
 * their details ever arrived — so they submit again, and again. Showing the
 * application number and its state is the only feedback channel available,
 * since MDPVA has no way to email or message them.
 */
export function ApplicationStatus({
  applicationNo,
  status,
  submittedAt,
  reviewedAt,
  rejectionReason,
  onEdit,
}: StatusProps) {
  const router = useRouter();

  const copy = {
    pending: {
      title: S.statusPendingTitle,
      body: S.statusPendingBody,
      tone: "bg-mdpva-gold/20 border-mdpva-gold/40",
    },
    approved: {
      title: S.statusApprovedTitle,
      body: S.statusApprovedBody,
      tone: "bg-emerald-500/10 border-emerald-500/30",
    },
    rejected: {
      title: S.statusRejectedTitle,
      body: S.statusRejectedBody,
      tone: "bg-destructive/10 border-destructive/30",
    },
  }[status];

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-14">
      <p className="text-xs font-medium tracking-[0.2em] text-mdpva-accent uppercase">
        MDPVA
      </p>
      <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-foreground">
        {copy.title.en}
      </h1>
      <p className="font-kn mt-1 text-lg text-muted-foreground">
        {copy.title.kn}
      </p>

      <div className={cn("mt-6 rounded-lg border px-5 py-5 text-center", copy.tone)}>
        <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
          {S.applicationNo.en}
        </p>
        <p className="mt-1.5 font-serif text-2xl font-medium tracking-wide text-foreground tabular-nums">
          {applicationNo}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Submitted {dateFmt.format(submittedAt)}
          {reviewedAt ? ` · reviewed ${dateFmt.format(reviewedAt)}` : ""}
        </p>
      </div>

      {rejectionReason ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.12em] text-destructive uppercase">
            {S.reasonGiven.en} · <span className="font-kn">{S.reasonGiven.kn}</span>
          </p>
          <p className="mt-1.5 text-sm text-destructive">{rejectionReason}</p>
        </div>
      ) : null}

      <p className="mt-5 text-sm text-muted-foreground">
        {copy.body.en}
        <span className="font-kn mt-1.5 block">{copy.body.kn}</span>
      </p>

      <Button className="mt-7 h-10 w-full" onClick={onEdit}>
        {status === "rejected" ? (
          <>
            {S.fixAndResubmit.en} ·{" "}
            <span className="font-kn">{S.fixAndResubmit.kn}</span>
          </>
        ) : (
          <>
            {S.updateDetails.en} ·{" "}
            <span className="font-kn">{S.updateDetails.kn}</span>
          </>
        )}
      </Button>

      <Button
        variant="outline"
        className="mt-2.5 h-10 w-full"
        onClick={async () => {
          await endOnboardSessionAction();
          router.push("/onboard");
        }}
      >
        {S.done.en} · <span className="font-kn">{S.done.kn}</span>
      </Button>
    </main>
  );
}
