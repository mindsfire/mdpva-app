"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { deleteDonation } from "@/app/actions/donations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteDonationButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function confirm() {
    setDeleting(true);
    try {
      const result = await deleteDonation(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Donation deleted.");
      router.push("/donations");
      router.refresh();
    } catch {
      toast.error("That didn't delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="h-10" onClick={() => setOpen(true)}>
        <Trash2Icon />
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this donation?</DialogTitle>
            <DialogDescription>
              {name}&apos;s entry and photo will be removed. This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
