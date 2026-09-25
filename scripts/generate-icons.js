// Generates every favicon / app icon in public/ from one vector mark.
// Run manually after changing the design: node scripts/generate-icons.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(path.dirname(__dirname), "public");

const BG = "#000000";
const FG = "#ffffff";

// The mark, drawn in a 100×100 box: a father (square) branching to a son
// (square) and a daughter (circle), matching the app's card shapes and links.
const mark = (color) => `
    <path d="M50 36 C50 50 30 46 30 60 M50 36 C50 50 70 46 70 59" fill="none" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/>
    <rect x="39" y="15" width="22" height="21" rx="3" fill="${color}"/>
    <rect x="18" y="60" width="24" height="21" rx="3" fill="${color}"/>
    <circle cx="70" cy="70" r="11.5" fill="${color}"/>`;

// Rounded tile with transparent corners (favicon, "any" purpose icons).
const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="26" fill="${BG}"/>
  <g transform="translate(12 12) scale(0.96)">${mark(FG)}
  </g>
</svg>
`;

// Full-bleed square with the mark inside the maskable safe zone (inner 80% circle).
// Also used for apple-touch-icon, which iOS rounds itself and must not be transparent.
const fullBleedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="${BG}"/>
  <g transform="translate(18 19) scale(0.84)">${mark(FG)}
  </g>
</svg>
`;

const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: Math.max(72, (size / 120) * 72 * 4) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();

// ICO container holding PNG-encoded images (supported by all current browsers).
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const write = (name, data) => {
  fs.writeFileSync(path.join(PUBLIC_DIR, name), data);
  console.log(`wrote public/${name}`);
};

write("favicon.svg", tileSvg);
write("icon-192.png", await png(tileSvg, 192));
write("icon-512.png", await png(tileSvg, 512));
write("icon-maskable-192.png", await png(fullBleedSvg, 192));
write("icon-maskable-512.png", await png(fullBleedSvg, 512));
write("apple-touch-icon.png", await png(fullBleedSvg, 180));
write(
  "favicon.ico",
  buildIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(tileSvg, size) }))))
);
