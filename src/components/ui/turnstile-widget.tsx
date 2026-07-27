"use client";

import * as React from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile widget.
 *
 * Renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, so the form
 * it sits in keeps working with the control switched off — see
 * `@/lib/turnstile` for why that switch exists.
 *
 * Exposes `reset()` through a ref because a Turnstile token is **single-use**:
 * after a failed submit the token is spent, and without a reset the member's
 * second attempt fails verification for a reason they cannot see or fix.
 */
export interface TurnstileHandle {
  reset: () => void;
}

export const TurnstileWidget = React.forwardRef<
  TurnstileHandle,
  { onToken: (token: string | null) => void; className?: string }
>(function TurnstileWidget({ onToken, className }, ref) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const holder = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
        onToken(null);
      }
    },
  }));

  React.useEffect(() => {
    if (!siteKey || !ready || !holder.current || widgetId.current) return;
    widgetId.current =
      window.turnstile?.render(holder.current, {
        sitekey: siteKey,
        // "auto" follows the page language; the public screens are bilingual
        // and members should see the challenge in a language they read.
        language: "auto",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      }) ?? null;

    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [siteKey, ready, onToken]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div ref={holder} className={className} />
    </>
  );
});
