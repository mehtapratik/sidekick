import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getListedEntries } from "../lib/entries";
import { BLURB, SITE_TITLE } from "../lib/site";

export async function GET(context: APIContext) {
   const entries = (await getListedEntries()).slice(0, 50);
   return rss({
      title: SITE_TITLE,
      description: BLURB,
      site: context.site!,
      items: entries.map((e) => ({
         title: e.title,
         link: e.url,
         pubDate: new Date(e.asOf),
         description: e.summary,
      })),
   });
}
