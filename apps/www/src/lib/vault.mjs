// Shared by astro.config.mjs (Markdown plugins), src/content.config.ts (loaders)
// and scripts/check-privacy.mjs. Plain .mjs so all three can import it.
//
// It reads the authoring folders directly. There is no ingest or copy step.
import fs from "node:fs";
import path from "node:path";
import { load as loadYaml } from "js-yaml";

const cwd = process.cwd();
export const WRITINGS_DIR = path.join(cwd, "sources/writings");
export const DOCS_DIR = path.join(cwd, "sources/docs");
export const ASSETS_DIR = path.join(DOCS_DIR, "_assets_");

/** Never built, whatever their frontmatter says (SPEC 3.1). */
export const WRITINGS_EXCLUDE = ["_archive/**"];
export const DOCS_EXCLUDE = [
   "00-principles/**",
   "01-motivations/**",
   "_assets_/**",
   ".obsidian/**",
   "**/*.canvas",
];

/** Vault folder -> URL slug and Index label. Array order is the Index order. */
export const SECTIONS = [
   { dir: "02-prd", slug: "prd", label: "Product requirements" },
   { dir: "03-system-design", slug: "system-design", label: "System design" },
   { dir: "04-plans", slug: "plans", label: "Plans" },
   { dir: "05-builds", slug: "builds", label: "Builds" },
   { dir: "06-decisions", slug: "decisions", label: "Decisions" },
   { dir: "07-glossary", slug: "glossary", label: "Glossary" },
   { dir: "08-ai-coding-harness", slug: "harness", label: "AI coding harness" },
];

/** Acronyms and proper nouns for titles derived from file names (whole words, any case). */
const TITLE_DICTIONARY = [
   "API", "PRD", "RLS", "AI", "UX", "UI", "CLI", "DB", "PWA", "RAG", "SQL", "JSON", "YAML",
   "HTTP", "URL", "ID", "OG", "RSS", "SEO", "CSS", "HTML", "JS", "TS", "ESLint", "GraphQL",
   "Relay", "TypeScript", "Turborepo", "Vercel", "Supabase", "Postgres", "Next.js", "pnpm",
   "tsup", "dotenv", "Drizzle", "Capacitor", "Tiptap", "Taxila", "Zinsser", "Parrot", "SaaS", "iOS",
];
const dictionary = new Map(TITLE_DICTIONARY.map((w) => [w.toLowerCase().replace(".", " "), w]));

/** Does a path relative to a collection's root match one of its exclude globs? */
export function isExcluded(rel, patterns) {
   return patterns.some((p) => {
      if (p.endsWith("/**")) {
         const dir = p.slice(0, -3);
         return rel === dir || rel.startsWith(dir + "/");
      }
      if (p.startsWith("**/*.")) return rel.endsWith(p.slice(4));
      return rel === p;
   });
}

/** `02-features` -> `features`; spaces and underscores -> `-`; lower case. */
const slugSegment = (s) =>
   s
      .toLowerCase()
      .replace(/[\s_—–]+/g, "-")
      .replace(/[^a-z0-9.\-]/g, "") // "?", ",", quotes: dropped, as in "get-the-interface-schema-…"
      .replace(/^\d+-/, "");

/** `sources/writings/00-margins.md` keeps its prefix: `00-margins`. */
export const writingSlug = (rel) => rel.replace(/\.md$/, "");

/** `02-prd/features/00-core-drive/index.md`-style path -> `prd/features/core-drive/...`. */
export function docSlug(rel) {
   const segments = rel.replace(/\.md$/, "").split("/");
   const section = SECTIONS.find((s) => s.dir === segments[0]);
   if (!section) throw new Error(`Doc outside a configured section: ${rel}`);
   return [section.slug, ...segments.slice(1).map(slugSegment)].join("/");
}

/** Sentence-cased title from a file name; used when frontmatter has no `title`. */
export function deriveTitle(file) {
   let s = path
      .basename(file)
      .replace(/\.md$/, "")
      .replace(/^\d+[-_]/, "")
      .replace(/^_/, "")
      .replace(/[-_—]+/g, " ")
      .trim();
   s = s.charAt(0).toUpperCase() + s.slice(1);
   s = s.replace(/(\d) (?=\d)/g, "$1."); // "task 1 1" -> "task 1.1"
   return s
      .split(" ")
      .map((w) => dictionary.get(w.toLowerCase()) ?? w)
      .join(" ")
      .replace(/\bNext js\b/i, "Next.js");
}

/** GitHub-style heading slug, for `[[Note#Heading]]`. */
export const headingSlug = (text) =>
   text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");

export function parseFrontmatter(source) {
   const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
   if (!m) return {};
   try {
      return loadYaml(m[1]) ?? {};
   } catch {
      return {};
   }
}

function walk(dir, out = []) {
   if (!fs.existsSync(dir)) return out;
   for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith(".md")) out.push(p);
   }
   return out;
}

let cache;

/**
 * Every Markdown file in both authoring folders, published or not, so wikilinks can tell
 * "published" from "private" from "missing". Cached for the life of the process.
 */
export function scanVault() {
   if (cache) return cache;
   const files = [];
   const roots = [
      { collection: "writings", root: WRITINGS_DIR, exclude: WRITINGS_EXCLUDE },
      { collection: "docs", root: DOCS_DIR, exclude: DOCS_EXCLUDE },
   ];
   for (const { collection, root, exclude } of roots) {
      for (const abs of walk(root)) {
         const rel = path.relative(root, abs).split(path.sep).join("/");
         const excluded = isExcluded(rel, exclude);
         const fm = parseFrontmatter(fs.readFileSync(abs, "utf8"));
         const slug = excluded ? null : collection === "docs" ? docSlug(rel) : writingSlug(rel);
         files.push({
            collection,
            rel,
            abs,
            excluded,
            slug,
            url: slug && (collection === "docs" ? `/docs/${slug}/` : `/writings/${slug}/`),
            published: !excluded && fm.publish === true,
            title: fm.title ? String(fm.title) : deriveTitle(rel),
            stem: rel.replace(/\.md$/, ""),
         });
      }
   }
   const urls = new Map();
   for (const f of files) {
      if (!f.url) continue;
      if (urls.has(f.url)) throw new Error(`URL collision: ${f.rel} and ${urls.get(f.url)} -> ${f.url}`);
      urls.set(f.url, f.rel);
   }
   cache = files;
   return files;
}

/**
 * Resolve a wikilink target the way Obsidian users expect: relative to the current
 * file's folder, then from the vault root, then by a unique base name.
 * Returns the scanned file or null.
 */
export function resolveWikilink(target, fromRel, fromCollection) {
   const files = scanVault().filter((f) => f.collection === "docs");
   const clean = target.trim().replace(/\.md$/, "").toLowerCase();
   if (!clean) return null;
   const byStem = new Map(files.map((f) => [f.stem.toLowerCase(), f]));
   if (fromCollection === "docs") {
      const here = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), clean));
      if (byStem.has(here)) return byStem.get(here);
   }
   if (byStem.has(clean)) return byStem.get(clean);
   const base = clean.split("/").pop();
   const hits = files.filter((f) => f.stem.toLowerCase().split("/").pop() === base);
   return hits.length === 1 ? hits[0] : null;
}
