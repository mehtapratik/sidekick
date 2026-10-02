// Obsidian syntax -> mdast (SPEC 6): wikilinks, embeds, callouts, and the duplicated leading H1.
import fs from "node:fs";
import path from "node:path";
import { visit, SKIP } from "unist-util-visit";
import {
   ASSETS_DIR,
   DOCS_DIR,
   WRITINGS_DIR,
   headingSlug,
   resolveWikilink,
   scanVault,
} from "../lib/vault.mjs";

const WIKI = /(!?)\[\[([^\]\n]+)\]\]/g;
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const textOf = (node) =>
   node.value ?? (node.children ?? []).map(textOf).join("");

/** Natural size of an embedded image, or null when the format is not recognised. */
function imageSize(file) {
   const buf = fs.readFileSync(file);
   const ext = path.extname(file).toLowerCase();
   if (ext === ".svg") {
      const s = buf.toString("utf8");
      const w = s.match(/<svg[^>]*\swidth="([\d.]+)(?:px)?"/);
      const h = s.match(/<svg[^>]*\sheight="([\d.]+)(?:px)?"/);
      if (w && h) return { width: +w[1], height: +h[1] };
      const vb = s.match(
         /viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/,
      );
      return vb ? { width: +vb[1], height: +vb[2] } : null;
   }
   if (ext === ".png")
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
   if (ext === ".gif")
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
   if (ext === ".jpg" || ext === ".jpeg") {
      for (let i = 2; i < buf.length;) {
         if (buf[i] !== 0xff) return null;
         const marker = buf[i + 1];
         if (marker >= 0xc0 && marker <= 0xc3)
            return {
               height: buf.readUInt16BE(i + 5),
               width: buf.readUInt16BE(i + 7),
            };
         i += 2 + buf.readUInt16BE(i + 2);
      }
   }
   return null;
}

function findAsset(name) {
   const want = path.basename(name).toLowerCase();
   const stack = [ASSETS_DIR];
   while (stack.length) {
      const dir = stack.pop();
      if (!fs.existsSync(dir)) continue;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
         const p = path.join(dir, e.name);
         if (e.isDirectory()) stack.push(p);
         else if (e.name.toLowerCase() === want) return p;
      }
   }
   return null;
}

function embed(raw) {
   const [target, option] = raw.split("|").map((s) => s.trim());
   const file = findAsset(target);
   if (!file) return { type: "text", value: "" };
   const size = imageSize(file);
   const asNumber = option && /^\d+$/.test(option) ? +option : null;
   const props = { loading: "lazy" };
   if (size) {
      props.width = asNumber ?? size.width;
      props.height = asNumber
         ? Math.round((asNumber * size.height) / size.width)
         : size.height;
   }
   return {
      type: "image",
      url:
         "/vault-assets/" +
         path.relative(ASSETS_DIR, file).split(path.sep).join("/"),
      alt:
         option && !asNumber
            ? option
            : path.basename(target, path.extname(target)),
      data: { hProperties: props },
   };
}

/** Resolve `target#heading` to a published URL, or null (unpublished, private or missing). */
function resolveTarget(targetAndHeading, fromRel, fromCollection) {
   const [target, ...h] = targetAndHeading.split("#");
   const heading = h.join("#").trim();
   const anchor = heading ? "#" + headingSlug(heading) : "";
   if (!target.trim()) return { url: anchor, title: heading, heading: "" };
   const hit = resolveWikilink(target, fromRel, fromCollection);
   if (!hit?.published) return null;
   return { url: hit.url + anchor, title: hit.title, heading };
}

function wikilink(raw, fromRel, fromCollection) {
   const [targetAndHeading, ...rest] = raw.split("|");
   const label = rest.join("|").trim();
   const typed =
      targetAndHeading.split("#")[0].trim().split("/").pop() ||
      targetAndHeading.split("#")[1];
   const hit = resolveTarget(targetAndHeading, fromRel, fromCollection);
   // Unpublished, private or missing: plain text, never a dead link.
   // A private note's own title is never used as the text.
   if (!hit) return { type: "text", value: label || typed };
   return {
      type: "link",
      url: hit.url,
      children: [
         {
            type: "text",
            value:
               label ||
               (hit.heading ? `${hit.title} > ${hit.heading}` : hit.title),
         },
      ],
   };
}

/**
 * `[[target|Label with `code` or *emphasis*]]`: the brackets sit in different sibling nodes,
 * so the per-text-node pass cannot see them. Join the span here.
 */
