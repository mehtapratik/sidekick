// Two deliberately small Shiki themes for Arkive.
// Five token colours, everything else in the page's own text colour.
// Use with Astro's built-in Shiki:
//
//   // astro.config.mjs
//   import { arkiveLight, arkiveDark } from "./shiki-themes.mjs";
//   export default defineConfig({
//     markdown: {
//       shikiConfig: {
//         themes: { light: arkiveLight, dark: arkiveDark },
//         defaultColor: false,          // emit --shiki-light / --shiki-dark only; arkive.css picks one with light-dark()
//       },
//     },
//   });

const scopes = {
   comment: ["comment", "punctuation.definition.comment"],
   keyword: ["keyword", "storage", "storage.type", "storage.modifier", "constant.language", "variable.language"],
   string: ["string", "string.template", "punctuation.definition.string"],
   number: ["constant.numeric"],
   type: ["entity.name.type", "entity.name.class", "support.type", "support.class"],
};

function theme(name, type, fg, c) {
   return {
      name,
      type,
      colors: { "editor.foreground": fg, "editor.background": type === "light" ? "#ffffff" : "#121212" },
      tokenColors: [
         { scope: scopes.comment, settings: { foreground: c.comment, fontStyle: "italic" } },
         { scope: scopes.keyword, settings: { foreground: c.keyword } },
         { scope: scopes.string, settings: { foreground: c.string } },
         { scope: scopes.number, settings: { foreground: c.number } },
         { scope: scopes.type, settings: { foreground: c.type } },
      ],
   };
}

// All five colours pass 4.5:1 against the browser's light / dark Canvas.
export const arkiveLight = theme("arkive-light", "light", "#000000", {
   comment: "#6a6a6a", keyword: "#7a3e00", string: "#1d6b2f", number: "#8a1c7c", type: "#0b5a6b",
});
export const arkiveDark = theme("arkive-dark", "dark", "#ffffff", {
   comment: "#9a9a9a", keyword: "#e6b17a", string: "#8fd19e", number: "#e3a3dc", type: "#7fd3e0",
});
