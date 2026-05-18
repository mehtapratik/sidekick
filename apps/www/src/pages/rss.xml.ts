import rss from "@astrojs/rss";
import { getAllPosts, postUrl } from "../lib/entries";
import { loadContentMeta } from "../lib/site";

export async function GET(context: { site: string | undefined }) {
  const meta = loadContentMeta();
  const site = context.site ?? meta.site.url ?? "https://arkive.blog";
  const posts = await getAllPosts();

  return rss({
    title: meta.site.title ?? "ARKIVE",
    description: meta.site.description ?? "",
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.deck,
      link: postUrl(post),
    })),
  });
}
