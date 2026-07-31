import { describe, expect, it } from "vitest";
import sharp from "sharp";

import {
  MAX_UPLOAD_BYTES,
  processLegacyPhoto,
  processPhoto,
  sniffImageType,
} from "./photo-processing";
import { PASSPORT_ASPECT, PASSPORT_HEIGHT, PASSPORT_WIDTH } from "./photo-constants";

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_MAGIC = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBP"),
]);

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 20, b: 20 } },
  })
    .png()
    .toBuffer();
}

describe("sniffImageType", () => {
  it("recognizes JPEG, PNG, and WebP magic bytes", () => {
    expect(sniffImageType(JPEG_MAGIC)).toBe("image/jpeg");
    expect(sniffImageType(PNG_MAGIC)).toBe("image/png");
    expect(sniffImageType(WEBP_MAGIC)).toBe("image/webp");
  });

  it("rejects a renamed non-image file (extension lies, bytes don't)", () => {
    const fakePdf = Buffer.from("%PDF-1.4\n...not an image...");
    expect(sniffImageType(fakePdf)).toBeNull();
  });

  it("rejects an empty or truncated buffer", () => {
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe("processPhoto", () => {
  it("re-encodes to WebP and downscales an oversized image to fit 1200px", async () => {
    const big = await makePng(2000, 1000);
    const result = await processPhoto(big);
    expect(result.width).toBe(1200);
    expect(result.height).toBe(600);
    expect(sniffImageType(result.webp)).toBe("image/webp");
  });

  it("never upscales an image already smaller than the cap", async () => {
    const small = await makePng(300, 200);
    const result = await processPhoto(small);
    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
  });

  it("preserves aspect ratio for a tall (portrait) image", async () => {
    const tall = await makePng(1000, 2500);
    const result = await processPhoto(tall);
    expect(result.height).toBe(1200);
    expect(result.width).toBe(480);
  });

  it("throws on bytes that pass the magic-byte sniff but aren't a real image", async () => {
    // A buffer with a valid JPEG SOI marker but no real JPEG data after it —
    // this is exactly the case the sniff can't catch and sharp must.
    const corrupt = Buffer.concat([JPEG_MAGIC, Buffer.alloc(50, 0)]);
    await expect(processPhoto(corrupt)).rejects.toThrow();
  });
});

describe("MAX_UPLOAD_BYTES", () => {
  it("is 8 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
  });
});

describe("processLegacyPhoto", () => {
  const ratio = (w: number, h: number) => w / h;

  // Regression: the first implementation asked for 600x771 with
  // `withoutEnlargement: true`. sharp skips the entire resize when the
  // requested box exceeds the source, so it skipped the crop too and stored
  // every ledger photo at its original aspect ratio.
  it.each([
    [162, 162, "square"],
    [289, 193, "landscape"],
    [124, 207, "very narrow"],
    [199, 315, "tall"],
    [161, 206, "already near 7:9"],
  ])("crops a %ix%i (%s) source to 7:9", async (w, h) => {
    const out = await processLegacyPhoto(await makePng(w, h));
    expect(ratio(out.width, out.height)).toBeCloseTo(PASSPORT_ASPECT, 1);
  });

  it("never enlarges a small source", async () => {
    const out = await processLegacyPhoto(await makePng(162, 162));
    expect(out.width).toBeLessThanOrEqual(162);
    expect(out.height).toBeLessThanOrEqual(162);
  });

  it("caps a large source at the passport geometry", async () => {
    const out = await processLegacyPhoto(await makePng(2000, 3000));
    expect(out.width).toBe(PASSPORT_WIDTH);
    expect(out.height).toBe(PASSPORT_HEIGHT);
  });

  it("keeps as much of the source as the ratio allows", async () => {
    // 200x400 is taller than 7:9, so full width survives and height is trimmed.
    const out = await processLegacyPhoto(await makePng(200, 400));
    expect(out.width).toBe(200);
    expect(out.height).toBe(Math.round(200 / PASSPORT_ASPECT));
  });
});
