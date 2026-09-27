import { Resvg } from "@resvg/resvg-js";
import { load } from "js-yaml";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHeroSVG, HERO_ART_PALETTES } from "../src/lib/hero-art.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "src/content");
const OG_DIR = path.join(ROOT, "public/og");
const HASH_MANIFEST_PATH = path.join(OG_DIR, ".og-manifest.json");

// Keep in sync with KIND_TO_MOTIF / WRITINGS_MOTIF in src/lib/site.ts.
const KIND_TO_MOTIF = {
   spec: "Frame stack",
   prd: "Requirement grid",
   decision: "Branch",
   plan: "Gantt",
   guidance: "Radar",
   glossary: "Lattice",
   opportunity: "Scatter",
};
const WRITINGS_MOTIF = "Contour";

const CANVAS_W = 1200;
const CANVAS_H = 630;
const ART_W = 1040;
const ART_H = (ART_W * 240) / 640;
const OFFSET_X = (CANVAS_W - ART_W) / 2;
const OFFSET_Y = (CANVAS_H - ART_H) / 2;
const SCALE = ART_W / 640;

function innerMarkup(svg) {
   const match = svg.match(/^<svg[^>]*>([\s\S]*)<\/svg>$/);
   return match ? match[1] : svg;
}

function parseFrontmatter(raw) {
   if (!raw.startsWith("---\n")) return {};
   const end = raw.indexOf("\n---\n", 4);
   if (end === -1) return {};
   return load(raw.slice(4, end)) ?? {};
}

function loadHashManifest() {
   try {
      return JSON.parse(fs.readFileSync(HASH_MANIFEST_PATH, "utf8"));
   } catch {
      return {};
   }
}

// Bump when HERO_ART_PALETTES changes so every card re-renders.
const PALETTE_ID = "arkive-light-v1";

function hashFor(seed, motif, paletteId) {
   return crypto.createHash("sha1").update(`${seed}::${motif}::${paletteId}`).digest("hex").slice(0, 12);
}

function renderOg(motif, seed) {
   const art = renderHeroSVG(motif, seed, 640, HERO_ART_PALETTES.light);
   const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"><rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${HERO_ART_PALETTES.light.paper}"/><g transform="translate(${OFFSET_X} ${OFFSET_Y}) scale(${SCALE})">${innerMarkup(art)}</g></svg>`;
   const resvg = new Resvg(canvas, { fitTo: { mode: "width", value: CANVAS_W } });
   return resvg.render().asPng();
}

function main() {
   fs.mkdirSync(OG_DIR, { recursive: true });
   const hashManifest = loadHashManifest();
   const nextHashManifest = {};
   let written = 0;
   let skipped = 0;

   // Writings.
   const writingsDir = path.join(CONTENT_DIR, "writings");
   if (fs.existsSync(writingsDir)) {
      for (const file of fs.readdirSync(writingsDir)) {
         if (!file.endsWith(".md")) continue;
         const slug = file.replace(/\.md$/, "");
         const attrs = parseFrontmatter(fs.readFileSync(path.join(writingsDir, file), "utf8"));
         if (attrs.status !== "active") continue;

         const seed = attrs.seed ?? slug;
         const name = `writings--${slug}`;
         const hash = hashFor(seed, WRITINGS_MOTIF, PALETTE_ID);
         nextHashManifest[name] = hash;
         if (hashManifest[name] === hash && fs.existsSync(path.join(OG_DIR, `${name}.png`))) {
            skipped++;
            continue;
         }
         fs.writeFileSync(path.join(OG_DIR, `${name}.png`), renderOg(WRITINGS_MOTIF, seed));
         written++;
      }
   }

   // Docs — every published leaf document and section landing gets its own
   // card (§7.4). If this proves too slow at vault scale, the documented
   // fallback is: writings + section landings get real cards, individual
   // documents share one generic card.
   const docsDir = path.join(CONTENT_DIR, "docs");
   if (fs.existsSync(docsDir)) {
      for (const { full, rel } of walkMd(docsDir)) {
         const id = rel.replace(/\.md$/, "");
         const attrs = parseFrontmatter(fs.readFileSync(full, "utf8"));
         const motif = KIND_TO_MOTIF[attrs.kind] ?? "Frame stack";
         const seed = attrs.docId ?? id;
         const name = `docs--${id.replace(/\//g, "--")}`;
         const hash = hashFor(seed, motif, PALETTE_ID);
         nextHashManifest[name] = hash;
         if (hashManifest[name] === hash && fs.existsSync(path.join(OG_DIR, `${name}.png`))) {
            skipped++;
            continue;
         }
         fs.writeFileSync(path.join(OG_DIR, `${name}.png`), renderOg(motif, seed));
         written++;
      }
   }

   // Prune stale PNGs for content that no longer exists.
   for (const f of fs.readdirSync(OG_DIR)) {
      if (!f.endsWith(".png")) continue;
      const name = f.replace(/\.png$/, "");
      if (!(name in nextHashManifest)) fs.unlinkSync(path.join(OG_DIR, f));
   }

   fs.writeFileSync(HASH_MANIFEST_PATH, JSON.stringify(nextHashManifest, null, 2));
   console.log(`✓ Generated ${written} OG images (${skipped} unchanged, skipped) in public/og`);
}

function walkMd(dir, base = "") {
   const entries = [];
   for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = base ? `${base}/${name}` : name;
      if (fs.statSync(full).isDirectory()) {
         entries.push(...walkMd(full, rel));
      } else if (name.endsWith(".md")) {
         entries.push({ full, rel: rel.split(path.sep).join("/") });
      }
   }
   return entries;
}

main();
