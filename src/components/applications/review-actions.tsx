"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import {
  approveApplication,
  rejectApplication,
} from "@/app/actions/applications";
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
 * Approve / reject for a single application.
 *
 * Rejection requires a typed reason rather than offering a one-click reject:
 * the member has no other channel to find out what went wrong, so a bare
 * rejection would send them to the office — the exact trip this feature
 * exists to save.
 */
export function ReviewActions({
  applicationId,
  applicationNo,
}: {
  applicationId: string;
  applicationNo: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  async function onApprove() {
    setPending(true);
    try {
      const result = await approveApplication(applicationId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not approve.");
        router.refresh();
        return;
      }
      toast.success(`${applicationNo} approved — member record updated.`);
      router.push("/applications");
    } finally {
      setPending(false);
    }
  }

  async function onReject() {
    setPending(true);
    try {
      const result = await rejectApplication(applicationId, reason);
      if (!result.ok) {
        toast.error(result.error ?? "Could not reject.");
        return;
      }
      toast.success(`${applicationNo} rejected.`);
      setRejectOpen(false);
      router.push("/applications");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setRejectOpen(true)}
          disabled={pending}
        >
          <XIcon />
          Reject
        </Button>
        <Button size="sm" onClick={onApprove} disabled={pending}>
          <CheckIcon />
          {pending ? "…" : "Approve"}
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {applicationNo}?</DialogTitle>
            <DialogDescription>
              The member sees this reason on the status page — it&apos;s the only
              way they learn what to fix.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. The photograph is blurred — please upload a clearer one."
            className="w-full rounded-lg bg-muted/50 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={onReject}
              disabled={pending || reason.trim().length === 0}
            >
              {pending ? "…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
