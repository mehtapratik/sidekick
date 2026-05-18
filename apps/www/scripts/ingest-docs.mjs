#!/usr/bin/env node
/**
 * Ingest markdown from sidekick/docs into src/content/{category}/
 * Run before astro build (prebuild).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DOCS_ROOT = process.env.DOCS_ROOT
  ? path.resolve(process.env.DOCS_ROOT)
  : path.resolve(ROOT, "../sidekick/docs");
const CONTENT_DIR = path.join(ROOT, "src/content");
const META_PATH = path.join(ROOT, "content-meta.yaml");

const SKIP_BASENAMES = new Set(["index.md"]);
const SKIP_PREFIXES = [path.join("ai") + path.sep];

function loadMeta() {
  return yaml.load(fs.readFileSync(META_PATH, "utf8"));
}

function slugify(name) {
  return name
    .replace(/\.md$/i, "")
    .replace(/_/g, "-")
    .toLowerCase();
}

function shouldSkip(relativePath) {
  const base = path.basename(relativePath);
  if (SKIP_BASENAMES.has(base)) return true;
  const norm = relativePath.split(path.sep).join(path.sep);
  return SKIP_PREFIXES.some((p) => norm.startsWith(p.replace(/\//g, path.sep)));
}

function resolveCategory(relativePath) {
  const norm = relativePath.split(path.sep).join("/");
  if (norm.startsWith("writings/")) return "essays";
  if (norm === "implementation-plan.md" || norm.startsWith("plans/"))
    return "plans";
  if (norm.startsWith("decisions/")) return "decisions";
  if (norm.startsWith("learn/diy/")) return "builds";
  if (norm.startsWith("learn/") || norm === "architecture-handover.md")
    return "notes";
  return null;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) return { attrs: {}, body: raw };
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return { attrs: {}, body: raw };
  const fm = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const attrs = yaml.load(fm) || {};
  return { attrs, body };
}

function extractTitle(body, attrs, filename) {
  if (attrs.title && typeof attrs.title === "string") return attrs.title;
  const m = body.match(/^#\s+(.+)$/m);
  if (m) return m[1].trim();
  return slugify(filename)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractDeck(body, override) {
  if (override) return override;
  const lines = body.split("\n");
  let started = false;
  for (const line of lines) {
    if (line.startsWith("# ")) {
      started = true;
      continue;
    }
    if (!started) continue;
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith(">")) continue;
    // Skip horizontal rules (---, ***, ___) and pure-punctuation lines
    if (/^[-_*]{3,}\s*$/.test(trimmed)) continue;
    const t = trimmed.replace(/\*\*/g, "").replace(/_/g, "");
    if (t.length === 0) continue;
    return t.length > 200 ? `${t.slice(0, 197)}…` : t;
  }
  return "";
}

function gitDate(filePath) {
  try {
    const repoRoot = path.dirname(DOCS_ROOT);
    const rel = path.relative(repoRoot, filePath);
    const out = execSync(`git log -1 --format=%cs -- "${rel}"`, {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    if (out) return out;
  } catch {
    /* fallback */
  }
  const stat = fs.statSync(filePath);
  return stat.mtime.toISOString().slice(0, 10);
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readingMinutes(text) {
  return Math.max(1, Math.ceil(wordCount(text) / 220));
}

function walkMd(dir, base = "") {
  const entries = [];
  if (!fs.existsSync(dir)) {
    console.error(`DOCS_ROOT not found: ${DOCS_ROOT}`);
    process.exit(1);
  }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      entries.push(...walkMd(full, rel));
    } else if (name.endsWith(".md")) {
      entries.push({ full, rel: rel.split(path.sep).join("/") });
    }
  }
  return entries;
}

function clearContentDir() {
  for (const cat of ["essays", "plans", "decisions", "builds", "notes"]) {
    const dir = path.join(CONTENT_DIR, cat);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".md")) fs.unlinkSync(path.join(dir, f));
    }
  }
}

function main() {
  const meta = loadMeta();
  const defaults = meta.defaults || {};
  const entryOverrides = meta.entries || {};
  const slugIndex = new Map(); // key: `${category}/${slug}`

  clearContentDir();

  const files = walkMd(DOCS_ROOT);
  let written = 0;

  for (const { full, rel } of files) {
    if (shouldSkip(rel)) continue;
    const category = resolveCategory(rel);
    if (!category) continue;

    const slug = slugify(path.basename(rel));
    const qualified = `${category}/${slug}`;
    if (slugIndex.has(qualified)) {
      throw new Error(`Duplicate path "${qualified}"`);
    }
    slugIndex.set(qualified, true);

    const raw = fs.readFileSync(full, "utf8");
    const { attrs, body } = parseFrontmatter(raw);
    const override = entryOverrides[slug] || {};

    if (override.draft === true) continue;

    const title = override.title || extractTitle(body, attrs, path.basename(rel));
    const deck = extractDeck(body, override.deck);
    // Strip the leading H1 from the body if it matches the title — we render
    // it via the article header instead, to avoid duplicate H1s.
    const cleanBody = body.replace(/^\s*#\s+.+\r?\n+/, "");
    const pubDate = override.date || gitDate(full);
    const updated = override.updated || pubDate;
    const tags = override.tags || [];
    const version = override.version ?? defaults.version ?? 1;
    const wc = wordCount(cleanBody);
    const readMin = readingMinutes(cleanBody);

    const outFm = {
      title,
      deck,
      pubDate,
      updated,
      version,
      tags,
      draft: false,
      category,
      sourcePath: rel,
      wordCount: wc,
      readingMinutes: readMin,
      author: defaults.author || "Pratik Mehta",
      license: defaults.license || "CC BY-NC 4.0",
    };

    const outPath = path.join(CONTENT_DIR, category, `${slug}.md`);
    const outBody = `---\n${yaml.dump(outFm).trim()}\n---\n\n${cleanBody.trim()}\n`;
    fs.writeFileSync(outPath, outBody, "utf8");
    written++;
  }

  const heroRef = meta.site?.hero;
  if (!heroRef) {
    throw new Error("content-meta.yaml: site.hero is required");
  }
  let heroQualified = heroRef;
  if (!heroRef.includes("/")) {
    const matches = [...slugIndex.keys()].filter((k) => k.endsWith(`/${heroRef}`));
    if (matches.length === 0) {
      throw new Error(
        `site.hero "${heroRef}" not found among ingested posts (draft or missing file).`,
      );
    }
    if (matches.length > 1) {
      throw new Error(
        `site.hero "${heroRef}" is ambiguous (${matches.join(", ")}). Use category/slug.`,
      );
    }
    heroQualified = matches[0];
  } else if (!slugIndex.has(heroQualified)) {
    throw new Error(`site.hero "${heroRef}" not found among ingested posts.`);
  }
  const heroSlug = heroQualified.split("/").pop();
  if (entryOverrides[heroSlug]?.draft === true) {
    throw new Error(`site.hero "${heroRef}" points to a draft entry.`);
  }

  fs.writeFileSync(
    path.join(ROOT, "src/lib/ingest-manifest.json"),
    JSON.stringify(
      {
        docsRoot: DOCS_ROOT,
        count: written,
        hero: heroRef,
        heroImage: meta.site?.heroImage ?? null,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Ingested ${written} posts from ${DOCS_ROOT}`);
}

main();
