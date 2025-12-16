import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const publicDir = path.join(root, 'public');
const sourcePath = path.join(publicDir, 'ai-text.png');
// Keep existing white background behaviour; do not switch to transparent unless the source already is.
const background = { r: 255, g: 255, b: 255, alpha: 1 };
const nearWhiteThreshold = 220;
const marginRatio = 0.01; // 1% padding after crop

async function ensureSource() {
  try {
    await fs.access(sourcePath);
  } catch {
    throw new Error(`Missing favicon source at ${sourcePath}`);
  }
}

async function cropToContent() {
  const src = sharp(sourcePath).ensureAlpha();
  const { width, height } = await src.metadata();
  if (!width || !height) throw new Error('Could not read source dimensions');
  const data = await src.raw().toBuffer();

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      const isBackground = a === 0 || (r >= nearWhiteThreshold && g >= nearWhiteThreshold && b >= nearWhiteThreshold);
      if (!isBackground) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    throw new Error('No non-background pixels detected in favicon source');
  }

  const padX = Math.round((maxX - minX + 1) * marginRatio);
  const padY = Math.round((maxY - minY + 1) * marginRatio);
  const crop = {
    left: Math.max(0, minX - padX),
    top: Math.max(0, minY - padY),
    width: Math.min(width - (Math.max(0, minX - padX)), (maxX - minX + 1) + padX * 2),
    height: Math.min(height - (Math.max(0, minY - padY)), (maxY - minY + 1) + padY * 2),
  };

  return sharp(sourcePath).extract(crop).png({ background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
}

async function createIcon(targetSize, outputName, scale = 0.88) {
  const markSize = Math.round(targetSize * scale);
  const cropped = await cropToContent();
  const markBuffer = await sharp(cropped)
    .resize(markSize, markSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const markMeta = await sharp(markBuffer).metadata();
  const left = Math.round((targetSize - markMeta.width) / 2);
  const top = Math.round((targetSize - markMeta.height) / 2);

  const canvas = await sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background,
    },
  })
    .composite([{ input: markBuffer, top, left }])
    .png({ background })
    .toBuffer();

  await fs.writeFile(path.join(publicDir, outputName), canvas);
}

async function createFaviconIco() {
  const buffers = await Promise.all(
    [16, 32, 48].map((size) => fs.readFile(path.join(publicDir, `favicon-${size}x${size}.png`)))
  );
  const ico = await pngToIco(buffers);
  await fs.writeFile(path.join(publicDir, 'favicon.ico'), ico);
}

async function main() {
  await ensureSource();
  await createIcon(16, 'favicon-16x16.png', 0.99);
  await createIcon(32, 'favicon-32x32.png', 0.99);
  await createIcon(48, 'favicon-48x48.png', 0.99);
  await createIcon(180, 'apple-touch-icon-180x180.png', 0.99);
  await createFaviconIco();
  console.log('Favicon set regenerated from ai-text.png with scan-crop and scale 0.99');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
