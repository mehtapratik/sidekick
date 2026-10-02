@design/AGENTS.md

# Arkive: repository notes

`design/` holds the handover (spec, house rules, reference pages). This file records where the repo
differs from it, and what is not obvious from the code.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Build + privacy gate | `npm run build` |
| Serve the build | `npm run preview` |

Node >= 22.12. Format with Prettier (`.prettierrc`, 3 spaces) **except** `public/arkive.css`,
`public/arkive.js`, `src/shiki-themes.mjs` and `design/`: those ship as given.

## Layout

```
sources/writings, sources/docs   authored Markdown (the Obsidian vault is sources/docs)
public/arkive.css, arkive.js     the handover's stylesheet and script, unmodified
src/shiki-themes.mjs             the handover's two code themes, unmodified
src/lib/vault.mjs                slug rules, exclude globs, title derivation, vault scan, wikilink resolution
src/lib/entries.ts               published gate, asOf, the one comparator, neighbours, tags
src/lib/tree.ts                  folder tree for the Index (port of design/reference/tree.py)
src/plugins/                     remark (wikilinks, embeds, callouts, leading H1) and rehype (tables, code figure)
src/pages/                       /, entries, /tags/<tag>/, rss, sitemap, 404, /vault-assets/
scripts/check-privacy.mjs        post-build gate, run by `npm run build`
```

The handover README says to put `arkive.css` and friends in `design/`. They live in `public/` and
`src/` instead; `design/reference/*.html` link to `../../public/arkive.css` (serve the repo root).

## Publishing

An entry is built only when its frontmatter has `publish: true`. Nothing else lists it.
`00-principles/`, `01-motivations/`, `_assets_/`, `.obsidian/` and `writings/_archive/` are never built.
The old site hid notes with a `private` tag; that tag no longer gates anything, so **do not add
`publish: true` to a note tagged `private`**. The build fails if a published note carries it.

## Where this repo departs from `design/SPEC.md`

- **`publish`** is `z.unknown()`, not `z.literal(true)`: `publish: false` means "not published",
  never a schema error that stops every page.
- **Titles.** 200+ vault notes have no `title:`. Their title is derived from the file name
  (`deriveTitle`, with an acronym dictionary in `vault.mjs`), per the vault's own convention.
  A leading `# H1` in a vault note is dropped; one in a writing is dropped only if it repeats the title.
- **Kind** falls back to `type:` (older writings use it), then `essay` / `doc`.
- **Slugs** also fold `—`/`–` to `-` and drop `?`, `,` and quotes, so existing URLs keep working
  (`design/reference/entries.sample.json` is the URL contract).
- **Privacy gate** compares long lines from the two private vault folders only. `_archive/` is
  superseded text that legitimately lives on in newer notes.
- **Math** (`$x$`, `$$…$$`): `remark-math` + `rehype-katex` with `output: "mathml"`, so the browser draws
  it and no KaTeX stylesheet, fonts or script ship. Inline `$…$` follows Obsidian's rule (no space just
  inside either `$`, no digit right after the closing one); anything else, such as prices like
  `$2 / $12`, is restored to plain text (`obsidianInlineMath` in `remark-vault.mjs`). Display math is
  wrapped in `.wide` so a long equation scrolls instead of widening the page. TeX drops spaces:
  write `\text{Core Drive}`, not `Core Drive`.
- **Redirects:** no redirects for the old `/docs/<section>/` landings (removed on purpose).
  `/writings/`, `/docs/`, `/index/` and `/tags/` go to `/`.

## Gotchas

- **Astro's content cache does not notice plugin changes.** After editing anything in `src/plugins/`
  or `astro.config.mjs`, run `rm -rf .astro node_modules/.astro` (stop the dev server first), or
  Markdown renders from the old plugin.
- Search, the By-folder tree filter and Copy buttons need `arkive.js`; the rest works without it.
- No media queries and no other client JS (see `design/AGENTS.md`).
- Cloudflare: build command `npm run build`, output `dist`. There is no ingest step and nothing
  generated is committed.
