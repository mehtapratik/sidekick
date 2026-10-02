// The folder tree for the Index (SPEC 5.3). A port of the handover's tree.py: match its output.
import { SECTIONS } from "./vault.mjs";
import type { Entry } from "./entries";

export interface Leaf {
   entry: Entry;
   /** The entry's own path is also a folder (`x.md` beside `x/`): it is listed first inside it. */
   own: boolean;
}
export interface Folder {
   path: string;
   label: string;
   children: Folder[];
   entries: Leaf[];
}

const WORDS: Record<string, string> = {
   ai: "AI",
   api: "API",
   cli: "CLI",
   pwa: "PWA",
   rag: "RAG",
   css: "CSS",
   ux: "UX",
   nextjs: "Next.js",
   typescript: "TypeScript",
   eslint: "ESLint",
};

function human(slug: string): string {
   if (slug === "non-functional") return "Non-functional";
   if (slug.startsWith("phase-")) {
      const parts = slug.split("-");
      return parts.length > 2
         ? `Phase ${parts[1]}: ${human(parts.slice(2).join("-"))}`
         : `Phase ${parts[1]}`;
   }
   const words = slug.split("-").map((w) => WORDS[w] ?? w);
   if (words[0] === words[0].toLowerCase())
      words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
   return words.join(" ");
}

const TOP: [string, string][] = [
   ["writings", "Writings"],
   ...SECTIONS.map((s): [string, string] => [`docs/${s.slug}`, s.label]),
];

/** `entries` must already be in the global order (newest first). */
export function buildTree(entries: Entry[]): Folder[] {
   const order = new Map(entries.map((e, i) => [e, i]));
   const pathOf = (e: Entry) => e.url.slice(1, -1);
   const ids = entries.map(pathOf);
   const folders = new Map<string, Folder>();
   const folder = (path: string, label?: string) => {
      if (!folders.has(path)) {
         folders.set(path, {
            path,
            label: label ?? human(path.split("/").pop()!),
            children: [],
            entries: [],
         });
      }
      return folders.get(path)!;
   };
   const roots = TOP.map(([p, l]) => folder(p, l));

   for (const entry of entries) {
      const id = pathOf(entry);
      const top = TOP.find(([p]) => id === p || id.startsWith(p + "/"))?.[0];
      if (!top) continue;
      const rest = id.slice(top.length + 1).split("/");
      const own = ids.some((j) => j.startsWith(id + "/"));
      const parts = own ? rest : rest.slice(0, -1);
      let cur = folders.get(top)!;
      let path = top;
      for (const seg of parts.filter(Boolean)) {
         path += "/" + seg;
         const f = folder(path);
         if (!cur.children.includes(f)) cur.children.push(f);
         cur = f;
      }
      cur.entries.push({ entry, own });
   }

   const byOrder = (a: Leaf, b: Leaf) =>
      Number(!a.own) - Number(!b.own) ||
      order.get(a.entry)! - order.get(b.entry)!;

   function finish(f: Folder) {
      f.children.forEach(finish);
      f.children.sort((a, b) =>
         a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
      );
      f.entries.sort(byOrder);
      // A sub-folder holding exactly one entry and nothing else is removed; its entry moves up.
      const keep: Folder[] = [];
      for (const c of f.children) {
         if (!c.children.length && c.entries.length === 1)
            f.entries.push(c.entries[0]);
         else keep.push(c);
      }
      f.children = keep;
      f.entries.sort(byOrder);
      // A folder whose only content is one sub-folder merges with it: "Decisions / Technical".
      while (!f.entries.length && f.children.length === 1) {
         const only = f.children[0];
         f.label = `${f.label} / ${only.label}`;
         f.path = only.path;
         f.children = only.children;
         f.entries = only.entries;
      }
   }
   roots.forEach(finish);
   return roots.filter((r) => r.children.length || r.entries.length);
}

export function countLeaves(f: Folder): number {
   return f.entries.length + f.children.reduce((n, c) => n + countLeaves(c), 0);
}

export function containsUrl(f: Folder, url: string | undefined): boolean {
   if (!url) return false;
   return (
      f.entries.some((l) => l.entry.url === url) ||
      f.children.some((c) => containsUrl(c, url))
   );
}
