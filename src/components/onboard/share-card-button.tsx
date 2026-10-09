"use client";

import * as React from "react";

import logo from "@/assets/brand/mdpva-logo.png";
import mindsfire from "@/assets/brand/mindsfire-logo.svg";
import { Bi } from "@/components/onboard/bilingual";
import { Button } from "@/components/ui/button";
import { STRINGS as S } from "@/lib/onboarding/i18n";
import { buildShareCardPng } from "@/lib/share-card/render";

const FILE_NAME = "mdpva-application.png";

function toFile(name: string): Promise<File> {
  return buildShareCardPng({ name }, logo.src, mindsfire.src).then(
    (blob) => new File([blob], FILE_NAME, { type: "image/png" }),
  );
}

/** The device doesn't change while the page is open, so nothing to subscribe to. */
function subscribeNever() {
  return () => {};
}

/** Touch device that can share files gets Share; everything else downloads. */
function deviceMode(): "share" | "download" {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const probe = new File([""], FILE_NAME, { type: "image/png" });
  const canShareFiles = Boolean(navigator.canShare?.({ files: [probe] }));
  return touch && canShareFiles ? "share" : "download";
}

/**
 * Saves the card as a file. The object URL is released after the click.
 */
function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILE_NAME;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * One button for the submitted application, and one action per device:
 *
 * - Phones and tablets that can share files get "Share", which opens the
 *   device's share sheet with the card attached (WhatsApp, Facebook,
 *   Instagram, and so on; on iPhone it also offers Save Image).
 * - Laptops and desktops get "Download image". The Mac and Windows share
 *   sheets don't offer a way to save, so a file download is what they need.
 *
 * Nothing is posted for the member, and nothing is stored.
 *
 * The card is built as soon as the screen mounts, not on tap. iPhone only
 * opens the share sheet from a direct tap, and a photo fetch between the tap
 * and `navigator.share` can lose that.
 */
export function ShareCardButton({ name }: { name: string }) {
  const mode = React.useSyncExternalStore(
    subscribeNever,
    deviceMode,
    () => "download" as const,
  );
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const pending = React.useRef<Promise<File> | null>(null);

  React.useEffect(() => {
    const built = toFile(name);
    built.catch(() => undefined); // Retried on tap if this fails.
    pending.current = built;
  }, [name]);

  async function getFile(): Promise<File> {
    if (pending.current) {
      try {
        return await pending.current;
      } catch {
        // Fall through and build it again.
      }
    }
    return toFile(name);
  }

  async function share() {
    setBusy(true);
    setError(false);
    try {
      const file = await getFile();
      await navigator.share({ files: [file], title: "MDPVA" });
    } catch (err) {
      // The member closing the share sheet isn't a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(false);
    try {
      download(await getFile());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const isShare = mode === "share";

  return (
    <div>
      <Button
        variant="outline"
        className="h-10 w-full"
        onClick={isShare ? share : save}
        disabled={busy}
      >
        <Bi s={isShare ? S.shareCard : S.downloadCard} sep="·" />
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-destructive">
          {S.shareCardFailed.en}
          <span className="font-kn mt-1 block">{S.shareCardFailed.kn}</span>
        </p>
      ) : null}
    </div>
  );
}
