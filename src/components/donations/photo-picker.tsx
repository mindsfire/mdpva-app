"use client";

import * as React from "react";
import { CameraIcon, ImageUpIcon, UserIcon } from "lucide-react";

import { CameraDialog } from "@/components/donations/camera-dialog";
import { PhotoCropper } from "@/components/onboard/photo-cropper";
import { Button } from "@/components/ui/button";
import { DONATION_PHOTO_ASPECT } from "@/lib/photo-constants";

/**
 * Upload or take the donor's photo, then position it in the card's frame.
 *
 * Phones get their own camera app through a capture input, which gives the
 * full camera. Anything else gets a live camera dialog, because desktop
 * browsers ignore `capture`. A page without `getUserMedia` (plain http) also
 * falls back to the input.
 */
export function PhotoPicker({
  currentSrc,
  error,
  onChange,
}: {
  /** The saved photo, shown until a new one is picked. */
  currentSrc: string | null;
  error?: string;
  onChange: (blob: Blob) => void;
}) {
  const uploadInput = React.useRef<HTMLInputElement>(null);
  const captureInput = React.useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [pickedUrl, setPickedUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (pickedUrl) URL.revokeObjectURL(pickedUrl);
    };
  }, [pickedUrl]);

  function openCamera() {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch || !navigator.mediaDevices?.getUserMedia) {
      captureInput.current?.click();
    } else {
      setCameraOpen(true);
    }
  }

  function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    // Cleared so picking the same file again still fires a change.
    event.target.value = "";
    if (picked) setFile(picked);
  }

  const src = pickedUrl ?? currentSrc;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Photo</span>
      <div className="flex items-center gap-4">
        <div
          className="flex w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-mdpva-border bg-muted dark:border-border"
          style={{ aspectRatio: DONATION_PHOTO_ASPECT }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob or auth-gated photo
            <img src={src} alt="Donor" className="size-full object-cover" />
          ) : (
            <UserIcon className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => uploadInput.current?.click()}
          >
            <ImageUpIcon />
            Upload photo
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={openCamera}
          >
            <CameraIcon />
            Take photo
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <input
        ref={uploadInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPicked}
      />
      <input
        ref={captureInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPicked}
      />

      <CameraDialog
        open={cameraOpen}
        onCancel={() => setCameraOpen(false)}
        onCaptured={(captured) => {
          setCameraOpen(false);
          setFile(captured);
        }}
      />
      <PhotoCropper
        file={file}
        open={file !== null}
        aspect={DONATION_PHOTO_ASPECT}
        description="Drag to move, pinch or use the slider to zoom. This is the frame on the card."
        onCancel={() => setFile(null)}
        onCropped={(blob) => {
          setFile(null);
          setPickedUrl(URL.createObjectURL(blob));
          onChange(blob);
        }}
      />
    </div>
  );
}
