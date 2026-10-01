import { defineConfig } from "astro/config";
import { arkiveLight, arkiveDark } from "./src/shiki-themes.mjs";
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
      remarkPlugins: [remarkVault],
      rehypePlugins: [rehypeArkive],
      shikiConfig: {
         themes: { light: arkiveLight, dark: arkiveDark },
         defaultColor: false,
         transformers: [shikiArkive],
      },
   },
});
