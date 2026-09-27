import type { CollectionEntry } from "astro:content";
import { getCollection, getEntry } from "astro:content";
import manifestJson from "./ingest-manifest.json";
import docTree from "./doc-tree.json";

type TreeNode = {
   id: string;
   title: string;
   kind: string;
   status: string;
   isSection: boolean;
   children: TreeNode[];
};

export type Writing = CollectionEntry<"writings">;
export type Doc = CollectionEntry<"docs">;

export async function getAllWritings(): Promise<Writing[]> {
   const posts = await getCollection("writings");
   return posts
      .filter((p) => p.data.status === "active")
      .sort((a, b) => b.data.created.getTime() - a.data.created.getTime());
}

export async function getHeroPost(): Promise<Writing | undefined> {
   const posts = await getCollection("writings");
   return posts.find(
      (p) => p.id === manifestJson.hero && p.data.status === "active",
   );
}

export function writingUrl(post: Writing): string {
   return `/writings/${post.id}/`;
}

export async function getAllDocs(): Promise<Doc[]> {
   return getCollection("docs");
}

export async function getLeafDocs(): Promise<Doc[]> {
   const docs = await getAllDocs();
   return docs
      .filter((d) => !d.data.isSection)
      .sort((a, b) => b.data.created.getTime() - a.data.created.getTime());
}

export async function getDocsBySection(sectionSlug: string): Promise<Doc[]> {
   const docs = await getLeafDocs();
   return docs.filter((d) => d.id === sectionSlug || d.id.startsWith(`${sectionSlug}/`));
}

function findTreeNodeChildren(id: string): TreeNode[] {
   function searchList(nodes: TreeNode[]): TreeNode[] | null {
      for (const node of nodes) {
         if (node.id === id) return node.children;
         const found = searchList(node.children);
         if (found) return found;
      }
      return null;
   }
   for (const section of docTree as { slug: string; children: TreeNode[] }[]) {
      if (section.slug === id) return section.children;
      const found = searchList(section.children);
      if (found) return found;
   }
   return [];
}

