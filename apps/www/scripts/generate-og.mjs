import { Resvg } from "@resvg/resvg-js";
import { load } from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderHeroSVG, HERO_ART_PALETTES } from "../src/lib/hero-art.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "src/content");
const OG_DIR = path.join(ROOT, "public/og");

const SECTIONS = ["writings", "core-drive", "plans", "builds"];

// Maps a post's `type` to a hero-art motif; keep in sync with
// TYPE_TO_MOTIF in src/lib/site.ts.
const TYPE_TO_MOTIF = {
   essay: "Essay",
   blog: "Blog",
   "core-drive": "Core Drive",
   plan: "Plan",
   decision: "Decision",
   build: "Build",
   note: "Blog",
};

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

function clearOgDir() {
   fs.mkdirSync(OG_DIR, { recursive: true });
   for (const f of fs.readdirSync(OG_DIR)) {
      if (f.endsWith(".png")) fs.unlinkSync(path.join(OG_DIR, f));
   }
}

function main() {
   clearOgDir();
   let written = 0;

   for (const section of SECTIONS) {
      const dir = path.join(CONTENT_DIR, section);
      if (!fs.existsSync(dir)) continue;

      for (const file of fs.readdirSync(dir)) {
         if (!file.endsWith(".md")) continue;
         const slug = file.replace(/\.md$/, "");
         const raw = fs.readFileSync(path.join(dir, file), "utf8");
         const attrs = parseFrontmatter(raw);
         if (attrs.status !== "active") continue;

         const motif = TYPE_TO_MOTIF[attrs.type];
         if (!motif) continue;

         const seed = attrs.seed ?? slug;
         const art = renderHeroSVG(motif, seed, 640, HERO_ART_PALETTES.light);
         const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"><rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${HERO_ART_PALETTES.light.paper}"/><g transform="translate(${OFFSET_X} ${OFFSET_Y}) scale(${SCALE})">${innerMarkup(art)}</g></svg>`;

         const resvg = new Resvg(canvas, {
            fitTo: { mode: "width", value: CANVAS_W },
         });
         const png = resvg.render().asPng();
         fs.writeFileSync(path.join(OG_DIR, `${section}--${slug}.png`), png);
         written++;
      }
   }

   console.log(`✓ Generated ${written} OG images in public/og`);
}

main();
