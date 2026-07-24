import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import rehypeSlug from "rehype-slug";
import { visit } from "unist-util-visit";
import arkiveLight from "./src/lib/shiki-themes/arkive-light.json" with { type: "json" };
import arkiveDark from "./src/lib/shiki-themes/arkive-dark.json" with { type: "json" };

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

function rehypeOrnament() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "hr") return;
      node.tagName = "div";
      node.properties = {
        className: ["ornament"],
        "aria-hidden": "true",
        role: "presentation",
      };
      node.children = [
        {
          type: "element",
          tagName: "svg",
          properties: {
            viewBox: "0 0 140 14",
            fill: "none",
            xmlns: "http://www.w3.org/2000/svg",
          },
          children: [
            {
              type: "element",
              tagName: "path",
              properties: {
                d: "M2 7c6-5 12 5 18 0s12-5 18 0 12 5 18 0 12-5 18 0 12 5 18 0 10-4 16-1",
                stroke: "currentColor",
                strokeWidth: "1.4",
                strokeLinecap: "round",
                strokeLinejoin: "round",
              },
              children: [],
            },
          ],
        },
      ];
    });
  };
}

// Turns GitHub/Obsidian-style admonition blockquotes into styled callouts:
//   > [!info]
//   > Body text.
// Unmarked blockquotes are left alone and keep the pull-quote treatment.
const CALLOUT_TYPES = {
  info: { className: "info", label: "Info" },
  note: { className: "info", label: "Info" },
  caution: { className: "caution", label: "Caution" },
  warning: { className: "caution", label: "Caution" },
  danger: { className: "danger", label: "Danger" },
  alert: { className: "danger", label: "Danger" },
  ref: { className: "reference", label: "See also" },
  reference: { className: "reference", label: "See also" },
  "see-also": { className: "reference", label: "See also" },
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
      // Drop the now-empty leading text node so the paragraph doesn't
      // start with a blank run.
      if (firstText.value === "") {
        firstP.children = firstP.children.filter((c) => c !== firstText);
      }

      node.tagName = "div";
      node.properties = {
        className: ["callout", `callout--${meta.className}`],
      };
      node.children.unshift({
        type: "element",
        tagName: "p",
        properties: { className: ["callout__label"] },
        children: [{ type: "text", value: meta.label }],
      });
    });
  };
}

// Wraps every markdown table in a scrollable container so wide tables
// don't force layout to overflow the page on small viewports.
function rehypeTableWrap() {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || !parent) return;
      parent.children.splice(index, 1, {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"] },
        children: [node],
      });
    });
  };
}

function rehypePermalink() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2") return;
      const id = node.properties?.id;
      if (!id) return;
      node.children.push({
        type: "element",
        tagName: "a",
        properties: {
          href: `#${id}`,
          className: ["permalink"],
          "aria-label": "Copy link to this section",
          "data-permalink": "",
        },
        children: [{ type: "text", value: "§" }],
      });
    });
  };
}


export default defineConfig({
  site: "https://arkive.blog",
  integrations: [mdx()],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
      rehypeTLDR,
      rehypeCallout,
      rehypeTableWrap,
      rehypePermalink,
      rehypeOrnament,
    ],
    shikiConfig: {
      themes: {
        light: arkiveLight,
        dark: arkiveDark,
      },
      defaultColor: false,
    },
  },
});
