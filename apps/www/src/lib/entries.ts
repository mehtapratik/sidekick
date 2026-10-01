import { getCollection, type CollectionEntry } from "astro:content";
import { deriveTitle } from "./vault.mjs";

export interface Entry {
   collection: "writings" | "docs";
   /** Permanent URL, with leading and trailing slash. */
   url: string;
   title: string;
   deck: string;
   /** Deck, else the first paragraph. For RSS. */
   summary: string;
   /** YYYY-MM-DD: `updated` ?? `created`, from frontmatter only. */
   asOf: string;
   created: string;
   version: string;
   status: string;
   kind: string;
   audience: string;
   tags: string[];
   words: number;
   minutes: number;
   source: CollectionEntry<"writings" | "docs">;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Lower-cased, trimmed, no leading `#`. Near-duplicates are an authoring fix, not merged. */
export const normaliseTag = (t: string) => t.trim().replace(/^#+/, "").toLowerCase();

function firstParagraph(html: string): string {
   const m = html.match(/<p>([\s\S]*?)<\/p>/);
   return m ? textOf(m[1]).trim() : "";
}

function textOf(html: string): string {
   // Block-level tags separate words; inline tags (<strong>, <a>, token <span>s) do not.
   return html
      .replace(/<\/?(?:p|li|ul|ol|h[1-6]|tr|td|th|div|table|thead|tbody|br|figure|pre|aside|blockquote|hr)\b[^>]*>/g, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&amp;/g, "&");
}

/** The one comparator: as-of descending, then created descending, then title (case-insensitive). */
export function compare(a: Entry, b: Entry): number {
   return (
      b.asOf.localeCompare(a.asOf) ||
      b.created.localeCompare(a.created) ||
      a.title.toLowerCase().localeCompare(b.title.toLowerCase())
   );
}

function toEntry(collection: Entry["collection"], e: CollectionEntry<"writings" | "docs">): Entry {
   const d = e.data;
   const html = e.rendered?.html ?? "";
   const words = textOf(html).split(/\s+/).filter(Boolean).length;
   const deck = d.deck ?? d.description ?? "";
   return {
      collection,
      url: collection === "docs" ? `/docs/${e.id}/` : `/writings/${e.id}/`,
      title: d.title ?? deriveTitle(e.filePath ?? e.id),
      deck,
      summary: deck || firstParagraph(html),
      asOf: day(d.updated ?? d.created),
      created: day(d.created),
      version: d.version ?? "",
      status: d.status ?? "",
      kind: d.kind ?? d.type ?? (collection === "writings" ? "essay" : "doc"),
      audience: d.audience ?? "",
      tags: [...new Set(d.tags.map(normaliseTag).filter(Boolean))],
      words,
      minutes: Math.max(1, Math.round(words / 230)),
      source: e,
   };
}

let cache: Promise<Entry[]> | undefined;

/** Every published entry, both collections, in the one global order (newest first). */
export function getEntries(): Promise<Entry[]> {
   cache ??= (async () => {
      const [writings, docs] = await Promise.all([getCollection("writings"), getCollection("docs")]);
      return [
         ...writings.filter((e) => e.data.publish === true).map((e) => toEntry("writings", e)),
         ...docs.filter((e) => e.data.publish === true).map((e) => toEntry("docs", e)),
      ].sort(compare);
   })();
   return cache;
}

/** Previous = the next-older entry, next = the next-newer one. */
export function neighbours(entries: Entry[], entry: Entry) {
   const i = entries.indexOf(entry);
   return { prev: entries[i + 1], next: entries[i - 1] };
}

export const tagUrl = (tag: string) => `/tags/${encodeURIComponent(tag)}/`;

/** Alphabetical tag list with entry counts. */
export function tagCounts(entries: Entry[]): [string, number][] {
   const counts = new Map<string, number>();
   for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
   return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
