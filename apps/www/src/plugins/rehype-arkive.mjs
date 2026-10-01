// hast tweaks (SPEC 6): wide-table wrapper and the code figure with its Copy button.
import { visit, SKIP } from "unist-util-visit";

const LABELS = {
   ts: "TypeScript",
   typescript: "TypeScript",
   tsx: "TSX",
   js: "JavaScript",
   javascript: "JavaScript",
   jsx: "JSX",
   json: "JSON",
   jsonc: "JSON",
   bash: "Shell",
   sh: "Shell",
   shell: "Shell",
   shellscript: "Shell",
   zsh: "Shell",
   sql: "SQL",
   yaml: "YAML",
   yml: "YAML",
   md: "Markdown",
   markdown: "Markdown",
   css: "CSS",
   html: "HTML",
   plaintext: "Code",
   text: "Code",
   txt: "Code",
   "": "Code",
};
const label = (lang) =>
   LABELS[lang] ?? (lang ? lang[0].toUpperCase() + lang.slice(1) : "Code");

const isLine = (n) =>
   n.type === "element" &&
   n.tagName === "span" &&
   []
      .concat(n.properties?.class ?? n.properties?.className ?? [])
      .join(" ")
      .split(" ")
      .includes("line");

/**
 * Shiki transformer: the <pre> carries only `data-language` (the page's own text colour and
 * borders come from arkive.css), and per-line wrapper spans are flattened away.
 */
export const shikiArkive = {
   name: "arkive",
   pre(node) {
      node.properties = { "data-language": this.options.lang ?? "" };
   },
   code(node) {
      node.children = node.children.flatMap((c) =>
         isLine(c) ? c.children : [c],
      );
   },
};

export function rehypeArkive() {
   return (tree) => {
      visit(tree, "element", (node, index, parent) => {
         if (!parent || index == null) return;

         if (node.tagName === "table") {
            parent.children[index] = {
               type: "element",
               tagName: "div",
               properties: { className: ["wide"] },
               children: [node],
            };
            return [SKIP, index + 1];
         }

         const lang =
            node.properties?.["data-language"] ?? node.properties?.dataLanguage;
         if (node.tagName === "pre" && lang !== undefined) {
            parent.children[index] = {
               type: "element",
               tagName: "figure",
               properties: { className: ["code"] },
               children: [
                  {
                     type: "element",
                     tagName: "div",
                     properties: { className: ["code-head"] },
                     children: [
                        {
                           type: "element",
                           tagName: "span",
                           properties: { className: ["muted"] },
                           children: [
                              { type: "text", value: label(String(lang)) },
                           ],
                        },
                        {
                           type: "element",
                           tagName: "button",
                           properties: {
                              type: "button",
                              "data-copy": "",
                              hidden: true,
                           },
                           children: [{ type: "text", value: "Copy" }],
                        },
                     ],
                  },
                  node,
               ],
            };
            return [SKIP, index + 1];
         }
      });
   };
}
