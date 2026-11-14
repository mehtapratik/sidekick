# Public site (apps/www): package notes

The design handover (SPEC, house rules, reference pages) was removed from the tree; it lives in git
history (`git show 28ec684:apps/www/design/SPEC.md`, likewise `apps/www/design/AGENTS.md`, `apps/www/design/reference/`). This file
keeps the rules that still bind and what is not obvious from the code.

## House rules

- **This site is temporary** (D256, Pratik, 2026-11-06): it is rewritten or retired once the MVP ships, so
  favour speed over long-term structure. No CSS modules, no i18n catalogs, no App-grade strictness. What
  still binds: the privacy and datum gates, `publish: true`, no URL changes, Prettier and green CI.
- No CSS framework, no UI framework, no third-party requests. Fonts and icons are self-hosted.
- Native behaviour first: popover, `details`, radios and links do the work; styling never changes
  semantics or accessibility.
- No media queries for layout. Allowed only for `prefers-color-scheme`, `prefers-reduced-motion`,
  `hover`, and hiding shortcut hints below 30em.
- No client JS beyond `public/arkive.js`. Everything works without it except search, the filter, copy,
  the keyboard shortcuts, the scroll-aware header
  and tap navigation.
- Peacock (`--accent`) colours links inside `.prose` only. No hero images or illustrations in the chrome.
- "As of" = `updated` ?? `created`, from frontmatter only. Never file or build time.
- Ship `public/arkive.css`, `arkive.js`, `src/shiki-themes.mjs`, `public/fonts/` and `public/icons/` as
  given; change them only to fix a defect, and say why in the commit message.
- When a rule seems to block you, or the code is silent, stop and ask the owner.

## Commands

| Task                    | Command                                           |
| ----------------------- | ------------------------------------------------- |
| Dev server              | `pnpm --filter @sidekick/www dev`                 |
| Build + gates           | `pnpm turbo run build --filter=@sidekick/www`     |
| Serve the build         | `pnpm --filter @sidekick/www preview`             |
| Type-check              | `pnpm --filter @sidekick/www typecheck`           |
| Check the Worker config | `pnpm -C apps/www exec wrangler deploy --dry-run` |

Node 24 (the root `.nvmrc`). Formatted by the root Prettier config except `public/arkive.css`, `public/arkive.js`, `public/fonts/`, `public/icons/` and `src/shiki-themes.mjs`, which ship as given and are listed in the root `.prettierignore`.

## Layout

```
content/writings, content/docs   authored Markdown at the repo root (the Obsidian vault is content/docs)
public/arkive.css, arkive.js     the handover's stylesheet and script, unmodified
public/fonts/, public/icons/     self-hosted typefaces and line icons, ship as given
src/shiki-themes.mjs             the handover's two code themes, unmodified
src/lib/vault.mjs                slug rules, exclude globs, title derivation, vault scan, wikilink resolution
src/lib/entries.ts               published gate, asOf, the one comparator, neighbours, tags
src/lib/tree.ts                  folder tree for the Index (port of the handover's tree.py)
src/plugins/                     remark (wikilinks, embeds, callouts, leading H1) and rehype (tables, code figure)
src/pages/                       /, entries, /tags/<tag>/, rss, sitemap, 404, /vault-assets/, /datums/, /datums.json
src/lib/datums.mjs               datum scan, relation parsing, id checks
scripts/check-privacy.mjs        post-build gate, run by the site's build
scripts/check-datums.mjs         post-build datum gate; `--next` prints the next free id
```

## Publishing

An entry is built only when its frontmatter has `publish: true`. Nothing else lists it.
`_assets_/`, `.obsidian/` and `writings/_archive/` are never built. A retired entry (`status: deprecated` or `retired`) is built and keeps its URL, but is left out of the Index, search, tag pages, pager, home, RSS and sitemap (`getListedEntries`); links and bookmarks still open it. (`00-principles/` and
`01-motivations/` are published like any other folder, as the Principles and Motivations sections.)
The old site hid notes with a `private` tag; that tag no longer gates anything, so **do not add
`publish: true` to a note tagged `private`**. The build fails if a published note carries it.

## Datums

A datum is one claim that can be pointed at: a principle, decision, rule, requirement, concept, learning or
outcome. Plans, walkthroughs, lessons and notes stay prose and cite datums. A datum is one line in a page:

```
**D12** `rule` #api #security: The claim, in one or two sentences. derived-from [[D5]]
```

- The id is `D<n>`: global, never reused, never changed. It says nothing about kind, so a decision promoted to a
  principle keeps it. `node scripts/check-datums.mjs --next` prints the next free id.
- Kinds: principle, decision, rule, requirement, concept, learning, outcome. `#tags` are optional.
- Relations are a relation word then a wikilink: Synergy's vocabulary (`derived-from`, `supersedes`,
  `contradicts`, `cites`, ...) plus `violates` and `exception-to`. `[[D12]]` links to a datum; the page
  gets `#D12` on the bold id. Direction runs from the dependent to what it relies on.
- A markdown list item may hold a datum (`1. **D4** ...`). A datum is never written inside a code fence.
- The site's build fails on a duplicate id, an unknown kind or a relation that does not resolve, and prints every
  `violates` link. `/datums.json` is the index of datums in published pages, and `/datums/`
  lists them by id for readers. A `[[D12]]` that names no datum also fails the build.

## Where this repo departs from the handover SPEC

- **`publish`** is `z.unknown()`, not `z.literal(true)`: `publish: false` means "not published",
  never a schema error that stops every page.
- **Titles.** 200+ vault notes have no `title:`. Their title is derived from the file name
  (`deriveTitle`, with an acronym dictionary in `vault.mjs`), per the vault's own convention.
  A leading `# H1` in a vault note is dropped; one in a writing is dropped only if it repeats the title.
- **Kind** falls back to `essay` / `doc`.
- **Frontmatter defaults.** `id` is a stable dotted identifier, unique across the vault (not shown).
  `status` defaults to `active`, is kept in frontmatter and never shown. `license` defaults to
  `CC BY-NC 4.0` and shows in the footer. Reading time and word count are always computed.
- **Slugs** also fold `—`/`–` to `-` and drop `?`, `,` and quotes, so existing URLs keep working
  (the handover's `entries.sample.json` is the URL contract).
- **Privacy gate** is structural: it checks the opt-in rule, the old `private` tag and links into excluded
  paths. It no longer compares text from private folders, because there are none.
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
- No media queries for layout (see House rules); no client JS beyond `public/arkive.js`.
- Cloudflare: the site is the Worker `sidekick-www`, configured in `wrangler.jsonc` (static assets from
  `dist`, `404.html` for unknown paths, an empty `previews` block). Workers Builds runs from the repo root:
  build `pnpm turbo run build --filter=@sidekick/www`, deploy `pnpm -C apps/www exec wrangler deploy`, preview
  `pnpm -C apps/www exec wrangler preview`. There is no ingest step and nothing generated is committed.
