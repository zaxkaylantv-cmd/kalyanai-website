import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import toIco from 'to-ico';
import TextToSVG from 'text-to-svg';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const publicDir = path.join(root, 'public');
const markPath = path.join(publicDir, 'ai-mark.svg');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const fontsDir = path.join(root, 'assets', 'fonts');
const fontRegularPath = path.join(fontsDir, 'DejaVuSans.ttf');
const fontBoldPath = path.join(fontsDir, 'DejaVuSans-Bold.ttf');

async function ensureMarkExists() {
  try {
    await fs.access(markPath);
  } catch {
    throw new Error(`AI mark not found at ${markPath}`);
  }
  for (const font of [fontRegularPath, fontBoldPath]) {
    try {
      await fs.access(font);
    } catch {
      throw new Error(`Font not found at ${font}`);
    }
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
  const textToSvgBold = TextToSVG.loadSync(fontBoldPath);
  const textToSvgRegular = TextToSVG.loadSync(fontRegularPath);

  const markRender = await sharp(markPath)
    .resize(360, 360, { fit: 'contain', background: transparent })
    .png({ background: transparent })
    .toBuffer();
  const markMeta = await sharp(markRender).metadata();
  const markX = 110;
  const markY = Math.round((height - markMeta.height) / 2);

  const textStartX = 560;
  const maxTextWidth = 560;
  const titleSize = 72;
  const subtitleSize = 52;
  const subtitle = 'Bespoke hosted AI systems';
  const subtitleLines = wrapLines(subtitle, subtitleSize, maxTextWidth).slice(0, 2);
  const titleY = 285;
  const subtitleStartY = 365;
  const subLineGap = 14;

  const titlePath = textToSvgBold.getPath('Kalyan AI', {
    x: textStartX,
    y: titleY,
    fontSize: titleSize,
    anchor: 'left baseline',
    attributes: { fill: '#F5F8FF' },
  });

  const subtitlePaths = subtitleLines
    .map((line, idx) =>
      textToSvgRegular.getPath(line, {
        x: textStartX,
        y: subtitleStartY + idx * (subtitleSize + subLineGap),
        fontSize: subtitleSize,
        anchor: 'left baseline',
        attributes: { fill: '#F5F8FF' },
      })
    )
    .join('\n');

  const markBase64 = markRender.toString('base64');

  const ogSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F1F3A" />
          <stop offset="100%" stop-color="#AB71F7" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <image href="data:image/png;base64,${markBase64}" x="${markX}" y="${markY}" height="${markMeta.height}" width="${markMeta.width}" />
      ${titlePath}
      ${subtitlePaths}
    </svg>
  `;

  const og = await sharp(Buffer.from(ogSvg)).png().toBuffer();
  await fs.writeFile(path.join(publicDir, 'og-v7.png'), og);
}

async function createIcon(size, output) {
  const target = Math.round(size * 0.9);
  const markPng = await sharp(markPath)
    .resize(target, target, { fit: 'contain', background: transparent })
    .png({ background: transparent })
    .toBuffer();
  const markMeta = await sharp(markPng).metadata();
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
    .composite([{ input: markPng, top, left }])
    .png({ background: transparent })
    .toBuffer();

  await fs.writeFile(path.join(publicDir, output), canvas);
}

async function createFavicons() {
  await createIcon(16, 'favicon-16x16-v7.png');
  await createIcon(32, 'favicon-32x32-v7.png');
  await createIcon(48, 'favicon-48x48-v7.png');
  await createIcon(180, 'apple-touch-icon-v7.png');

  const icoBuffers = await Promise.all(
    [16, 32, 48].map((size) => fs.readFile(path.join(publicDir, `favicon-${size}x${size}-v7.png`)))
  );
  let icoBuffer;
  try {
    icoBuffer = await pngToIco(icoBuffers);
  } catch {
    icoBuffer = await toIco(icoBuffers);
  }
  await fs.writeFile(path.join(publicDir, 'favicon-v7.ico'), icoBuffer);
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
