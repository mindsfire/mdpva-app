"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function TempPasswordReveal({ password }: { password: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Password copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy password.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-mdpva-border bg-muted/40 px-3 py-2 dark:border-border">
        <code className="flex-1 font-mono text-base tracking-wide text-foreground select-all">
          {password}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={handleCopy}
          aria-label="Copy password"
        >
          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
        </Button>
      </div>
      <p className="rounded-lg border border-mdpva-gold/50 bg-mdpva-gold/10 px-3 py-2 text-sm text-mdpva-accent dark:text-mdpva-gold">
        This password is shown only once and cannot be retrieved later. Share
        it with the user securely — they must change it on first login.
      </p>
    </div>
  );
}
