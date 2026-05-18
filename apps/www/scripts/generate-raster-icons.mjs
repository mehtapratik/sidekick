#!/usr/bin/env node
/**
 * Rasterize brand assets to PNG for favicons, PWA, and social cards.
 *
 * The favicon/app-icon PNGs are derived from the user-supplied `k-dark.png`
 * for pixel-perfect fidelity. The OG/Twitter cards are rasterized from the
 * generated SVG layout.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND = path.join(__dirname, "../public/brand");
const OUT = path.join(__dirname, "../public/icons/png");

const SOURCE_K = path.join(BRAND, "k-dark.png");
const SOURCE_OG = path.join(BRAND, "og.svg");

const PAPER = "#faf8f3";

// Favicon + PWA sizes — all derived from the supplied K mark with paper background.
const iconJobs = [
  { out: "favicon-16.png", size: 16 },
  { out: "favicon-32.png", size: 32 },
  { out: "favicon-192.png", size: 192 },
  { out: "apple-touch-icon-180.png", size: 180 },
  { out: "app-icon-512.png", size: 512 },
];

fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(SOURCE_K)) {
  console.error(`Missing brand source: ${SOURCE_K}`);
  process.exit(1);
}

for (const job of iconJobs) {
  const output = path.join(OUT, job.out);
  await sharp(SOURCE_K)
    .resize(job.size, job.size, { fit: "contain", background: PAPER })
    .flatten({ background: PAPER })
    .png({ compressionLevel: 9 })
    .toFile(output);
  console.log(`Wrote ${job.out}`);
}

// Social cards — rasterize the OG SVG.
if (fs.existsSync(SOURCE_OG)) {
  const ogJobs = [
    { out: "og-1200x630.png" },
    { out: "twitter-card-1200x630.png" },
  ];
  for (const job of ogJobs) {
    const output = path.join(OUT, job.out);
    await sharp(SOURCE_OG, { density: 144 })
      .resize(1200, 630, { fit: "cover", background: PAPER })
      .flatten({ background: PAPER })
      .png({ compressionLevel: 9 })
      .toFile(output);
    console.log(`Wrote ${job.out}`);
  }
} else {
  console.warn(`Skip OG rasterization (missing ${SOURCE_OG})`);
}
