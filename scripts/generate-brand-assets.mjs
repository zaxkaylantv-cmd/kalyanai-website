import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import toIco from 'to-ico';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const publicDir = path.join(root, 'public');
const markPath = path.join(publicDir, 'ai-mark.svg');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

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

async function getTrimmedMark(scaleSize = 1024) {
  const base = sharp(markPath)
    .resize(scaleSize, scaleSize, { fit: 'contain', background: transparent })
    .png({ background: transparent });
  const trimmed = base.trim({ background: transparent });
  const { data, info } = await trimmed.toBuffer({ resolveWithObject: true });
  return { buffer: data, info };
}

function estimateWidth(text, fontSize) {
  return text.length * fontSize * 0.55;
}

function wrapLines(text, fontSize, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (estimateWidth(test, fontSize) <= maxWidth || !current) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function createOg() {
  const width = 1200;
  const height = 630;
  const bg = await sharp(Buffer.from(gradientSvg(width, height))).png().toBuffer();

  const { buffer: trimmedMark } = await getTrimmedMark(1024);
  const markHeight = 360;
  const markPng = await sharp(trimmedMark).resize({ height: markHeight, fit: 'contain' }).png().toBuffer();
  const markMeta = await sharp(markPng).metadata();

  const markX = 110;
  const markY = Math.round((height - markMeta.height) / 2);

  const textStartX = 560;
  const maxTextWidth = 560;
  const titleSize = 72;
  const subtitleSize = 52;
  const subtitle = 'Bespoke hosted AI systems';
  const subtitleLines = wrapLines(subtitle, subtitleSize, maxTextWidth);
  const lineGap = 18;
  const subLineGap = 14;
  const titleHeight = titleSize;
  const subtitleBlockHeight = subtitleLines.length * subtitleSize + subLineGap * (subtitleLines.length - 1);
  const startY = 260;
  const subtitleStartY = startY + titleHeight + lineGap;

  const subtitleSpans = subtitleLines
    .map((line, idx) => {
      const dy = idx === 0 ? 0 : subtitleSize + subLineGap;
      return `<tspan x="${textStartX}" dy="${dy}px">${line}</tspan>`;
    })
    .join('');

  const textSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font-family: "DejaVu Sans", Arial, sans-serif; font-weight: 700; font-size: ${titleSize}px; fill: #F5F8FF; letter-spacing: 0; }
        .subtitle { font-family: "DejaVu Sans", Arial, sans-serif; font-weight: 500; font-size: ${subtitleSize}px; fill: #F5F8FF; letter-spacing: 0; }
      </style>
      <text x="${textStartX}" y="${startY + titleHeight}" class="title">Kalyan AI</text>
      <text x="${textStartX}" y="${subtitleStartY}" class="subtitle">${subtitleSpans}</text>
    </svg>
  `;

  const og = await sharp(bg)
    .composite([
      { input: markPng, top: markY, left: markX },
      { input: Buffer.from(textSvg) },
    ])
    .png()
    .toBuffer();

  await fs.writeFile(path.join(publicDir, 'og-v6.png'), og);
}

async function createIcon(size, output) {
  const target = Math.round(size * 0.86);
  const { buffer: trimmedMark } = await getTrimmedMark(1024);
  const markResized = await sharp(trimmedMark)
    .resize({ width: target, height: target, fit: 'contain', background: transparent })
    .png({ background: transparent })
    .toBuffer();
  const markMeta = await sharp(markResized).metadata();
  const left = Math.round((size - markMeta.width) / 2);
  const top = Math.round((size - markMeta.height) / 2);

  const canvas = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparent,
    },
  })
    .composite([{ input: markResized, top, left }])
    .png({ background: transparent })
    .toBuffer();

  await fs.writeFile(path.join(publicDir, output), canvas);
}

async function createFavicons() {
  await createIcon(16, 'favicon-16x16-v6.png');
  await createIcon(32, 'favicon-32x32-v6.png');
  await createIcon(48, 'favicon-48x48-v6.png');
  await createIcon(180, 'apple-touch-icon-v6.png');

  const icoBuffers = await Promise.all(
    [16, 32, 48].map((size) => fs.readFile(path.join(publicDir, `favicon-${size}x${size}-v6.png`)))
  );
  let icoBuffer;
  try {
    icoBuffer = await pngToIco(icoBuffers);
  } catch {
    icoBuffer = await toIco(icoBuffers);
  }
  await fs.writeFile(path.join(publicDir, 'favicon-v6.ico'), icoBuffer);
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
