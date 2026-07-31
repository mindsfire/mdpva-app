import sharp from "sharp";

import {
  MAX_UPLOAD_BYTES,
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
  const pipeline = sharp(buf, { failOn: "error" })
    .rotate()
    .resize(PASSPORT_WIDTH, PASSPORT_HEIGHT, {
      fit: "cover",
      position: "attention",
      withoutEnlargement: true,
    })
    .webp({ quality: PASSPORT_QUALITY });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
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
