"use client";

import * as React from "react";
import { DownloadIcon, RefreshCwIcon, Share2Icon } from "lucide-react";

import template from "@/assets/donation/card-template.png";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildDonationCard } from "@/lib/share-card/donation";

/** The device doesn't change while the page is open, so nothing to subscribe to. */
function subscribeNever() {
  return () => {};
}

function canShareFiles() {
  const probe = new File([""], "card.jpg", { type: "image/jpeg" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  return touch && Boolean(navigator.canShare?.({ files: [probe] }));
}

/** Keeps the donor's name, in either script, readable in the Downloads folder. */
function fileNameFor(name: string) {
  const slug = name.trim().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-");
  return `MDPVA Donation ${slug}.jpg`;
}

type Card = { file: File; url: string };

/**
 * The finished card, with Download everywhere and Share on phones.
 *
 * Built when the screen opens rather than on tap: iPhone only opens the share
 * sheet from a direct tap, and building the card first can lose that.
 */
export function DonationCard({
  name,
  businessName,
  amount,
  photoUrl,
}: {
  name: string;
  businessName: string | null;
  amount: number;
  photoUrl: string;
}) {
  const [card, setCard] = React.useState<Card | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const shareable = React.useSyncExternalStore(
    subscribeNever,
    canShareFiles,
    () => false,
  );

  React.useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    buildDonationCard({ name, businessName, amount, photoUrl }, template.src)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({
          url,
          file: new File([blob], fileNameFor(name), { type: "image/jpeg" }),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [name, businessName, amount, photoUrl, attempt]);

  function download() {
    if (!card) return;
    const a = document.createElement("a");
    a.href = card.url;
    a.download = card.file.name;
    a.click();
  }

  async function share() {
    if (!card) return;
    try {
      await navigator.share({ files: [card.file], title: "MDPVA" });
    } catch (err) {
      // Closing the share sheet isn't a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFailed(true);
    }
  }

  if (failed) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-mdpva-border p-4 text-sm dark:border-border">
        <p className="text-destructive">The card couldn&apos;t be created.</p>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            setCard(null);
            setAttempt((n) => n + 1);
          }}
        >
          <RefreshCwIcon />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {card ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob, not an optimisable image
        <img
          src={card.url}
          alt={`Donation card for ${name}`}
          width={1296}
          height={1013}
          className="h-auto w-full rounded-lg border border-mdpva-border dark:border-border"
        />
      ) : (
        <Skeleton className="aspect-[1296/1013] w-full rounded-lg" />
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="h-10 sm:flex-1" onClick={download} disabled={!card}>
          <DownloadIcon />
          Download image
        </Button>
        {shareable ? (
          <Button
            variant="outline"
            className="h-10 sm:flex-1"
            onClick={share}
            disabled={!card}
          >
            <Share2Icon />
            Share
          </Button>
        ) : null}
      </div>
    </div>
  );
}
