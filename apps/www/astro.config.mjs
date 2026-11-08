import { defineConfig } from "astro/config";
import { arkiveLight, arkiveDark } from "./src/shiki-themes.mjs";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkVault } from "./src/plugins/remark-vault.mjs";
import { rehypeArkive, shikiArkive } from "./src/plugins/rehype-arkive.mjs";

export default defineConfig({
   site: "https://arkive.blog",
   output: "static",
   trailingSlash: "always",
   build: { format: "directory" },
   markdown: {
      // Off, or "--" becomes an en-dash before wikilinks resolve (module-resolution--bundler).
      smartypants: false,
      remarkPlugins: [remarkMath, remarkVault],
      // MathML, not KaTeX's HTML: the browser draws it, so no stylesheet, fonts or script are needed.
      rehypePlugins: [
         [
            rehypeKatex,
            { output: "mathml", strict: "ignore", throwOnError: false },
         ],
         rehypeArkive,
      ],
      // remark-math emits display math as a `math` code block; Shiki must leave it for KaTeX.
      syntaxHighlight: { type: "shiki", excludeLangs: ["math"] },
      shikiConfig: {
         themes: { light: arkiveLight, dark: arkiveDark },
         defaultColor: false,
         transformers: [shikiArkive],
      },
   },
});
