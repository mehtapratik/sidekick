#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(__dirname, "../src/content");
const OUT = path.join(__dirname, "../public/search-index.json");
const CATS = ["essays", "plans", "decisions", "builds", "notes"];

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) return { data: {}, body: raw };
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: raw };
  const data = yaml.load(raw.slice(4, end)) || {};
  return { data };
}

const index = [];
for (const cat of CATS) {
  const dir = path.join(CONTENT, cat);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const { data } = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, "");
    index.push({
      title: data.title,
      deck: data.deck,
      category: cat,
      tags: data.tags || [],
      date: data.pubDate,
      url: `/${cat}/${slug}/`,
    });
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(index, null, 2));
console.log(`Wrote search index (${index.length} entries)`);
