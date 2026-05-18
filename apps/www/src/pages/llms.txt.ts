import type { APIRoute } from "astro";
import { getAllPosts, postUrl } from "../lib/entries";
import { loadContentMeta } from "../lib/site";

export const GET: APIRoute = async ({ site }) => {
  const meta = loadContentMeta();
  const base = site?.toString().replace(/\/$/, "") ?? meta.site.url ?? "https://arkive.blog";
  const posts = await getAllPosts();

  const lines = [
    `# ${meta.site.title ?? "ARKIVE"}`,
    "",
    meta.site.description ?? "",
    "",
    "## Entries",
    "",
    ...posts.map(
      (p) =>
        `- [${p.data.title}](${base}${postUrl(p)}): ${p.data.deck}`,
    ),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
