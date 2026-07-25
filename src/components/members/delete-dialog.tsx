"use client";

import * as React from "react";
import { toast } from "sonner";

import { softDeleteMember } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteMemberDialog({
  memberId,
  name,
  onDeleted,
  trigger,
}: {
  memberId: string;
  name: string;
  onDeleted?: () => void;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await softDeleteMember(memberId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete member.");
        return;
      }
      toast.success(`${name} deleted.`);
      setOpen(false);
      onDeleted?.();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            This removes {name} from the directory. This can be reversed by
            an administrator directly in the database, but there is no undo
            in the app.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
