"use client";

import * as React from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PASSPORT_ASPECT } from "@/lib/photo-constants";

/**
 * Passport crop, locked to 7:9.
 *
 * A raw phone photo is 4:3 or 3:4 and is never a passport photo, so without
 * this every one of ~1400 submissions would need cropping by hand at the
 * office. Touch drag and pinch-zoom come from the library, which matters —
 * most members will do this on a phone.
 *
 * The output here is a convenience only: the server re-crops to exact geometry
 * regardless (see `processPassportPhoto`), because a crafted request can post
 * anything.
 */
export function PhotoCropper({
  file,
  open,
  onCancel,
  onCropped,
}: {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [areaPixels, setAreaPixels] = React.useState<Area | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Object URLs are an external resource with an explicit lifetime — created
  // on mount of a new file, revoked on cleanup. That's the documented use for
  // an effect; deriving it during render would leak a URL on every re-render.
  React.useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external resource lifecycle, see above
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    // Reset framing for each new file rather than inheriting the last one's.
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = React.useCallback((_: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  async function apply() {
    if (!imageUrl || !areaPixels) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(imageUrl, areaPixels);
      if (blob) onCropped(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Position your photo</DialogTitle>
          <DialogDescription>
            Drag to move, pinch or use the slider to zoom. Keep your face inside
            the frame.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[320px] w-full overflow-hidden rounded-lg bg-black/80">
          {imageUrl ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={PASSPORT_ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
              restrictPosition
            />
          ) : null}
        </div>

        <label className="flex items-center gap-3 text-xs text-muted-foreground">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 cursor-pointer accent-[var(--color-mdpva-accent)]"
            aria-label="Zoom"
          />
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={apply} disabled={busy || !areaPixels}>
            {busy ? "…" : "Use this photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Longest edge of the uploaded crop.
 *
 * The server re-encodes to 600x771 regardless, so uploading the crop at source
 * resolution is pure waste. A 7:9 crop of a 12MP phone photo is ~2389x3072 and
 * encodes to ~5.8MB — which both blew past the server action body limit and
 * meant members on mobile data in Mysuru were uploading megabytes to produce a
 * ~40KB file.
 *
 * 1400 is comfortably above the 771 the server needs, so downscaling here
 * costs no visible quality.
 */
const MAX_UPLOAD_EDGE = 1400;

/**
 * Draws the selected region to a canvas and returns it as a WebP blob,
 * downscaled so the upload stays small.
 */
async function cropToBlob(src: string, area: Area): Promise<Blob | null> {
  const image = await loadImage(src);

  const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(area.width, area.height));
  const outW = Math.round(area.width * scale);
  const outH = Math.round(area.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Better downsampling than the default on large reductions.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outW,
    outH,
  );

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/webp", 0.85),
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = src;
  });
}
