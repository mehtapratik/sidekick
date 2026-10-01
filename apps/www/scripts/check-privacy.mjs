// Post-build gate (SPEC 3.1 and 10). Fails the build when private material reaches dist/.
// Structural on purpose: published notes legitimately discuss "private" things, and short
// private titles ("Reality") collide with ordinary words, so a blanket grep would cry wolf.
import fs from "node:fs";
import path from "node:path";
import { scanVault, parseFrontmatter } from "../src/lib/vault.mjs";

const DIST = path.join(process.cwd(), "dist");
const problems = [];

function walk(dir, out = []) {
   for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else out.push(p);
   }
   return out;
}

const files = scanVault();
const built = walk(DIST).filter((f) => /\.(html|xml)$/.test(f));
const squash = (s) => s.replace(/\s+/g, " ").trim();
// Markdown punctuation is dropped from both sides so a leaked line matches however it renders.
const fold = (s) => squash(s.replace(/[#*>`|\[\]_]/g, " "));
const plain = (html) =>
   fold(
      html
         .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
         .replace(/<[^>]+>/g, " ")
         .replace(/&#x27;|&#39;/g, "'")
         .replace(/&#x26;|&amp;/g, "&")
         .replace(/&quot;/g, '"')
         .replace(/&lt;/g, "<")
         .replace(/&gt;/g, ">"),
   );

// 1. A published entry may not carry the old `private` tag.
for (const f of files.filter((f) => f.published)) {
   const tags = (
      parseFrontmatter(fs.readFileSync(f.abs, "utf8")).tags ?? []
   ).map((t) => String(t).toLowerCase());
   if (tags.includes("private"))
      problems.push(`published entry carries a "private" tag: ${f.rel}`);
}

// 2. Pages exist for exactly the published entries.
const pages = new Set(
   built
      .filter((f) => f.endsWith("index.html"))
      .map(
         (f) =>
            "/" +
            path.relative(DIST, path.dirname(f)).split(path.sep).join("/") +
            "/",
      ),
);
for (const f of files) {
   if (f.published && !pages.has(f.url))
      problems.push(`published entry has no page: ${f.rel} -> ${f.url}`);
   if (!f.published && f.url && pages.has(f.url))
      problems.push(`unpublished entry was built: ${f.rel} -> ${f.url}`);
}

// 3. Text from the private vault folders must not appear in any built file.
//    (_archive is superseded, not private: its text legitimately lives on in newer notes.)
const hidden = files.filter((f) => f.excluded || !f.published);
const needles = [];
const isPrivate = (f) =>
   f.collection === "docs" && /^(00-principles|01-motivations)\//.test(f.rel);
for (const f of files.filter(isPrivate)) {
   const body = fs.readFileSync(f.abs, "utf8").replace(/^---[\s\S]*?\n---/, "");
   for (const line of body.split("\n")) {
      const t = fold(line.replace(/^\s*[-\d.]+\s/, ""));
      if (t.length >= 60) needles.push({ from: f.rel, text: t });
   }
}
const pagesText = built.map((f) => ({
   f,
   text: plain(fs.readFileSync(f, "utf8")),
}));
for (const { f, text } of pagesText) {
   for (const n of needles) {
      if (text.includes(n.text))
         problems.push(
            `${path.relative(DIST, f)} repeats a line from ${n.from}`,
         );
   }
}

// 4. No link into an excluded path.
for (const f of built) {
   const html = fs.readFileSync(f, "utf8");
   for (const m of html.matchAll(/href="([^"]*)"/g)) {
      if (
         /(^|\/)(00-principles|01-motivations|_archive|_assets_|\.obsidian)(\/|$)/.test(
            m[1],
         )
      ) {
         problems.push(
            `${path.relative(DIST, f)} links to an excluded path: ${m[1]}`,
         );
      }
   }
}

if (problems.length) {
   console.error(
      "Privacy gate failed:\n - " + [...new Set(problems)].join("\n - "),
   );
   process.exit(1);
}
console.log(
   `Privacy gate ok: ${files.filter((f) => f.published).length} published, ${hidden.length} withheld, ${built.length} files checked.`,
);
