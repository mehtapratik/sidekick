import { getCollection, type CollectionEntry } from "astro:content";
import type { Category } from "./site";
import { CATEGORIES, loadContentMeta, resolveHeroRef } from "./site";

export type PostEntry = CollectionEntry<
  "essays" | "plans" | "decisions" | "builds" | "notes"
> & { category: Category };

export async function getAllPosts(): Promise<PostEntry[]> {
  const posts: PostEntry[] = [];
  for (const category of CATEGORIES) {
    const items = await getCollection(category, ({ data }) => !data.draft);
    for (const item of items) {
      posts.push({ ...item, category });
    }
  }
  return posts.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );
}

export function postUrl(post: { category: Category; id: string }) {
  return `/${post.category}/${post.id}/`;
}

export async function getHeroPost(): Promise<PostEntry | undefined> {
  const meta = loadContentMeta();
  const { category, slug } = resolveHeroRef(meta.site.hero);
  const posts = await getAllPosts();
  return posts.find((p) => p.category === category && p.id === slug);
}

export async function getRecentPost(
  excludeId?: string,
  excludeCategory?: Category,
): Promise<PostEntry | undefined> {
  const posts = await getAllPosts();
  return posts.find(
    (p) => !(p.id === excludeId && p.category === excludeCategory),
  );
}
