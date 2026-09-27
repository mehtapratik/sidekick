import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import rehypeSlug from "rehype-slug";
import { visit, SKIP } from "unist-util-visit";
import arkiveLight from "./src/lib/shiki-themes/arkive-light.json" with { type: "json" };
import arkiveDark from "./src/lib/shiki-themes/arkive-dark.json" with { type: "json" };
import linkManifest from "./src/lib/link-manifest.json" with { type: "json" };
import { transformerNotationHighlight } from "@shikijs/transformers";
import { iconSvg } from "./src/lib/icons.js";
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

// Repo-relative vault root ("sources/docs/"): a doc's sourcePath starts with it.
const VAULT_PREFIX =
  path.posix.normalize(load(fs.readFileSync("./content-meta.yaml", "utf8")).vault.root).replace(/\/?$/, "/");

function rehypeTLDR() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "h2" || !parent) return;

      const text = node.children
        .filter((c) => c.type === "text")
        .map((c) => c.value)
        .join("")
        .trim();
      if (text !== "TL;DR") return;

      // Collect all siblings after this h2 until the next h2
      const siblings = parent.children;
      const start = siblings.indexOf(node);
      let end = start + 1;
      while (end < siblings.length) {
        const s = siblings[end];
        if (s.type === "element" && s.tagName === "h2") break;
        end++;
      }

      const content = siblings.slice(start + 1, end);

      const card = {
        type: "element",
        tagName: "div",
        properties: { className: ["tldr-card"], role: "note", "aria-label": "TL;DR summary" },
        children: [
          {
            type: "element",
            tagName: "p",
            properties: { className: ["tldr-card__label"] },
            children: [{ type: "text", value: "TL;DR" }],
          },
          ...content,
        ],
      };

      siblings.splice(start, end - start, card);
    });
  };
}

// A thematic break renders as a centred § (drawn by CSS).
function rehypeOrnament() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "hr") return;
      node.tagName = "div";
      node.properties = { className: ["ornament"], role: "separator" };
      node.children = [];
    });
  };
}

// Turns GitHub/Obsidian-style admonition blockquotes into styled callouts:
//   > [!info]
//   > Body text.
// Unmarked blockquotes are left alone and keep the pull-quote treatment.
// Output: div.callout.callout--<type>[role=note] > p.callout__label (icon +
// label) + div.callout__body.
const CALLOUT_TYPES = {
  info: { className: "info", label: "Info" },
  note: { className: "note", label: "Note" },
  caution: { className: "caution", label: "Caution" },
  warning: { className: "warning", label: "Warning" },
  danger: { className: "danger", label: "Danger" },
  alert: { className: "danger", label: "Danger" },
  ref: { className: "see-also", label: "See also" },
  reference: { className: "see-also", label: "See also" },
  "see-also": { className: "see-also", label: "See also" },
  question: { className: "question", label: "Question" },
};

function rehypeCallout() {
  const MARKER = /^\s*\[!([a-zA-Z-]+)\]\s?/;

  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "blockquote") return;

      const firstP = node.children.find(
        (c) => c.type === "element" && c.tagName === "p",
      );
      if (!firstP) return;

      const firstText = firstP.children.find((c) => c.type === "text");
      if (!firstText) return;

      const match = MARKER.exec(firstText.value);
      if (!match) return;

      const meta = CALLOUT_TYPES[match[1].toLowerCase()];
      if (!meta) return;

      firstText.value = firstText.value.slice(match[0].length);
      // Drop the now-empty leading text node (and a line break right
      // after the marker) so the body doesn't start with a blank run.
      if (firstText.value.trim() === "") {
        firstP.children = firstP.children.filter((c) => c !== firstText);
        if (firstP.children[0]?.type === "element" && firstP.children[0].tagName === "br") {
          firstP.children.shift();
        }
      }
      const body = node.children.filter(
        (c) => !(c === firstP && firstP.children.every((x) => x.type === "text" && !x.value.trim())),
      );

      node.tagName = "div";
      node.properties = {
        className: ["callout", `callout--${meta.className}`],
        role: "note",
      };
      node.children = [
        {
          type: "element",
          tagName: "p",
          properties: { className: ["callout__label"] },
          children: [
            { type: "raw", value: iconSvg(meta.className) },
            { type: "text", value: meta.label },
          ],
        },
        {
          type: "element",
          tagName: "div",
          properties: { className: ["callout__body"] },
          children: body,
        },
      ];
    });
  };
}

