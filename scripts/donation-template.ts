/**
 * Prepares the donation card artwork: punches the white photo slot out of the
 * designer's PNG so the photo can be drawn *behind* the silver frame, leaving
 * no white fringe along the frame's uneven inner edge.
 *
 *   npx tsx scripts/donation-template.ts <designer.png>
 *
 * Writes src/assets/donation/card-template.png. Prints the slot's bounds; if
 * they change, update DONATION_SLOT in src/lib/photo-constants.ts.
 */
import path from "node:path";

import sharp from "sharp";

const OUT = path.join(process.cwd(), "src/assets/donation/card-template.png");
const WHITE = 235;
/** Eats the anti-aliased ring between the white and the frame. */
const GROW = 2;

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("Usage: donation-template.ts <designer.png>");

  const { data, info } = await sharp(source)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  const isWhite = (x: number, y: number) => {
    const i = (y * W + x) * 3;
    return data[i] > WHITE && data[i + 1] > WHITE && data[i + 2] > WHITE;
  };

  // Flood from the slot's centre, so white text elsewhere is left alone.
  const hole = new Uint8Array(W * H);
  const stack: [number, number][] = [[Math.round(W * 0.75), Math.round(H * 0.5)]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (hole[y * W + x] || !isWhite(x, y)) continue;
    hole[y * W + x] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  const rgba = Buffer.alloc(W * H * 4);
  let [minX, minY, maxX, maxY] = [W, H, 0, 0];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const from = (y * W + x) * 3;
      const to = (y * W + x) * 4;
      rgba[to] = data[from];
      rgba[to + 1] = data[from + 1];
      rgba[to + 2] = data[from + 2];

      let punched = false;
      for (let dy = -GROW; dy <= GROW && !punched; dy++) {
        for (let dx = -GROW; dx <= GROW && !punched; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          punched =
            nx >= 0 && ny >= 0 && nx < W && ny < H && hole[ny * W + nx] === 1;
        }
      }
      rgba[to + 3] = punched ? 0 : 255;
      if (punched) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(OUT);
  console.log({ W, H, slot: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } });
}

main();
