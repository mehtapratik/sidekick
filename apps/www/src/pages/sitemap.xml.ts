import type { APIContext } from "astro";
import { getEntries } from "../lib/entries";

export async function GET(context: APIContext) {
   const entries = await getEntries();
   const urls = ["/", ...entries.map((e) => e.url)];
   const body =
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
         .map((u) => `<url><loc>${new URL(u, context.site)}</loc></url>`)
         .join("\n") +
      `\n</urlset>\n`;
   return new Response(body, {
      headers: { "Content-Type": "application/xml" },
   });
}
