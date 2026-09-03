import { GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { r2, R2_BUCKET } from "@/lib/r2";

export interface PdfPhoto {
  buffer: Buffer;
  format: "png";
}

/**
 * Converts a photo buffer (the app only ever stores WebP) to PNG —
 * `@react-pdf/renderer`'s `<Image>` cannot decode WebP.
 */
export async function toPngForPdf(buf: Buffer): Promise<Buffer> {
  return sharp(buf).png().toBuffer();
}

/**
 * Fetches a member's photo from R2 and converts it to PNG for embedding in
 * a PDF.
 *
 * Never throws: a missing key, a missing object, or a decode failure all
 * degrade to `null` (no photo in the PDF) rather than failing the whole
 * download over one bad image.
 */
export async function fetchMemberPhotoForPdf(
  photoKey: string | null,
): Promise<PdfPhoto | null> {
  if (!photoKey) return null;

  try {
    const object = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: photoKey }),
    );
    if (!object.Body) return null;

    const webp = Buffer.from(await object.Body.transformToByteArray());
    const png = await toPngForPdf(webp);
    return { buffer: png, format: "png" };
  } catch {
    return null;
  }
}
