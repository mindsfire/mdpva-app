/**
 * Draws the donation thank-you card on a canvas, from the designer's Silver
 * Jubilee artwork, the donor's photo and their details.
 *
 * Browser-only. The artwork has its photo slot punched out (see
 * `scripts/donation-template.ts`), so the photo goes down first and the silver
 * frame lands on top of it. The donor's text sits in the clear band between
 * the frame and the printed thank-you line, as marked up by the designer.
 *
 * Positions are the artwork's own 1296×1013 pixels. The card is exported at 2×
 * so the name and amount stay sharp on a phone.
 */
import { formatRupees } from "@/lib/donations/validation";
import { DONATION_SLOT } from "@/lib/photo-constants";
import {
  drawCover,
  KANNADA,
  loadImage,
  loadKannadaFont,
} from "@/lib/share-card/render";

const W = 1296;
const H = 1013;
const EXPORT_SCALE = 2;

/**
 * Latin first, in the bold the artwork's date uses: the Kannada face's own
 * Latin letters look thin beside its Kannada. Those fonts have no Kannada, so
 * that text still falls through to the bundled face.
 */
const FONT = `Arial, Roboto, "Helvetica Neue", ${KANNADA}`;

const AMOUNT_COLOR = "#6bbcff";
const NAME_COLOR = "#fffa00";

type Line = {
  /** Centre of the line. */
  x: number;
  baseline: number;
  maxWidth: number;
  size: number;
  minSize: number;
  color: string;
};

/** Sits below the frame, where the donor's text was marked up on the design. */
const AMOUNT_LINE: Line = {
  x: 978,
  baseline: 874,
  maxWidth: 604,
  size: 60,
  minSize: 36,
  color: AMOUNT_COLOR,
};

/**
 * Centred under the printed date, midway between it and the thank-you line.
 * `maxWidth` also keeps a long line clear of the amount, which shares this
 * height further right.
 */
const NAME_LINE: Line = {
  x: 392,
  baseline: 897,
  maxWidth: 744,
  size: 40,
  minSize: 22,
  color: NAME_COLOR,
};

/** One line of text, shrunk to fit; `fillText` condenses anything still too long. */
function drawLine(ctx: CanvasRenderingContext2D, text: string, line: Line) {
  let fitted = line.size;
  ctx.font = `700 ${fitted}px ${FONT}`;
  while (fitted > line.minSize && ctx.measureText(text).width > line.maxWidth) {
    fitted -= 1;
    ctx.font = `700 ${fitted}px ${FONT}`;
  }
  ctx.fillStyle = line.color;
  ctx.fillText(text, line.x, line.baseline, line.maxWidth);
}

function drawDetails(
  ctx: CanvasRenderingContext2D,
  details: { name: string; businessName: string | null; amount: number },
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  drawLine(ctx, `${formatRupees(details.amount)}/-`, AMOUNT_LINE);
  drawLine(
    ctx,
    [details.name, details.businessName].filter(Boolean).join(", "),
    NAME_LINE,
  );
}

/**
 * Builds the card as a JPEG: a PNG of this artwork is around 7MB, which is
 * slow to send over mobile data and gets recompressed by WhatsApp anyway.
 *
 * `templateSrc` is a bundled asset URL, passed in so this module imports none.
 */
export async function buildDonationCard(
  details: {
    name: string;
    businessName: string | null;
    amount: number;
    photoUrl: string;
  },
  templateSrc: string,
): Promise<Blob> {
  const [, template, photo] = await Promise.all([
    loadKannadaFont().catch(() => undefined),
    loadImage(templateSrc),
    // Same-origin on purpose; see the `/api/donations/[id]/photo` route.
    loadImage(details.photoUrl),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W * EXPORT_SCALE;
  canvas.height = H * EXPORT_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
  ctx.imageSmoothingQuality = "high";

  const { x, y, w, h } = DONATION_SLOT;
  drawCover(ctx, photo, x, y, w, h);
  ctx.drawImage(template, 0, 0, W, H);
  drawDetails(ctx, details);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Card export failed"))),
      "image/jpeg",
      0.92,
    ),
  );
}
