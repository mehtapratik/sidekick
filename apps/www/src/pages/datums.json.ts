import { scanDatums } from "../lib/datums.mjs";

/** The datum index: every datum in a published page, with its relations. The graph is drawn from this. */
export function GET() {
   const datums = scanDatums()
      .filter((d) => d.published)
      .map(({ published, n, ...d }) => ({
         ...d,
         url: `${d.url}#${d.id}`,
      }));
   return new Response(JSON.stringify({ datums }, null, 1), {
      headers: { "Content-Type": "application/json" },
   });
}
