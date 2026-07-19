import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import { CATEGORIES, type Category } from "./site";
import manifestJson from "./ingest-manifest.json";

export type Post =
   | CollectionEntry<"essays">
   | CollectionEntry<"plans">
   | CollectionEntry<"decisions">
   | CollectionEntry<"builds">
   | CollectionEntry<"notes">;

export async function getAllPosts(): Promise<Post[]> {
   const results = await Promise.all(
      CATEGORIES.map((cat) => getCollection(cat)),
   );
   results.flat().map((a) => {
      a.data.updated;
   });
   return results
      .flat()
      .filter((p) => p.data.status === "active")
      .sort((a, b) => b.data.created.getTime() - a.data.created.getTime());
}

export async function getPostsByCategory(category: Category): Promise<Post[]> {
   const posts = await getCollection(category);
   return posts
      .filter((p) => p.data.status === "active")
      .sort((a, b) => b.data.created.getTime() - a.data.created.getTime());
}

export async function getHeroPost(): Promise<Post | undefined> {
   const [category, slug] = manifestJson.hero.split("/") as [Category, string];
   const posts = await getCollection(category);
   return posts.find((p) => p.id === slug && p.data.status === "active");
}

export function postUrl(post: Post): string {
   return `/${post.data.category}/${post.id}/`;
}