// A folder/section landing page's generated listing. Mirrors the document
// tree's own nesting exactly: a subfolder with no index.md of its own is
// "transparent" — its files already attach directly to the nearest
// ancestor that does have a landing page (built once, in ingest-docs.mjs's
// buildDocTree), so this never silently omits files that live one level
// deeper than expected (e.g. 06-decisions/technical/*.md under "decisions").
export async function getDocChildren(id: string): Promise<Doc[]> {
   const children = findTreeNodeChildren(id);
   const docs = await getAllDocs();
   const byId = new Map(docs.map((d) => [d.id, d]));
   return children
      .map((c) => byId.get(c.id))
      .filter((d): d is Doc => !!d)
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export async function getDocEntry(id: string): Promise<Doc | undefined> {
   return getEntry("docs", id);
}

export function docUrl(doc: Doc): string {
   return doc.id === "index" ? "/docs/" : `/docs/${doc.id}/`;
}

function titleCaseSlug(slug: string): string {
   const s = slug.replace(/-/g, " ");
   return s.charAt(0).toUpperCase() + s.slice(1);
}

// Builds "Docs / Section / Folder / Leaf" breadcrumb entries for a doc id.
// A segment whose folder has no published landing page (e.g. it was
// entirely private) still shows a readable label, just not as a link.
export async function buildBreadcrumb(
   id: string,
): Promise<{ label: string; href?: string }[]> {
   const docs = await getAllDocs();
   const byId = new Map(docs.map((d) => [d.id, d]));
   const segments = id.split("/");
   const crumbs: { label: string; href?: string }[] = [{ label: "Docs", href: "/docs/" }];
   let acc = "";
   for (let i = 0; i < segments.length; i++) {
      acc = acc ? `${acc}/${segments[i]}` : segments[i];
      const entry = byId.get(acc);
      const isLast = i === segments.length - 1;
      crumbs.push({
         label: entry ? entry.data.title : titleCaseSlug(segments[i]),
         href: isLast ? undefined : entry ? docUrl(entry) : undefined,
      });
   }
   return crumbs;
}

// "Linked from": other docs whose `applies_to` resolves (via link-manifest)
// to this doc's own URL.
export async function getLinkedFrom(
   targetUrl: string,
   linkManifest: Record<string, { url?: string; title?: string; redacted?: boolean }>,
): Promise<{ title: string; href: string }[]> {
   const docs = await getAllDocs();
   const linked: { title: string; href: string }[] = [];
   for (const doc of docs) {
      for (const raw of doc.data.appliesTo) {
         const resolved = linkManifest[raw] ?? linkManifest[raw.toLowerCase()];
         if (resolved?.url === targetUrl) {
            linked.push({ title: doc.data.title, href: docUrl(doc) });
            break;
         }
      }
   }
   return linked;
}

export type ChronoEntry =
   | { kind: "writing"; entry: Writing; created: Date; title: string; url: string }
   | { kind: "doc"; entry: Doc; created: Date; title: string; url: string };

export async function getChronological(): Promise<ChronoEntry[]> {
   const [writings, docs] = await Promise.all([getAllWritings(), getLeafDocs()]);
   const items: ChronoEntry[] = [
      ...writings.map((entry) => ({
         kind: "writing" as const,
         entry,
         created: entry.data.created,
         title: entry.data.title,
         url: writingUrl(entry),
      })),
      ...docs.map((entry) => ({
         kind: "doc" as const,
         entry,
         created: entry.data.created,
         title: entry.data.title,
         url: docUrl(entry),
      })),
   ];
   return items.sort((a, b) => b.created.getTime() - a.created.getTime());
}

// ---------- tags ----------
// Tags come straight from frontmatter (writings and published docs alike);
// each gets a /tags/<slug>/ page listing everything carrying it.
export function tagSlug(tag: string): string {
   return tag
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
}

export function tagUrl(tag: string): string {
   return `/tags/${tagSlug(tag)}/`;
}

export async function getTagIndex(): Promise<
   Map<string, { tag: string; items: ChronoEntry[] }>
> {
   const index = new Map<string, { tag: string; items: ChronoEntry[] }>();
   for (const item of await getChronological()) {
      for (const tag of item.entry.data.tags) {
         const slug = tagSlug(tag);
         if (!slug) continue;
         if (!index.has(slug)) index.set(slug, { tag, items: [] });
         index.get(slug)!.items.push(item);
      }
   }
   return index;
}

// Previous / next leaf documents around `id` within its own folder, in the
// same title order as the folder's landing-page listing. Reads doc-tree.json
// (not id prefixes) so "transparent" subfolders behave like the listing.
export async function getDocNeighbours(
   id: string,
): Promise<{ prev?: Doc; next?: Doc }> {
   function findSiblings(nodes: TreeNode[]): TreeNode[] | null {
      if (nodes.some((n) => n.id === id)) return nodes;
      for (const n of nodes) {
         const found = findSiblings(n.children);
         if (found) return found;
      }
      return null;
   }
   let siblings: TreeNode[] | null = null;
   for (const section of docTree as { children: TreeNode[] }[]) {
      siblings = findSiblings(section.children);
      if (siblings) break;
   }
   if (!siblings) return {};
   const docs = await getAllDocs();
   const byId = new Map(docs.map((d) => [d.id, d]));
   const leaves = siblings
      .filter((n) => !n.isSection)
      .map((n) => byId.get(n.id))
      .filter((d): d is Doc => !!d)
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
   const i = leaves.findIndex((d) => d.id === id);
   return { prev: leaves[i - 1], next: leaves[i + 1] };
}

// Leaf-document count under every folder landing in the tree, keyed by id.
export function getFolderLeafCounts(): Record<string, number> {
   const counts: Record<string, number> = {};
   function walk(n: TreeNode): number {
      const total = n.children.reduce((sum, c) => sum + (c.isSection ? walk(c) : 1), 0);
      counts[n.id] = total;
      return total;
   }
   for (const section of docTree as { children: TreeNode[] }[]) {
      section.children.forEach((c) => c.isSection && walk(c));
   }
   return counts;
}