function textOf(node) {
  if (node.type === "text") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

// Wraps every markdown table in a scrollable, keyboard-focusable region so
// wide tables scroll inside their box instead of overflowing the page.
function rehypeTableWrap() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || !parent) return;
      const caption = node.children.find((c) => c.tagName === "caption");
      let label = caption ? textOf(caption).trim() : "";
      if (!label) {
        const headers = [];
        visit(node, "element", (c) => {
          if (c.tagName === "th") headers.push(textOf(c).trim());
        });
        label = headers.length ? `Table: ${headers.slice(0, 3).join(", ")}` : "Table";
      }
      parent.children.splice(index, 1, {
        type: "element",
        tagName: "div",
        properties: {
          className: ["table-scroll"],
          role: "region",
          tabIndex: 0,
          ariaLabel: label,
        },
        children: [node],
      });
      return SKIP;
    });
  };
}

// A "#" permalink on h2/h3, revealed on hover/focus; clicking copies the
// section URL (script in BaseLayout.astro).
function rehypePermalink() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const id = node.properties?.id;
      if (!id || id === "footnote-label") return;
      node.children.push({
        type: "element",
        tagName: "a",
        properties: {
          href: `#${id}`,
          className: ["permalink"],
          "aria-label": "Copy link to this section",
          "data-permalink": "",
          "data-pagefind-ignore": "",
        },
        children: [{ type: "text", value: "#" }],
      });
    });
  };
}

// Wraps Shiki's <pre> in figure.code with a header: language label + Copy
// button (script in BaseLayout.astro). Drops the newline text nodes between
// .line spans so lines can be display:block (line numbers via CSS counters,
// full-width highlighted lines).
const LANG_LABELS = { plaintext: "Text", text: "Text", txt: "Text", sh: "Shell", bash: "Shell", zsh: "Shell", ts: "TypeScript", tsx: "TSX", js: "JavaScript", jsx: "JSX", md: "Markdown", yml: "YAML" };

function rehypeCodeFigure() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || !parent) return;
      // Shiki's hast uses raw attribute keys ("class", "data-language")
      // rather than hast's camelCase properties; accept either.
      const props = node.properties ?? {};
      const cls = props.className ?? props.class ?? [];
      const classes = Array.isArray(cls) ? cls : String(cls).split(/\s+/);
      if (!classes.includes("astro-code")) return;
      const lang = String(props.dataLanguage ?? props["data-language"] ?? "plaintext");
      const label = LANG_LABELS[lang] ?? lang.toUpperCase();

      const code = node.children.find((c) => c.tagName === "code");
      if (code) {
        code.children = code.children.filter((c) => !(c.type === "text" && c.value === "\n"));
      }

      parent.children.splice(index, 1, {
        type: "element",
        tagName: "figure",
        properties: { className: ["code"] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["code-h"] },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["code-lang"] },
                children: [{ type: "text", value: label }],
              },
              {
                type: "element",
                tagName: "button",
                properties: {
                  type: "button",
                  className: ["copy"],
                  "aria-label": `Copy ${label === "Text" ? "code" : label} to clipboard`,
                  "data-copy-code": "",
                },
                children: [
                  { type: "raw", value: iconSvg("copy") },
                  { type: "element", tagName: "span", properties: {}, children: [{ type: "text", value: "Copy" }] },
                ],
              },
            ],
          },
          node,
        ],
      });
      return SKIP;
    });
  };
}

// A paragraph holding only a bare YouTube URL becomes a click-to-load
// facade: a real link to the video (works without JS) that a script in
// BaseLayout.astro swaps for a youtube-nocookie iframe on click. Nothing
// is fetched from YouTube until the reader presses play.
function youTubeId(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] || null;
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/);
  return m ? m[1] : null;
}

function rehypeYouTube() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "p" || !parent) return;
      const kids = node.children.filter((c) => !(c.type === "text" && !c.value.trim()));
      if (kids.length !== 1) return;
      const only = kids[0];
      let href;
      if (only.type === "element" && only.tagName === "a" && textOf(only).trim() === only.properties?.href) {
        href = only.properties.href;
      } else if (only.type === "text" && /^https?:\/\/\S+$/.test(only.value.trim())) {
        href = only.value.trim();
      }
      if (!href) return;
      const id = youTubeId(href);
      if (!id || !/^[\w-]{6,}$/.test(id)) return;
      const start = (() => {
        try {
          const t = new URL(href).searchParams.get("t");
          return t ? parseInt(t, 10) || 0 : 0;
        } catch {
          return 0;
        }
      })();
      const watch = `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`;

      parent.children.splice(index, 1, {
        type: "element",
        tagName: "figure",
        properties: { className: ["video"] },
        children: [
          {
            type: "element",
            tagName: "a",
            properties: {
              className: ["yt"],
              href: watch,
              "aria-label": "Play video: YouTube video",
              "data-yt": id,
              "data-yt-start": start ? String(start) : undefined,
            },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["yt-play"], "aria-hidden": "true" },
                children: [{ type: "raw", value: iconSvg("play") }],
              },
              {
                type: "element",
                tagName: "span",
                properties: { className: ["yt-note"], "aria-hidden": "true" },
                children: [{ type: "text", value: "Loads from YouTube only after you press play" }],
              },
            ],
          },
          {
            type: "element",
            tagName: "figcaption",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "span",
                properties: {},
                children: [
                  { type: "element", tagName: "b", properties: {}, children: [{ type: "text", value: "Video." }] },
                  { type: "text", value: " On YouTube." },
                ],
              },
              {
                type: "element",
                tagName: "a",
                properties: { href: watch },
                children: [{ type: "text", value: "Open on YouTube" }],
              },
            ],
          },
        ],
      });
      return SKIP;
    });
  };
}

