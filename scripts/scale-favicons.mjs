import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const publicDir = path.join(root, 'public');
const sourcePath = path.join(publicDir, 'ai-text.png');
// Keep existing white background behaviour; do not switch to transparent unless the source already is.
const background = { r: 255, g: 255, b: 255, alpha: 1 };

async function ensureSource() {
  try {
    await fs.access(sourcePath);
  } catch {
    throw new Error(`Missing favicon source at ${sourcePath}`);
  }
}

async function renderMark(size) {
  const base = sharp(sourcePath)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
  return base.trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } }).toBuffer();
}

async function createIcon(targetSize, outputName, scale = 0.88) {
  const markSize = Math.round(targetSize * scale);
  const markBuffer = await renderMark(markSize);
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
  await createIcon(16, 'favicon-16x16.png', 0.97);
  await createIcon(32, 'favicon-32x32.png', 0.97);
  await createIcon(48, 'favicon-48x48.png', 0.97);
  await createIcon(180, 'apple-touch-icon-180x180.png', 0.97);
  await createFaviconIco();
  console.log('Favicon set regenerated from ai-text.png with trim and scale 0.97');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
