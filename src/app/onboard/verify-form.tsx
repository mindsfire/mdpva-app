"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { confirmMemberAction, verifyMemberAction } from "@/app/actions/onboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STRINGS as S } from "@/lib/onboarding/i18n";

export function VerifyForm() {
  const router = useRouter();
  const [ledgerId, setLedgerId] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<"no_match" | "rate_limited" | null>(
    null,
  );
  const [confirming, setConfirming] = React.useState<{
    displayName: string;
    token: string;
  } | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await verifyMemberAction(ledgerId, phone);
      if (!result.ok || !result.pendingToken) {
        setError(result.error ?? "no_match");
        return;
      }
      // No session exists yet — the member confirms the name is theirs first.
      setConfirming({
        displayName: result.displayName ?? "",
        token: result.pendingToken,
      });
    } finally {
      setPending(false);
    }
  }

  async function onConfirm() {
    if (!confirming) return;
    setPending(true);
    try {
      const result = await confirmMemberAction(confirming.token);
      if (!result.ok) {
        // Token expired while they were deciding — start over.
        setConfirming(null);
        setError("no_match");
        return;
      }
      router.push("/onboard/form");
    } finally {
      setPending(false);
    }
  }

  if (confirming !== null) {
    return (
      <div className="mt-8 flex flex-col gap-5">
        <div className="rounded-lg border border-mdpva-border bg-card px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            {S.foundYou.en} <span className="font-kn">{S.foundYou.kn}</span>
          </p>
          <p className="mt-1.5 font-serif text-2xl font-medium text-foreground">
            {confirming.displayName}
          </p>
        </div>
        <Button className="h-10 w-full" onClick={onConfirm} disabled={pending}>
          {S.yesContinue.en} · <span className="font-kn">{S.yesContinue.kn}</span>
        </Button>
        <Button
          variant="outline"
          className="h-10 w-full"
          disabled={pending}
          onClick={() => {
            // Nothing to revoke — no capability was ever granted.
            setConfirming(null);
            setLedgerId("");
            setPhone("");
          }}
        >
          {S.noGoBack.en} · <span className="font-kn">{S.noGoBack.kn}</span>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="v-no" className="flex items-baseline gap-1.5 text-sm">
          {S.membershipNo.en}{" "}
          <span className="font-kn text-xs text-muted-foreground">
            {S.membershipNo.kn}
          </span>
        </label>
        <Input
          id="v-no"
          inputMode="numeric"
          autoComplete="off"
          placeholder="417"
          value={ledgerId}
          onChange={(e) => setLedgerId(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {S.membershipHint.en}
          <span className="font-kn mt-0.5 block">{S.membershipHint.kn}</span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="v-phone" className="flex items-baseline gap-1.5 text-sm">
          {S.phone.en}{" "}
          <span className="font-kn text-xs text-muted-foreground">
            {S.phone.kn}
          </span>
        </label>
        <Input
          id="v-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98450 11234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {error === "rate_limited" ? S.rateLimited.en : S.verifyFailed.en}
          <span className="font-kn mt-1.5 block">
            {error === "rate_limited" ? S.rateLimited.kn : S.verifyFailed.kn}
          </span>
        </p>
      ) : null}

      <Button type="submit" className="mt-1 h-10 w-full" disabled={pending}>
        {pending ? "…" : S.continue.en} ·{" "}
        <span className="font-kn">{S.continue.kn}</span>
      </Button>
    </form>
  );
}
