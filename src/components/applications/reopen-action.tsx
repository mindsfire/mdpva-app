"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { reopenApplicationForResubmit } from "@/app/actions/applications";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Reopens an approved or rejected application for resubmission.
 *
 * The only lever for this is flipping the application's status to
 * "rejected" (see `reopenApplicationForResubmit` / `canResubmit`), so this
 * mirrors `ReviewActions`' reject dialog exactly: a typed reason is
 * required, since it's the only way the member learns what changed.
 *
 * Used both as an icon-only row action in the queue table and as a labelled
 * button on the application detail page — `iconOnly` switches between them
 * so the two call sites don't duplicate the dialog.
 */
export function ReopenForResubmitAction({
  applicationId,
  applicationNo,
  iconOnly = false,
}: {
  applicationId: string;
  applicationNo: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onConfirm() {
    setPending(true);
    try {
      const result = await reopenApplicationForResubmit(applicationId, reason);
      if (!result.ok) {
        toast.error(result.error ?? "Could not reopen this application.");
        return;
      }
      toast.success(`${applicationNo} reopened — the member can resubmit now.`);
      setOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {iconOnly ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Reopen ${applicationNo} for resubmission`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <RotateCcwIcon />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <RotateCcwIcon />
          Initiate for resubmit
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Reopen {applicationNo} for resubmission?</DialogTitle>
            <DialogDescription>
              The member will be able to submit a new application through the
              onboarding form. They see this reason on their status page.
              Their current directory record is unaffected until you approve
              the new submission.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Please resubmit with an updated address."
            className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>No</DialogClose>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={pending || reason.trim().length === 0}
            >
              {pending ? "…" : "Yes, reopen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
