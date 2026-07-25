"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { resetUserPassword } from "@/app/actions/users";
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
import { TempPasswordReveal } from "@/components/users/temp-password-reveal";

/**
 * Controlled from the parent (no `DialogTrigger`) so the trigger can be a
 * `DropdownMenuItem` — nesting a `DialogTrigger` inside an open/close menu
 * item races the menu's own close-on-select behavior.
 */
export function ResetPasswordDialog({
  userId,
  email,
  open,
  onOpenChange,
}: {
  userId: string;
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isResetting, setIsResetting] = React.useState(false);
  const [tempPassword, setTempPassword] = React.useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTimeout(() => setTempPassword(null), 150);
    }
  }

  async function handleReset() {
    setIsResetting(true);
    try {
      const result = await resetUserPassword(userId);
      if (!result.ok) {
        toast.error(result.error ?? "Could not reset password.");
        return;
      }
      setTempPassword(result.tempPassword);
      router.refresh();
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {tempPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Password reset</DialogTitle>
              <DialogDescription>
                New temporary password for {email}:
              </DialogDescription>
            </DialogHeader>
            <TempPasswordReveal password={tempPassword} />
            <DialogFooter>
              <DialogClose render={<Button type="button" />}>
                Done
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset password for {email}?</DialogTitle>
              <DialogDescription>
                Issues a new temporary password and signs the user out of
                every existing session. They must change it on next login.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button disabled={isResetting} onClick={handleReset}>
                {isResetting ? "Resetting…" : "Reset password"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
