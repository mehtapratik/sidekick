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
          properties: { viewBox: "0 0 32 12", fill: "none", stroke: "currentColor", strokeWidth: "1" },
          children: [
            { type: "element", tagName: "circle", properties: { cx: "6", cy: "6", r: "1.5", fill: "currentColor" }, children: [] },
            { type: "element", tagName: "path", properties: { d: "M16 2l4 4-4 4-4-4z" }, children: [] },
            { type: "element", tagName: "circle", properties: { cx: "26", cy: "6", r: "1.5", fill: "currentColor" }, children: [] },
          ],
        },
      ];
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
