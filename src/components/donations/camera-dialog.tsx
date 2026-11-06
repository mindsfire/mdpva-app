"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Live camera for laptops and desktops, where a file input's `capture`
 * attribute is ignored and would only open the file picker. Phones use their
 * own camera app instead (see `PhotoPicker`).
 */
export function CameraDialog({
  open,
  onCancel,
  onCaptured,
}: {
  open: boolean;
  onCancel: () => void;
  onCaptured: (file: File) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>
            You can adjust the framing on the next step.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the camera light goes off on close. */}
        {open ? (
          <CameraView onCancel={onCancel} onCaptured={onCaptured} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CameraView({
  onCancel,
  onCaptured,
}: {
  onCancel: () => void;
  onCaptured: (file: File) => void;
}) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;

    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((granted) => {
        if (stopped) {
          granted.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = granted;
        if (video.current) video.current.srcObject = granted;
      })
      .catch(() => setFailed(true));

    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capture() {
    const el = video.current;
    if (!el) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext("2d")?.drawImage(el, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCaptured(new File([blob], "camera.jpg", { type: "image/jpeg" }));
        }
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <>
      {failed ? (
        <p className="rounded-lg border border-mdpva-border p-4 text-sm text-muted-foreground dark:border-border">
          The camera couldn&apos;t be opened. Allow camera access in your
          browser, or upload a photo instead.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg bg-black">
          <video
            ref={video}
            autoPlay
            muted
            playsInline
            onLoadedMetadata={() => setReady(true)}
            className="aspect-video w-full object-cover"
          />
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={capture} disabled={!ready}>
          Capture
        </Button>
      </DialogFooter>
    </>
  );
}
