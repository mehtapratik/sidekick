// The folder tree for the Index (SPEC 5.3). A port of the handover's tree.py: match its output.
import type { Entry } from './entries';
import { SECTIONS } from './vault.mjs';

/** An entry as listed in the Index tree */
export interface Leaf {
   entry: Entry;
   /** The entry's own path is also a folder (`x.md` beside `x/`): it is listed first inside it. */
   own: boolean;
   /** Set when the entry came up out of a one-page sub-folder: it takes that folder's place in the order. */
   key?: string;
}
/** A folder in the Index tree, with its sub-folders and entries */
export interface Folder {
   path: string;
   label: string;
   /** The folder's real name on disk (`03-synergy`), which sets its order among siblings. */
   key?: string;
   children: Folder[];
   entries: Leaf[];
}

const WORDS: Record<string, string> = {
   ai: 'AI',
   api: 'API',
   cli: 'CLI',
   pwa: 'PWA',
   rag: 'RAG',
   css: 'CSS',
   ux: 'UX',
   nextjs: 'Next.js',
   typescript: 'TypeScript',
   eslint: 'ESLint',
};

function human(slug: string): string {
   if (slug === 'non-functional') return 'Non-functional';
   if (slug.startsWith('phase-')) {
      const parts = slug.split('-');
      return parts.length > 2
         ? `Phase ${parts[1]}: ${human(parts.slice(2).join('-'))}`
         : `Phase ${parts[1]}`;
   }
   const words = slug.split('-').map((w) => WORDS[w] ?? w);
   if (words[0] === words[0].toLowerCase())
      words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
   return words.join(' ');
}

const TOP: [string, string][] = [
   ['writings', 'Writings'],
   ...SECTIONS.map((s): [string, string] => [`docs/${s.slug}`, s.label]),
];

const byName = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Path segments under the section folder, as named on disk (`04-phases/03-synergy/00-plan.md` -> `03-synergy/00-plan`). */
function diskSegments(e: Entry): string[] | undefined {
   if (e.collection !== 'docs') return undefined;
   const rel = e.source.filePath?.replace(
      /^\.\.\/\.\.\/content\/docs\/[^/]+\//,
      '',
   );
   return rel?.replace(/\.md$/, '').split('/');
}

/** `entries` must already be in the global order (newest first). Within a folder, pages and sub-folders follow their file names, so a numeric prefix (`00-plan`) sets the order; writings stay newest first. */
export function buildTree(entries: Entry[]): Folder[] {
   const order = new Map(entries.map((e, i) => [e, i]));
   const pathOf = (e: Entry) => e.url.slice(1, -1);
   const ids = entries.map(pathOf);
   const folders = new Map<string, Folder>();
   const folder = (path: string, label?: string, key?: string) => {
      if (!folders.has(path)) {
         folders.set(path, {
            path,
            label: label ?? human(path.split('/').pop()!),
            key,
            children: [],
            entries: [],
         });
      }
      return folders.get(path)!;
   };
   const roots = TOP.map(([p, l]) => folder(p, l));

   for (const entry of entries) {
      const id = pathOf(entry);
      const top = TOP.find(([p]) => id === p || id.startsWith(p + '/'))?.[0];
      if (!top) continue;
      const rest = id.slice(top.length + 1).split('/');
      const own = ids.some((j) => j.startsWith(id + '/'));
      const parts = own ? rest : rest.slice(0, -1);
      let cur = folders.get(top)!;
      let path = top;
      const disk = diskSegments(entry);
      for (const [i, seg] of parts.filter(Boolean).entries()) {
         path += '/' + seg;
         const f = folder(path, undefined, disk?.[i]);
         if (!cur.children.includes(f)) cur.children.push(f);
         cur = f;
      }
      cur.entries.push({ entry, own });
   }

   const nameOf = (l: Leaf) => l.key ?? diskSegments(l.entry)?.at(-1);
   const byOrder = (a: Leaf, b: Leaf) =>
      Number(!a.own) - Number(!b.own) ||
      (nameOf(a) && nameOf(b) ? byName.compare(nameOf(a)!, nameOf(b)!) : 0) ||
      order.get(a.entry)! - order.get(b.entry)!;

   function finish(f: Folder) {
      f.children.forEach(finish);
      f.children.sort((a, b) =>
         a.key && b.key
            ? byName.compare(a.key, b.key)
            : a.label.toLowerCase().localeCompare(b.label.toLowerCase()),
      );
      f.entries.sort(byOrder);
      // A sub-folder holding exactly one entry and nothing else is removed; its entry moves up.
      const keep: Folder[] = [];
      for (const c of f.children) {
         if (!c.children.length && c.entries.length === 1)
            f.entries.push({ ...c.entries[0], key: c.key });
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

/** How many entries a folder holds, sub-folders included */
export function countLeaves(f: Folder): number {
   return f.entries.length + f.children.reduce((n, c) => n + countLeaves(c), 0);
}

/** Whether the folder, or any sub-folder, lists the entry with this URL */
export function containsUrl(f: Folder, url: string | undefined): boolean {
   if (!url) return false;
   return (
      f.entries.some((l) => l.entry.url === url) ||
      f.children.some((c) => containsUrl(c, url))
   );
}

/** One line of a folder's listing: a sub-folder or an entry */
export type Row = { folder: Folder } | { leaf: Leaf };

/** What a folder lists, in order: its own pages first, then sub-folders and one-page sub-folders by file name. */
export function folderRows(f: Folder): Row[] {
   const pages = f.entries.filter((l) => !l.key);
   const rest: [string | undefined, Row][] = [
      ...f.children.map((c): [string | undefined, Row] => [
         c.key,
         { folder: c },
      ]),
      ...f.entries
         .filter((l) => l.key)
         .map((l): [string | undefined, Row] => [l.key, { leaf: l }]),
   ];
   rest.sort(([a], [b]) => (a && b ? byName.compare(a, b) : 0));
   return [...pages.map((leaf): Row => ({ leaf })), ...rest.map(([, r]) => r)];
}
