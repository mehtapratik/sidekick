// Post-build gate (SPEC 3.1 and 10). Fails the build when private material reaches dist/.
// Structural on purpose: published notes legitimately discuss "private" things, so a blanket grep
// for words would cry wolf. It checks the opt-in rule, the old `private` tag and excluded paths.
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

// 3. Entries that are not published stay out of the build, whatever else links to them.
const hidden = files.filter((f) => f.excluded || !f.published);

// 4. No link into an excluded path.
for (const f of built) {
   const html = fs.readFileSync(f, "utf8");
   for (const m of html.matchAll(/href="([^"]*)"/g)) {
      if (
         /(^|\/)(_archive|_assets_|\.obsidian)(\/|$)/.test(
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
