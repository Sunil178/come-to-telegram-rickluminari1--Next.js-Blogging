// Generates the PWA icons in public/icons/ from the wordmark's "V." monogram (theme colours from
// globals.css). Placeholder until the real logo arrives (docs/roadmap.md); run: node src/scripts/generate-icons.mjs
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BACKGROUND = "#2b2118"; // --foreground (light theme)
const LETTER = "#fbf7f0"; // --background (light theme)
const ACCENT = "#f7762a"; // --primary

// Content stays inside the central 80% so maskable crops (circle, squircle) never clip it.
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BACKGROUND}"/>
  <text x="236" y="364" text-anchor="middle" font-family="DejaVu Serif, Georgia, serif" font-weight="700" font-size="300" fill="${LETTER}">V</text>
  <circle cx="368" cy="344" r="26" fill="${ACCENT}"/>
</svg>`;

// Relative to this file, so it works from any working directory.
const outDir = fileURLToPath(new URL("../../public/icons/", import.meta.url));
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
    await sharp(Buffer.from(svg(size))).png().toFile(`${outDir}icon-${size}.png`);
}
await sharp(Buffer.from(svg(180))).png().toFile(`${outDir}apple-touch-icon.png`);
console.log("Wrote public/icons/icon-192.png, icon-512.png, apple-touch-icon.png");
