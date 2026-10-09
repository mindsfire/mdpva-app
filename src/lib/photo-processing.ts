import sharp from "sharp";

import {
  MAX_UPLOAD_BYTES,
  PASSPORT_ASPECT,
  PASSPORT_HEIGHT,
  PASSPORT_WIDTH,
} from "@/lib/photo-constants";

// Re-exported so existing server-side callers keep their import path; client
// components must import from `@/lib/photo-constants` directly, since this
// module pulls in `sharp`.
export { MAX_UPLOAD_BYTES };

const MAX_EDGE = 1200;
const WEBP_QUALITY = 82;

const SIGNATURES: { mime: string; check: (buf: Buffer) => boolean }[] = [
  { mime: "image/jpeg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    check: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    check: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/**
 * Sniffs the actual file bytes (never trusts the extension or the
 * browser-supplied Content-Type) to confirm this is one of the raster
 * formats we accept.
 */
export function sniffImageType(buf: Buffer): string | null {
  return SIGNATURES.find((s) => s.check(buf))?.mime ?? null;
}

export interface ProcessedPhoto {
  webp: Buffer;
  width: number;
  height: number;
}

const PASSPORT_QUALITY = 80;

/**
 * Crops and re-encodes an uploaded image to exact passport geometry.
 *
 * Runs *regardless* of whether the browser already cropped. The client-side
 * cropper is a convenience for the member, never a trust boundary — a crafted
 * request can post any bytes it likes, so the server decides the final
 * geometry.
 *
 * `fit: "cover"` guarantees exact 7:9 output whatever arrives.
 * `position: "attention"` makes the fallback crop (for an image that arrives
 * uncropped) centre on the most salient region rather than the geometric
 * middle — meaningfully better for faces.
 */
export async function processPassportPhoto(buf: Buffer): Promise<ProcessedPhoto> {
  const pipeline = sharp(buf, { failOn: "error" })
    .rotate() // apply EXIF orientation, then strip it
    .resize(PASSPORT_WIDTH, PASSPORT_HEIGHT, {
      fit: "cover",
      position: "attention",
      withoutEnlargement: false,
    })
    .webp({ quality: PASSPORT_QUALITY });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { webp: data, width: info.width, height: info.height };
}

/**
 * Passport crop for photos recovered from the legacy paper ledger.
 *
 * Identical to `processPassportPhoto` except that it never enlarges. Those
 * scans are all far below the passport target (median 161x206 against
 * 600x771), so `withoutEnlargement: false` would upscale them ~3.7x and make
 * every face soft. The stored image keeps the 7:9 ratio the UI lays out for,
 * just at its native size; a member replacing their photo through onboarding
 * gets a full-resolution one.
 */
export async function processLegacyPhoto(buf: Buffer): Promise<ProcessedPhoto> {
  const rotated = await sharp(buf, { failOn: "error" }).rotate().toBuffer();
  const { width, height } = await sharp(rotated).metadata();
  if (!width || !height) throw new Error("could not read image dimensions");

  // The target must be computed from the source, not fixed at 600x771 with
  // `withoutEnlargement`: sharp skips the whole resize when the requested box
  // is larger than the source, and skipping the resize skips the crop too —
  // which silently stored every ledger photo at its original aspect ratio.
  let targetW = Math.min(width, Math.round(height * PASSPORT_ASPECT));
  let targetH = Math.round(targetW / PASSPORT_ASPECT);
  if (targetH > height) {
    targetH = height;
    targetW = Math.round(targetH * PASSPORT_ASPECT);
  }
  // Never exceed the passport geometry; a source larger than that is downscaled.
  if (targetW > PASSPORT_WIDTH) {
    targetW = PASSPORT_WIDTH;
    targetH = PASSPORT_HEIGHT;
  }

  const { data, info } = await sharp(rotated)
    .resize(targetW, targetH, { fit: "cover", position: "attention" })
    .webp({ quality: PASSPORT_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { webp: data, width: info.width, height: info.height };
}

/**
 * Re-encodes any accepted raster image to WebP, downscaled to fit within
 * MAX_EDGE×MAX_EDGE (never upscaled, aspect ratio preserved, never
 * cropped). Throws if `sharp` can't decode the buffer as a real image —
 * a second line of defense beyond the magic-byte sniff.
 */
export async function processPhoto(buf: Buffer): Promise<ProcessedPhoto> {
  const pipeline = sharp(buf, { failOn: "error" })
    .rotate() // apply EXIF orientation, then strip it
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { webp: data, width: info.width, height: info.height };
}

/**
 * Longest edge of the small rendition stored beside every photo. Avatars and
 * list rows draw the photo at 24–48 CSS px; 240 covers that at 3x density and
 * still lands around 5–10 KB, against 25–60 KB+ for the full photo.
 */
export const THUMB_MAX_EDGE = 240;
const THUMB_QUALITY = 75;

/**
 * Downscales a stored photo to its thumbnail. Aspect ratio is kept (never
 * cropped), so `object-cover` frames the thumbnail exactly as it frames the
 * full photo it stands in for.
 */
export async function makeThumbnail(buf: Buffer): Promise<Buffer> {
  return sharp(buf, { failOn: "error" })
    .resize({
      width: THUMB_MAX_EDGE,
      height: THUMB_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}
