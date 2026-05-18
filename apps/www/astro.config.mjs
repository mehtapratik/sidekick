// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import rehypeSlug from "rehype-slug";
import { visit } from "unist-util-visit";
import arkiveLight from "./src/lib/shiki-themes/arkive-light.json" with { type: "json" };
import arkiveDark from "./src/lib/shiki-themes/arkive-dark.json" with { type: "json" };

/**
 * Convert markdown horizontal rules (`---`, `***`, `___`) into the
 * site's ornament divider — a flexbox row with a center diamond and
 * two flanking hairlines. Authors keep using `---`; the renderer
 * upgrades it to the journal-style ornament.
 */
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
            viewBox: "0 0 32 12",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1",
          },
          children: [
            {
              type: "element",
              tagName: "circle",
              properties: { cx: "6", cy: "6", r: "1.5", fill: "currentColor" },
              children: [],
            },
            {
              type: "element",
              tagName: "path",
              properties: { d: "M16 2l4 4-4 4-4-4z" },
              children: [],
            },
            {
              type: "element",
              tagName: "circle",
              properties: { cx: "26", cy: "6", r: "1.5", fill: "currentColor" },
              children: [],
            },
          ],
        },
      ];
    });
  };
}

/**
 * Append a `§` permalink anchor to every <h2> that has an id (set
 * upstream by rehype-slug). The anchor is hidden by default and
 * revealed on hover/focus; a client script copies the URL & updates
 * the location hash without scrolling.
 */
function rehypePermalink() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2") return;
      const id = node.properties && node.properties.id;
      if (!id) return;
      const existing = node.properties.className || [];
      node.properties.className = Array.isArray(existing)
        ? [...existing, "has-permalink"]
        : [existing, "has-permalink"];
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
      rehypePermalink,
      rehypeOrnament,
    ],
    shikiConfig: {
      themes: {
        light: arkiveLight,
        dark: arkiveDark,
      },
      // `defaultColor: false` makes Shiki emit `--shiki-light` /
      // `--shiki-dark` CSS variables on every token instead of baking
      // a single theme's colors in. Our global.css then swaps which
      // variable wins based on `[data-theme]`.
      defaultColor: false,
    },
  },
});
