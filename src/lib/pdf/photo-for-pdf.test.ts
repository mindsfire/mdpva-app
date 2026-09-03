import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { toPngForPdf } from "./photo-for-pdf";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function makeWebp(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .webp()
    .toBuffer();
}

describe("toPngForPdf", () => {
  it("converts a WebP buffer to PNG", async () => {
    const webp = await makeWebp(120, 154);
    const png = await toPngForPdf(webp);
    expect([...png.subarray(0, 8)]).toEqual(PNG_MAGIC);

    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(120);
    expect(metadata.height).toBe(154);
  });
});
