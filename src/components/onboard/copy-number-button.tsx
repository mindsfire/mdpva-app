"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { STRINGS as S } from "@/lib/onboarding/i18n";

/**
 * Copies text to the clipboard. The async clipboard API only exists in secure
 * contexts, and the onboarding site is often opened over plain http on a LAN
 * address during testing, so fall back to selecting a hidden field and running
 * the older `execCommand` copy.
 */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the fallback.
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(field);
  return ok;
}

/** Icon button that copies the application number and briefly shows a tick. */
export function CopyNumberButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  async function onClick() {
    if (await copyText(value)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={S.copyNumber.en}
      title={S.copyNumber.en}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      {copied ? (
        <Check className="size-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
