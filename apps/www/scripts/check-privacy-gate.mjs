// Regression check for the vault's privacy gate:
// nothing from 00-principles/ or 01-motivations/ should ever reach the built
// site. Run after `astro build`.
//
// This vault's *published* content legitimately discusses "private" as an
// ordinary word (Core Drive's whole subject is the user's private
// information), so a blanket grep for the word "private" — or for a short,
// generic excluded title like "Learn" appearing anywhere as a substring —
// produces overwhelming false positives here. Instead this checks the two
// concrete ways a leak could actually happen:
//   1. a route under an excluded vault folder ever getting built at all
//      (shouldn't happen — those files never enter the `docs` collection —
//      but is cheap to assert structurally), and
//   2. an excluded file's title leaking through as a wikilink's *visible
//      link text* (the one path the redaction feature exists to close) —
//      checked by looking at anchor text specifically, not page-wide prose.
import { load } from "js-yaml";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const VAULT_DIR = path.resolve(
   ROOT,
   load(fs.readFileSync(path.join(ROOT, "content-meta.yaml"), "utf8")).vault.root,
);
const EXCLUDED_DIRS = ["00-principles", "01-motivations"];

function deriveTitle(name) {
   let s = name.replace(/\.md$/i, "");
   s = s.replace(/^\d+[-_]/, "");
   s = s.replace(/^_/, "");
   s = s.replace(/[-_—]+/g, " ");
   s = s.replace(/\s+/g, " ").trim();
   if (s.length === 0) return s;
   return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function parseFrontmatter(raw) {
   if (!raw.startsWith("---\n")) return {};
   const end = raw.indexOf("\n---\n", 4);
   if (end === -1) return {};
   return load(raw.slice(4, end)) ?? {};
}

function walkMd(dir) {
   if (!fs.existsSync(dir)) return [];
   const out = [];
   for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) out.push(...walkMd(full));
      else if (name.endsWith(".md")) out.push(full);
   }
   return out;
}

function walkFiles(dir) {
   if (!fs.existsSync(dir)) return [];
   const out = [];
   for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) out.push(...walkFiles(full));
      else out.push(full);
   }
   return out;
}

function main() {
   if (!fs.existsSync(DIST_DIR)) {
      console.error("[privacy-gate] dist/ not found — run `astro build` first.");
      process.exit(1);
   }

   const forbiddenTitles = new Set();
   for (const dir of EXCLUDED_DIRS) {
      for (const file of walkMd(path.join(VAULT_DIR, dir))) {
         if (path.basename(file).toLowerCase() === "index.md") continue;
         const attrs = parseFrontmatter(fs.readFileSync(file, "utf8"));
         const title = attrs.title ?? deriveTitle(path.basename(file));
         if (title) forbiddenTitles.add(title);
      }
   }

   const hits = [];

   // 1. Structural: no built route lives under an excluded folder name.
   for (const dir of EXCLUDED_DIRS) {
      const distMatches = walkFiles(DIST_DIR).filter((f) =>
         f.toLowerCase().includes(`/${dir.toLowerCase()}/`),
      );
      for (const f of distMatches) {
         hits.push({ file: f, reason: `built under excluded path "${dir}"` });
      }
   }

   // 2. A forbidden title leaking as an <a>...</a> link's visible text.
   const anchorText = /<a\b[^>]*>([^<]*)<\/a>/gi;
   const distFiles = walkFiles(DIST_DIR).filter((f) => f.endsWith(".html"));
   for (const file of distFiles) {
      const text = fs.readFileSync(file, "utf8");
      let match;
      const re = new RegExp(anchorText);
      while ((match = re.exec(text))) {
         const linkText = match[1].trim();
         if (forbiddenTitles.has(linkText)) {
            hits.push({
               file,
               reason: `a link's visible text is the excluded title "${linkText}"`,
            });
         }
      }
   }

   // 3. Every published vault image must be referenced by some built page.
   // Ingest only copies images that published docs embed; an orphan here
   // means that gate was bypassed (or a stale file survived a rebuild).
   const assetDir = path.join(DIST_DIR, "vault-assets");
   const assetFiles = walkFiles(assetDir);
   if (assetFiles.length > 0) {
      const html = distFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
      for (const f of assetFiles) {
         const url = "/" + path.relative(DIST_DIR, f).split(path.sep).join("/");
         if (!html.includes(`"${url}"`)) {
            hits.push({ file: f, reason: `published vault asset "${url}" is not embedded by any page` });
         }
      }
   }

   if (hits.length > 0) {
      console.error(`[privacy-gate] FAILED — ${hits.length} leak(s) found:`);
      for (const hit of hits) {
         console.error(`  ${path.relative(ROOT, hit.file)}: ${hit.reason}`);
      }
      process.exit(1);
   }

   console.log(
      `[privacy-gate] OK — no leaks across ${distFiles.length} built pages (checked ${forbiddenTitles.size} excluded titles, ${assetFiles.length} published vault assets).`,
   );
}

main();