function spanningWikilinks(parent, fromRel, fromCollection) {
   const kids = parent.children;
   for (let i = 0; i < kids.length; i++) {
      const first = kids[i];
      if (first.type !== "text") continue;
      const open = first.value.lastIndexOf("[[");
      if (open < 0 || first.value.indexOf("]]", open) >= 0) continue;
      let j = i + 1;
      while (
         j < kids.length &&
         !(kids[j].type === "text" && kids[j].value.includes("]]"))
      )
         j++;
      if (j >= kids.length) continue;
      const inner1 = first.value.slice(open + 2);
      const bar = inner1.indexOf("|");
      if (bar < 0) continue;
      const close = kids[j].value.indexOf("]]");
      const label = [
         { type: "text", value: inner1.slice(bar + 1) },
         ...kids.slice(i + 1, j),
         { type: "text", value: kids[j].value.slice(0, close) },
      ].filter((n) => n.type !== "text" || n.value);
      const hit = resolveTarget(inner1.slice(0, bar), fromRel, fromCollection);
      const replacement = [
         { type: "text", value: first.value.slice(0, open) },
         ...(hit ? [{ type: "link", url: hit.url, children: label }] : label),
         { type: "text", value: kids[j].value.slice(close + 2) },
      ].filter((n) => n.type !== "text" || n.value);
      kids.splice(i, j - i + 1, ...replacement);
   }
}

function callouts(tree) {
   visit(tree, "blockquote", (node) => {
      const p = node.children[0];
      const t = p?.type === "paragraph" ? p.children[0] : null;
      const m =
         t?.type === "text" &&
         t.value.match(/^\[!([\w-]+)\][+-]?[ \t]*([^\n]*)(?:\n|$)/);
      if (!m) return;
      const title = m[2].trim() || m[1][0].toUpperCase() + m[1].slice(1);
      t.value = t.value.slice(m[0].length);
      if (!t.value) p.children.shift();
      if (!p.children.length) node.children.shift();
      node.children.unshift({
         type: "paragraph",
         data: { hProperties: { className: ["callout-title"] } },
         children: [{ type: "text", value: title }],
      });
      node.data = { hName: "aside", hProperties: { className: ["callout"] } };
   });
}

/**
 * remark-math pairs any two `$`, so prices ("$2 / $12", "$20 Pro … $60") become broken equations.
 * Obsidian's rule is stricter: no space just inside either `$`, and no digit right after the closing
 * one. Anything that fails it goes back to the exact text the author wrote.
 */
function obsidianInlineMath(tree, source) {
   visit(tree, "inlineMath", (node, index, parent) => {
      const { start, end } = node.position ?? {};
      if (!start || !parent) return;
      const raw = source.slice(start.offset, end.offset);
      if (!raw.startsWith("$") || raw.startsWith("$$")) return;
      const inner = raw.slice(1, -1);
      if (/^\s|\s$/.test(inner) || /\d/.test(source[end.offset] ?? "")) {
         parent.children[index] = { type: "text", value: raw };
      }
   });
}

export function remarkVault() {
   return (tree, file) => {
      const abs = file.path ?? "";
      const collection = abs.startsWith(WRITINGS_DIR) ? "writings" : "docs";
      const root = collection === "writings" ? WRITINGS_DIR : DOCS_DIR;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      const record = scanVault().find(
         (f) => f.collection === collection && f.rel === rel,
      );

      // The page template renders the h1. Drop a leading "# Title" that repeats it.
      // A vault note's own H1 is a duplicate even when worded differently; in an essay it may be a heading.
      const first = tree.children[0];
      if (first?.type === "heading" && first.depth === 1) {
         if (
            collection === "docs" ||
            norm(textOf(first)) === norm(record?.title ?? "")
         )
            tree.children.shift();
      }
      visit(tree, "heading", (h) => {
         if (h.depth === 1) h.depth = 2;
      });

      callouts(tree);
      obsidianInlineMath(tree, String(file.value));

      visit(
         tree,
         (n) => Array.isArray(n.children) && n.type !== "link",
         (n) => spanningWikilinks(n, rel, collection),
      );

      visit(tree, "text", (node, index, parent) => {
         if (!parent || parent.type === "link" || !node.value.includes("[["))
            return;
         const out = [];
         let last = 0;
         for (const m of node.value.matchAll(WIKI)) {
            if (m.index > last)
               out.push({
                  type: "text",
                  value: node.value.slice(last, m.index),
               });
            out.push(m[1] ? embed(m[2]) : wikilink(m[2], rel, collection));
            last = m.index + m[0].length;
         }
         if (last < node.value.length)
            out.push({ type: "text", value: node.value.slice(last) });
         parent.children.splice(index, 1, ...out);
         return [SKIP, index + out.length];
      });
   };
}
