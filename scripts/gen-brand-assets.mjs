/**
 * Generates the brand + favicon + OG assets from the master logo.
 *
 *   node scripts/gen-brand-assets.mjs
 *
 * Source: ../_logo.png (RGBA, transparent background — the trimmed lockup).
 * Outputs:
 *   src/assets/brand/lumko-lockup.png   full lockup, transparent (used via <Image>)
 *   src/assets/brand/lumko-mark.png     glyph mark only, square, transparent
 *   public/favicon.svg / .ico / favicon-{16,32,48}.png
 *   public/apple-touch-icon.png, public/icon-{192,512}.png
 *   public/brand/lumko-logo.png         lockup on white (schema logo)
 *   public/og/lumko-default.png         1200x630 default share image
 *
 * Re-run whenever the master logo changes.
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, '_logo.png');
const assetsDir = path.join(ROOT, 'src/assets/brand');
const pubBrand = path.join(ROOT, 'public/brand');
const pubIcons = path.join(ROOT, 'public');
const pubOg = path.join(ROOT, 'public/og');
const INDIGO = '#150479';

await fs.mkdir(assetsDir, { recursive: true });
await fs.mkdir(pubBrand, { recursive: true });
await fs.mkdir(pubOg, { recursive: true });

const lockup = await sharp(SRC).trim({ threshold: 10 }).toBuffer();
const lockupMeta = await sharp(lockup).metadata();
console.log('lockup trimmed', `${lockupMeta.width}x${lockupMeta.height}`);
await sharp(lockup)
  .resize({ width: 1400 })
  .png({ compressionLevel: 9 })
  .toFile(path.join(assetsDir, 'lumko-lockup.png'));

const glyphW = Math.round(lockupMeta.height * 1.12);
const markRaw = await sharp(lockup)
  .extract({ left: 0, top: 0, width: glyphW, height: lockupMeta.height })
  .trim({ threshold: 10 })
  .toBuffer();
const markMeta = await sharp(markRaw).metadata();
console.log('mark trimmed', `${markMeta.width}x${markMeta.height}`);

const side = Math.max(markMeta.width, markMeta.height);
const pad = Math.round(side * 0.06);
const markSquare = await sharp({
  create: {
    width: side + pad * 2,
    height: side + pad * 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: markRaw, gravity: 'center' }])
  .png()
  .toBuffer();

await sharp(markSquare)
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile(path.join(assetsDir, 'lumko-mark.png'));

for (const s of [16, 32, 48, 192, 512]) {
  const name = s >= 192 ? `icon-${s}.png` : `favicon-${s}.png`;
  await sharp(markSquare)
    .resize(s, s)
    .png({ compressionLevel: 9 })
    .toFile(path.join(pubIcons, name));
}

const appleInner = Math.round(180 * 0.68);
await sharp({ create: { width: 180, height: 180, channels: 4, background: '#ffffff' } })
  .composite([
    { input: await sharp(markSquare).resize(appleInner, appleInner).toBuffer(), gravity: 'center' },
  ])
  .png()
  .toFile(path.join(pubIcons, 'apple-touch-icon.png'));

const ico = await pngToIco([
  path.join(pubIcons, 'favicon-16.png'),
  path.join(pubIcons, 'favicon-32.png'),
  path.join(pubIcons, 'favicon-48.png'),
]);
await fs.writeFile(path.join(pubIcons, 'favicon.ico'), ico);

const markForSvg = (
  await sharp(markSquare).resize(160, 160).png().toBuffer()
).toString('base64');
await fs.writeFile(
  path.join(pubIcons, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="52" fill="${INDIGO}"/>
  <image x="48" y="48" width="160" height="160" href="data:image/png;base64,${markForSvg}"/>
</svg>
`,
);

await sharp({ create: { width: 1200, height: 320, channels: 4, background: '#ffffff' } })
  .composite([{ input: await sharp(lockup).resize({ width: 980 }).toBuffer(), gravity: 'center' }])
  .png()
  .toFile(path.join(pubBrand, 'lumko-logo.png'));

// Inverse lockup for dark (indigo) surfaces: the indigo wordmark + descriptor
// become white; the cerulean glyph (high green channel) is left untouched.
const { data: lockRaw, info: lockInfo } = await sharp(lockup)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
for (let i = 0; i < lockRaw.length; i += 4) {
  if (lockRaw[i + 1] < 110) {
    lockRaw[i] = 255;
    lockRaw[i + 1] = 255;
    lockRaw[i + 2] = 255;
  }
}
const lockupInverse = await sharp(lockRaw, {
  raw: { width: lockInfo.width, height: lockInfo.height, channels: 4 },
})
  .png()
  .toBuffer();
await sharp(lockupInverse)
  .resize({ width: 1400 })
  .png({ compressionLevel: 9 })
  .toFile(path.join(assetsDir, 'lumko-lockup-inverse.png'));

// Default share image: deep indigo, inverse lockup, the positioning line.
const ogLockup = await sharp(lockupInverse).resize({ width: 300 }).toBuffer();
const ogText = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <style>
    .h { font: 600 60px 'Archivo', 'Segoe UI', Arial, sans-serif; fill: #ffffff; letter-spacing: -1.5px; }
    .s { font: 500 22px 'Inter', 'Segoe UI', Arial, sans-serif; fill: rgba(255,255,255,0.68); letter-spacing: 2.5px; }
  </style>
  <rect x="80" y="246" width="56" height="3" fill="#08BAF4"/>
  <text class="h" x="80" y="330">Technology expertise for</text>
  <text class="h" x="80" y="400">organisations with serious</text>
  <text class="h" x="80" y="470">work to do.</text>
  <text class="s" x="80" y="552">SOFTWARE · INFRASTRUCTURE · DATA · INTEGRATED TECHNOLOGY</text>
</svg>`);
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#0b0340' } })
  .composite([
    { input: ogLockup, left: 80, top: 80 },
    { input: ogText, left: 0, top: 0 },
  ])
  .png()
  .toFile(path.join(pubOg, 'lumko-default.png'));

console.log('brand assets generated OK');
