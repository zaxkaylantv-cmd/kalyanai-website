import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import toIco from 'to-ico';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const publicDir = path.join(root, 'public');
const markPath = path.join(publicDir, 'ai-mark.svg');

async function ensureMarkExists() {
  try {
    await fs.access(markPath);
  } catch {
    throw new Error(`AI mark not found at ${markPath}`);
  }
}

function gradientSvg(width, height) {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F1F3A" />
          <stop offset="100%" stop-color="#AB71F7" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
    </svg>
  `;
}

async function renderMark(options) {
  const { height, width } = options;
  const pipeline = sharp(markPath).resize(width ?? null, height ?? null, { fit: 'contain' }).png();
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { buffer: data, info };
}

async function createOg() {
  const width = 1200;
  const height = 630;
  const bg = await sharp(Buffer.from(gradientSvg(width, height))).png().toBuffer();

  const markHeight = 340;
  const { buffer: markPng, info: markInfo } = await renderMark({ height: markHeight });
  const markX = Math.round(width * 0.1);
  const markY = Math.round((height - markInfo.height) / 2);

  const textSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font: 700 64px "Inter", "Helvetica Neue", Arial, sans-serif; fill: #F5F8FF; }
        .subtitle { font: 500 48px "Inter", "Helvetica Neue", Arial, sans-serif; fill: #F5F8FF; }
      </style>
      <text x="${markX + markInfo.width + Math.round(width * 0.08)}" y="${height / 2 - 14}" class="title">Kalyan AI</text>
      <text x="${markX + markInfo.width + Math.round(width * 0.08)}" y="${height / 2 + 52}" class="subtitle">Bespoke hosted AI systems</text>
    </svg>
  `;

  const og = await sharp(bg)
    .composite([
      { input: markPng, top: markY, left: markX },
      { input: Buffer.from(textSvg) },
    ])
    .png()
    .toBuffer();

  await fs.writeFile(path.join(publicDir, 'og-v3.png'), og);
}

async function createIcon(size, output) {
  const padding = Math.round(size * 0.12);
  const target = size - padding * 2;
  const { buffer: markPng } = await renderMark({ height: target, width: target });

  const canvas = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: markPng, top: padding, left: padding }])
    .png()
    .toBuffer();

  await fs.writeFile(path.join(publicDir, output), canvas);
}

async function createFavicons() {
  await createIcon(16, 'favicon-16x16-v4.png');
  await createIcon(32, 'favicon-32x32-v4.png');
  await createIcon(48, 'favicon-48x48-v4.png');
  await createIcon(180, 'apple-touch-icon-v4.png');

  const icoBuffers = await Promise.all(
    [16, 32, 48].map((size) => fs.readFile(path.join(publicDir, `favicon-${size}x${size}-v4.png`)))
  );
  let icoBuffer;
  try {
    icoBuffer = await pngToIco(icoBuffers);
  } catch {
    icoBuffer = await toIco(icoBuffers);
  }
  await fs.writeFile(path.join(publicDir, 'favicon-v4.ico'), icoBuffer);
}

async function main() {
  await ensureMarkExists();
  await createOg();
  await createFavicons();
  console.log('Generated OG and favicon assets from', markPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
