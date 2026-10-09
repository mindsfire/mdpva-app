/**
 * Draws the "application completed" share card (the G design) on a canvas.
 *
 * Browser-only. Nothing here is uploaded or stored: the card is built on the
 * member's own phone from their name, the submission date, the MDPVA seal and
 * their own photo (fetched from the session-gated `/onboard/photo` route), then
 * handed to the share sheet and dropped.
 *
 * Sizes and positions are the 1080×1920 design's pixel values, so the card
 * matches the approved mock one-to-one.
 */
const W = 1080;
const H = 1920;

const GOLD = "#c9bc7e";
const GREEN = "#059669";
const OLIVE = "#6b5b2e";
const DARK_OLIVE = "#3b3420";
const INK = "#161513";
const PAPER = "#fafaf8";

const SANS = 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
const KANNADA_FAMILY = "MDPVA Kannada";
const KANNADA = `"${KANNADA_FAMILY}", ${SANS}`;

let fontLoad: Promise<void> | null = null;

/**
 * Registers the Kannada face for canvas text. Canvas can't use the page's
 * @font-face fallbacks reliably, so the font is loaded explicitly. Failure is
 * not fatal: the text falls back to the system font rather than blocking the
 * share.
 */
function loadKannadaFont(): Promise<void> {
  fontLoad ??= (async () => {
    const face = new FontFace(
      KANNADA_FAMILY,
      "url(/fonts/NotoSansKannada-Bold.ttf)",
      { weight: "700" },
    );
    await face.load();
    document.fonts.add(face);
  })().catch((err) => {
    fontLoad = null;
    throw err;
  });
  return fontLoad;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

/** The member's own submitted photo, or null if there isn't one to show. */
async function fetchPhoto(): Promise<ImageBitmap | null> {
  try {
    const res = await fetch("/onboard/photo", { cache: "no-store" });
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

type Drawable = HTMLImageElement | ImageBitmap;

/** Object-fit: cover, centred, into a box. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: Drawable,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = img.width;
  const ih = img.height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function circlePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function pillPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
}

function shadow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  offsetY: number,
) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = offsetY;
}

function noShadow(ctx: CanvasRenderingContext2D) {
  shadow(ctx, "transparent", 0, 0);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, 1310);
  g.addColorStop(0, OLIVE);
  g.addColorStop(0.5, DARK_OLIVE);
  g.addColorStop(1, INK);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** The seal and the MDPVA pill, side by side, 110px from the top. */
function drawLogoRow(ctx: CanvasRenderingContext2D, logo: HTMLImageElement) {
  const LOGO = 165;
  const GAP = 22;
  const PILL_H = 69;
  const LABEL = "MDPVA";

  ctx.font = `800 34px ${SANS}`;
  const labelW = ctx.measureText(LABEL).width + LABEL.length * 3.4;
  const pillW = labelW + 64;
  const total = LOGO + GAP + pillW;
  const x = (W - total) / 2;
  const y = 110;
  const midY = y + LOGO / 2;

  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.4)", 30, 12);
  ctx.drawImage(logo, x, y, LOGO, LOGO);
  ctx.restore();

  const px = x + LOGO + GAP;
  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.4)", 30, 12);
  pillPath(ctx, px, midY - PILL_H / 2, pillW, PILL_H);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 34px ${SANS}`;
  ctx.fillText(LABEL, px + pillW / 2, midY);
}

function drawHeadline(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = `700 40px ${KANNADA}`;
  ctx.fillStyle = GOLD;
  ctx.fillText("ಪರಿಷ್ಕರಣೆ ಪ್ರಕ್ರಿಯೆಯನ್ನು", W / 2, 360);

  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.5)", 40, 12);
  ctx.font = `800 100px ${KANNADA}`;
  ctx.fillStyle = PAPER;
  ctx.fillText("ಯಶಸ್ವಿಯಾಗಿ", W / 2, 436);
  ctx.fillText("ಪೂರ್ಣಗೊಳಿಸಿದ್ದೇನೆ!", W / 2, 548);
  ctx.restore();
}

/** Photo disc (640px inside a 14px gold ring) centred at (540, 1094). */
function drawPhoto(ctx: CanvasRenderingContext2D, photo: ImageBitmap | null) {
  const CX = W / 2;
  const CY = 1094;
  const OUTER = 334;
  const INNER = 320;

  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.6)", 90, 44);
  circlePath(ctx, CX, CY, OUTER);
  ctx.fillStyle = DARK_OLIVE;
  ctx.fill();
  ctx.restore();

  ctx.save();
  circlePath(ctx, CX, CY, INNER);
  ctx.clip();
  if (photo) {
    drawCover(ctx, photo, CX - INNER, CY - INNER, INNER * 2, INNER * 2);
  } else {
    ctx.fillStyle = DARK_OLIVE;
    ctx.fillRect(CX - INNER, CY - INNER, INNER * 2, INNER * 2);
  }
  ctx.restore();

  circlePath(ctx, CX, CY, 327);
  ctx.lineWidth = 14;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
}

/** The check badge, half on the ring's lower-left edge, tilted -10°. */
function drawBadge(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(309, 1325);
  ctx.rotate((-10 * Math.PI) / 180);

  ctx.save();
  shadow(ctx, "rgba(0,0,0,0.55)", 50, 22);
  circlePath(ctx, 0, 0, 105);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.restore();

  circlePath(ctx, 0, 0, 87);
  ctx.fillStyle = GREEN;
  ctx.fill();

  // The check, from its 62×54 source path scaled to 92×80.
  const point = (x: number, y: number): [number, number] => [
    x * (92 / 62) - 46,
    y * (80 / 54) - 40,
  ];
  ctx.beginPath();
  ctx.moveTo(...point(6, 28));
  ctx.lineTo(...point(24, 46));
  ctx.lineTo(...point(56, 8));
  ctx.lineWidth = 14.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.restore();
}

/** Gold rule and the member's name. */
function drawNameBlock(ctx: CanvasRenderingContext2D, name: string) {
  const RULE_Y = 1518;
  const MAX_W = W - 140;

  ctx.fillStyle = GOLD;
  ctx.fillRect(70, RULE_Y, MAX_W, 3);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const nameTop = RULE_Y + 3 + 34;
  let nameSize = 76;
  ctx.font = `800 ${nameSize}px ${KANNADA}`;
  while (nameSize > 44 && ctx.measureText(name).width > MAX_W) {
    nameSize -= 4;
    ctx.font = `800 ${nameSize}px ${KANNADA}`;
  }
  ctx.fillStyle = PAPER;
  ctx.fillText(name, W / 2, nameTop);
}

/**
 * "Powered by [mark] Mindsfire" along the bottom. The words are white for the
 * dark card; the mark keeps its own colours.
 */
function drawFooter(ctx: CanvasRenderingContext2D, mark: HTMLImageElement) {
  const LEAD = "Powered by";
  const TRAIL = "Mindsfire";
  const MARK_H = 28;
  // The mark's artwork is 366×161 in its viewBox.
  const markW = MARK_H * (366 / 161);
  const GAP = 10;
  const MID_Y = 1800;

  ctx.font = `600 22px ${SANS}`;
  const leadW = ctx.measureText(LEAD).width;
  ctx.font = `700 22px ${SANS}`;
  const trailW = ctx.measureText(TRAIL).width;
  const total = leadW + GAP + markW + GAP + trailW;
  let x = (W - total) / 2;

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 22px ${SANS}`;
  ctx.fillText(LEAD, x, MID_Y);
  x += leadW + GAP;

  ctx.drawImage(mark, x, MID_Y - MARK_H / 2, markW, MARK_H);
  x += markW + GAP;

  ctx.font = `700 22px ${SANS}`;
  ctx.fillText(TRAIL, x, MID_Y);
}

/**
 * Builds the card as a PNG. `logoSrc` and `mindsfireSrc` are bundled asset
 * URLs, passed in by the caller so this module doesn't import image assets.
 */
export async function buildShareCardPng(
  { name }: { name: string },
  logoSrc: string,
  mindsfireSrc: string,
): Promise<Blob> {
  const [, photo, logo, mindsfire] = await Promise.all([
    loadKannadaFont().catch(() => undefined),
    fetchPhoto(),
    loadImage(logoSrc),
    loadImage(mindsfireSrc),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  noShadow(ctx);
  drawBackground(ctx);
  drawLogoRow(ctx, logo);
  drawHeadline(ctx);
  drawPhoto(ctx, photo);
  drawBadge(ctx);
  drawNameBlock(ctx, name);
  drawFooter(ctx, mindsfire);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png",
    ),
  );
}
