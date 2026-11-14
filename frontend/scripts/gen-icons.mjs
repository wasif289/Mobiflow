// scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public/icons", { recursive: true });

// ── Base icon (1024×1024), gradient bg + "MF" text ──
const SVG_BASE = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <text x="512" y="512" font-family="system-ui,-apple-system,sans-serif"
        font-size="440" font-weight="800" fill="#ffffff"
        text-anchor="middle" dominant-baseline="central"
        letter-spacing="-12">MF</text>
</svg>
`;

// ── Maskable icon: 512×512, solid bg, logo 80% safe zone mein ──
const SVG_MASKABLE = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b1220"/>
  <text x="256" y="256" font-family="system-ui,-apple-system,sans-serif"
        font-size="200" font-weight="800" fill="#ffffff"
        text-anchor="middle" dominant-baseline="central"
        letter-spacing="-6">MF</text>
</svg>
`;

// ── Regular icons ──
const SIZES = [
  ["icon-96.png", 96],
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
];

for (const [file, size] of SIZES) {
  await sharp(Buffer.from(SVG_BASE))
    .resize(size, size)
    .png()
    .toFile(`public/icons/${file}`);
  console.log("✅", file);
}

// ── Maskable (already 512×512) ──
await sharp(Buffer.from(SVG_MASKABLE))
  .png()
  .toFile("public/icons/maskable-512.png");
console.log("✅ maskable-512.png");

console.log("\n🎉 All icons generated in public/icons/");
