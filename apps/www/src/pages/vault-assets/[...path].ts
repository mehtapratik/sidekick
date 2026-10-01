import fs from "node:fs";
import path from "node:path";
import { ASSETS_DIR } from "../../lib/vault.mjs";

const TYPES: Record<string, string> = {
   ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
   ".gif": "image/gif", ".webp": "image/webp",
};

function files(dir: string, out: string[] = []): string[] {
   if (!fs.existsSync(dir)) return out;
   for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) files(p, out);
      else if (TYPES[path.extname(e.name).toLowerCase()]) out.push(p);
   }
   return out;
}

/** Images embedded with `![[name.png]]`; they live in the vault's `_assets_/` folder. */
export function getStaticPaths() {
   return files(ASSETS_DIR).map((f) => ({
      params: { path: path.relative(ASSETS_DIR, f).split(path.sep).join("/") },
      props: { file: f },
   }));
}

export function GET({ props }: { props: { file: string } }) {
   return new Response(fs.readFileSync(props.file), {
      headers: { "Content-Type": TYPES[path.extname(props.file).toLowerCase()] },
   });
}
