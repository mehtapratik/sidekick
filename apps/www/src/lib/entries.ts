import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import { SECTIONS, type Section } from "./site";
import manifestJson from "./ingest-manifest.json";

export type Post =
   | CollectionEntry<"writings">
   | CollectionEntry<"core-drive">
   | CollectionEntry<"plans">
   | CollectionEntry<"builds">;

export async function getAllPosts(): Promise<Post[]> {
   const results = await Promise.all(
      SECTIONS.map((section) => getCollection(section)),
   );
   return results
      .flat()
      .filter((p) => p.data.status === "active")
      .sort((a, b) => b.data.created.getTime() - a.data.created.getTime());
}

export async function getPostsBySection(section: Section): Promise<Post[]> {
   const posts = await getCollection(section);
   return posts
      .filter((p) => p.data.status === "active")
      .sort((a, b) => b.data.created.getTime() - a.data.created.getTime());
}

export async function getHeroPost(): Promise<Post | undefined> {
   const [section, slug] = manifestJson.hero.split("/") as [Section, string];
   const posts = await getCollection(section);
   return posts.find((p) => p.id === slug && p.data.status === "active");
}

export function postUrl(post: Post): string {
   return `/${post.data.section}/${post.id}/`;
}
