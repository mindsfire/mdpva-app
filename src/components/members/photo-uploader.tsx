"use client";

import * as React from "react";
import { ImageIcon, Loader2Icon, TrashIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { uploadMemberPhoto, removeMemberPhoto } from "@/app/actions/photo";
import { Button } from "@/components/ui/button";

/**
 * Photos are keyed by member id (`app/members/<id>.webp`), so upload is
 * only available once the member exists — a new/unsaved member has
 * nothing to key the object to. `onPhotoChange` lets the caller refresh
 * its local `photoKey` without a full page reload.
 */
/**
 * Render with `key={memberId}` from the parent so switching between two
 * members' forms remounts this (and resets local preview state) instead
 * of reusing a stale instance.
 */
export function PhotoUploader({
  memberId,
  photoKey,
  onPhotoChange,
}: {
  memberId?: string;
  photoKey: string | null;
  onPhotoChange?: (photoKey: string | null) => void;
}) {
  const [isBusy, setIsBusy] = React.useState(false);
  // No cache-buster on the initial URL (pure render) — the serving route's
  // Cache-Control is short enough that this is fine. handleFile/handleRemove
  // append one after a mutation, from an event handler, to force a fresh
  // fetch immediately.
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(
    photoKey ? `/api/photos/${photoKey}` : null,
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  if (!memberId) {
    return (
      <div
        aria-disabled="true"
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-mdpva-border bg-muted/30 px-4 py-8 text-center text-muted-foreground dark:border-border"
      >
        <ImageIcon className="size-6" aria-hidden="true" />
        <p className="text-sm">Save the member first, then add a photo.</p>
      </div>
    );
  }

  async function handleFile(file: File) {
    setIsBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadMemberPhoto(memberId!, formData);
      if (!result.ok) {
        toast.error(result.error ?? "Could not upload that photo.");
        return;
      }
      setPreviewUrl(`/api/photos/${result.photoKey}?v=${Date.now()}`);
      onPhotoChange?.(result.photoKey ?? null);
      toast.success("Photo updated.");
    } finally {
      setIsBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setIsBusy(true);
    try {
      const result = await removeMemberPhoto(memberId!);
      if (!result.ok) {
        toast.error(result.error ?? "Could not remove the photo.");
        return;
      }
      setPreviewUrl(null);
      onPhotoChange?.(null);
      toast.success("Photo removed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-mdpva-border bg-mdpva-white p-3 dark:border-border dark:bg-card">
      <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-mdpva-gold/70">
        {previewUrl ? (
          // Freshly uploaded/removed state needs an immediate, cache-busted
          // repaint that a Next <Image> would fight; a plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Member photo" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium">Profile photo</p>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, or WebP. Resized automatically, 8 MB max.
        </p>
        <div className="mt-1 flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
          >
            {isBusy ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            {previewUrl ? "Replace" : "Upload"}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={handleRemove}
            >
              <TrashIcon />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
