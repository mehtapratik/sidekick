import { dump, load } from "js-yaml";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DOCS_ROOT = process.env.DOCS_ROOT
   ? path.resolve(process.env.DOCS_ROOT)
   : path.resolve(ROOT, "../sidekick/docs");
const CONTENT_DIR = path.join(ROOT, "src/content");
const META_PATH = path.join(ROOT, "content-meta.yaml");

function loadMeta() {
   return load(fs.readFileSync(META_PATH, "utf8"));
}

function slugify(name) {
   return name.replace(/\.md$/i, "").replace(/_/g, "-").toLowerCase();
}

function resolveCategory(relativePath) {
   const norm = relativePath.split(path.sep).join("/");
   if (norm.startsWith("essays/")) return "essays";
   if (norm.startsWith("plans/")) return "plans";
   if (norm.startsWith("decisions/")) return "decisions";
   if (norm.startsWith("builds/")) return "builds";
   if (norm.startsWith("notes/")) return "notes";
   return null;
}

function parseFrontmatter(raw) {
   if (!raw.startsWith("---\n")) return { attrs: {}, body: raw };
   const end = raw.indexOf("\n---\n", 4);
   if (end === -1) return { attrs: {}, body: raw };
   const attrs = load(raw.slice(4, end)) ?? {};
   const body = raw.slice(end + 5);
   return { attrs, body };
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
   } catch {}
   return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
}

function wordCount(text) {
   return text.trim().split(/\s+/).filter(Boolean).length;
}

function walkMd(dir, base = "") {
   if (!fs.existsSync(dir)) {
      console.error(`DOCS_ROOT not found: ${DOCS_ROOT}`);
      process.exit(1);
   }
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
   const defaults = meta.defaults ?? {};
   const overrides = meta.entries ?? {};
   const slugIndex = new Map();

   clearContentDir();

   let written = 0;

   for (const { full, rel } of walkMd(DOCS_ROOT)) {
      const category = resolveCategory(rel);
      if (!category) continue;
      if (path.basename(rel) === "index.md") continue;

      const slug = slugify(path.basename(rel));
      const qualified = `${category}/${slug}`;
      if (slugIndex.has(qualified)) {
         throw new Error(`Duplicate slug: ${qualified}`);
      }
      slugIndex.set(qualified, true);

      const raw = fs.readFileSync(full, "utf8");
      const { attrs, body } = parseFrontmatter(raw);
      const override = overrides[slug] ?? {};

      // Publishing gate — only files with status: active are included
      const effectiveStatus = override.status ?? attrs.status ?? "draft";
      if (effectiveStatus !== "active") continue;

      const title = override.title ?? attrs.title ?? "Untitled post";
      const deck = override.deck ?? attrs.deck ?? "";
      const cleanBody = body.replace(/^\s*#\s+.+\r?\n+/, "");
      const created = override.date ?? attrs.created ?? gitDate(full);
      const updated = override.updated ?? attrs.updated ?? created;
      const wc = wordCount(cleanBody);

      const frontmatter = {
         title,
         deck,
         created,
         updated,
         version: override.version ?? attrs.version ?? defaults.version ?? 1,
         tags: override.tags ?? attrs.tags ?? [],
         category,
         sourcePath: rel,
         wordCount: wc,
         readingMinutes: Math.max(1, Math.ceil(wc / 220)),
         author:
            override.author ??
            attrs.author ??
            defaults.author ??
            "Pratik Mehta",
         license: defaults.license ?? "CC BY-NC 4.0",
         audience: override.audience ?? attrs.audience ?? "",
         status: effectiveStatus,
         description: override.description ?? attrs.description ?? deck,
      };

      const outPath = path.join(CONTENT_DIR, category, `${slug}.md`);
      fs.writeFileSync(
         outPath,
         `---\n${dump(frontmatter).trim()}\n---\n\n${cleanBody.trim()}\n`,
      );
      written++;
   }

   // Validate and resolve the hero (featured) post
   const heroRef = meta.site?.hero;
   if (!heroRef) throw new Error("content-meta.yaml: site.hero is required");

   let heroQualified = heroRef;
   if (!heroRef.includes("/")) {
      console.log(heroRef, slugIndex.keys());
      const matches = [...slugIndex.keys()].filter((k) =>
         k.endsWith(`/${heroRef}`),
      );
      if (matches.length === 0)
         throw new Error(`site.hero "${heroRef}" not found or not active`);
      if (matches.length > 1)
         throw new Error(
            `site.hero "${heroRef}" is ambiguous: ${matches.join(", ")}`,
         );
      heroQualified = matches[0];
   } else if (!slugIndex.has(heroQualified)) {
      throw new Error(`site.hero "${heroRef}" not found or not active`);
   }

   fs.mkdirSync(path.join(ROOT, "src/lib"), { recursive: true });
   fs.writeFileSync(
      path.join(ROOT, "src/lib/ingest-manifest.json"),
      JSON.stringify(
         {
            hero: heroQualified,
            heroImage: meta.site?.heroImage ?? null,
            count: written,
            docsRoot: DOCS_ROOT,
            generatedAt: new Date().toISOString(),
         },
         null,
         2,
      ),
   );

   console.log(`✓ Ingested ${written} active posts from ${DOCS_ROOT}`);
}

main();
