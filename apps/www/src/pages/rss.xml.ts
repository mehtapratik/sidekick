import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getAllPosts, postUrl } from "../lib/entries.ts";
import { loadContentMeta } from "../lib/site.ts";

export async function GET(context: APIContext) {
   const meta = loadContentMeta();
   const posts = await getAllPosts();

   return rss({
      title: meta.site.title ?? "ARKIVE",
      description: meta.site.intro ?? "",
      site: context.site!,
      items: posts.map((post) => ({
         title: post.data.title,
         description: post.data.deck ?? post.data.description ?? "",
         pubDate: post.data.created,
         link: postUrl(post),
      })),
   });
}