// Resolves [[path|Label]] / [[path]] wikilinks against link-manifest.json
// (written by scripts/ingest-docs.mjs, covering every vault file —
// published or not). A target under an excluded/private vault folder
// renders as a plain "REDACTED" span with no label or title leaked; a
// target that doesn't exist at all renders as plain, unstyled text. The
// build-time unresolved/redacted report (§2.6) is produced by ingest-docs.mjs
// itself, not here — Astro's content-layer cache can skip re-transforming
// unchanged markdown between builds, which would make a report driven by
// this plugin alone undercount on a warm cache; ingest always re-walks
// every file, so it stays accurate.
const WIKILINK_TEST = /\[\[/;
const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function joinVaultPath(dir, target) {
  const parts = (dir ? `${dir}/${target}` : target).split("/");
  const stack = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function resolveWikilink(target, curDir) {
  const candidates = curDir
    ? [joinVaultPath(curDir, target), joinVaultPath("", target)]
    : [joinVaultPath("", target)];
  for (const key of candidates) {
    if (key in linkManifest) return linkManifest[key];
    const lower = key.toLowerCase();
    const foundKey = Object.keys(linkManifest).find((k) => k.toLowerCase() === lower);
    if (foundKey) return linkManifest[foundKey];
  }
  return null;
}

function rehypeWikilink() {
  return (tree, file) => {
    const frontmatter = file.data?.astro?.frontmatter ?? {};
    const sourcePath = frontmatter.sourcePath ?? file.history?.[0] ?? "";
    const curDir = sourcePath.startsWith(VAULT_PREFIX)
      ? sourcePath.slice(VAULT_PREFIX.length).replace(/\.md$/, "").split("/").slice(0, -1).join("/")
      : "";

    visit(tree, "element", (node) => {
      if (node.tagName === "pre" || node.tagName === "code") return SKIP;
      if (!node.children) return;

      let changed = false;
      const newChildren = [];
      for (const child of node.children) {
        if (child.type !== "text" || !WIKILINK_TEST.test(child.value)) {
          newChildren.push(child);
          continue;
        }
        changed = true;
        const re = new RegExp(WIKILINK_PATTERN);
        let lastIndex = 0;
        let match;
        while ((match = re.exec(child.value))) {
          if (match.index > lastIndex) {
            newChildren.push({ type: "text", value: child.value.slice(lastIndex, match.index) });
          }
          // Tables escape the wikilink's `|` as `\|`; strip the stray
          // trailing backslash that leaves on the target.
          const target = match[1].trim().replace(/\\$/, "");
          const label = match[2]?.trim();
          const resolved = resolveWikilink(target, curDir);
          if (resolved?.redacted) {
            newChildren.push({
              type: "element",
              tagName: "span",
              properties: { className: ["wikilink-redacted"] },
              children: [{ type: "text", value: "REDACTED" }],
            });
          } else if (resolved?.url) {
            newChildren.push({
              type: "element",
              tagName: "a",
              properties: { href: resolved.url },
              children: [{ type: "text", value: label ?? resolved.title }],
            });
          } else {
            newChildren.push({ type: "text", value: match[0] });
          }
          lastIndex = re.lastIndex;
        }
        if (lastIndex < child.value.length) {
          newChildren.push({ type: "text", value: child.value.slice(lastIndex) });
        }
      }
      if (changed) node.children = newChildren;
    });
  };
}

export default defineConfig({
  site: "https://arkive.blog",
  integrations: [mdx()],
  markdown: {
    // Astro's default smartypants pass turns "--" into an en-dash before
    // any rehype plugin runs, silently corrupting wikilink targets like
    // [[module-resolution--bundler]] (a real filename in this vault). The
    // wikilink graph matters more here than typographic dashes/quotes.
    smartypants: false,
    rehypePlugins: [
      rehypeWikilink,
      rehypeSlug,
      rehypeTLDR,
      rehypeCallout,
      rehypeTableWrap,
      rehypePermalink,
      rehypeOrnament,
      rehypeCodeFigure,
      rehypeYouTube,
    ],
    shikiConfig: {
      themes: {
        light: arkiveLight,
        dark: arkiveDark,
      },
      defaultColor: false,
      // `// [!code highlight]` marks a line (.line.highlighted).
      transformers: [transformerNotationHighlight()],
    },
  },
});
