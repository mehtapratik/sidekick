# ARKIVE — Agent Guide

This file indexes the repository for AI coding agents. ARKIVE is a static Astro 7 blog deployed
at [https://arkive.blog](https://arkive.blog). It publishes two kinds of content: hand-written
essays from `sources/writings/`, and a 200-document Obsidian vault at `sources/docs/` (documentation for
a separate project, Sidekick) that lives inside this repository. Both are machine-generated into
`src/content/` on every dev/build run — never hand-edit that directory.

The site has a three-item nav (Writings, Docs, Index) over those two sources. The visual layer is
the **"Arkive" theme**: Newsreader + IBM Plex Mono, the "Folio" palette with an oxblood/pink accent,
Light / Dark / System appearance. This file is the spec for both; keep it current.

## Quick reference

| Task | Command |
|------|---------|
| Dev server (ingest + OG + astro) | `npm run dev` |
| Production build (ingest + OG + astro + pagefind + privacy gate) | `npm run build` |
| Serve built site | `npm run preview` |
| Re-ingest content only | `npm run ingest` |
| Regenerate OG images only | `npm run generate-og` |

**Requirements:** Node >= 22. No test suite or linter configured. Format with Prettier
(`prettier-plugin-astro`, 3-space indent, trailing commas).

**Search caveat:** Pagefind indexes `dist/` at build time. Search does not work in `astro dev`.

---

## Repository map

```
arkive/
├── agent.md                 ← this file
├── CLAUDE.md                ← one line, `@agent.md` (Claude Code only auto-loads CLAUDE.md / AGENTS.md)
├── content-meta.yaml        ← site config, vault config, writings config, dictionaries (AUTHOR HERE)
├── astro.config.mjs         ← Astro config, markdown rehype plugins (incl. wikilinks), Shiki themes
├── package.json
├── sources/                 ← AUTHORED CONTENT (source of truth; ingest reads only from here)
│   ├── docs/                ← Obsidian vault (Sidekick's `docs` symlink points here)
│   │   ├── 00-principles/       ← NEVER published (excluded + always private)
│   │   ├── 01-motivations/      ← NEVER published (excluded + always private)
│   │   ├── 02-prd/              ← → /docs/prd/**
│   │   ├── 03-system-design/    ← → /docs/system-design/**
│   │   ├── 04-plans/            ← → /docs/plans/**
│   │   ├── 05-builds/           ← → /docs/builds/**
│   │   ├── 06-decisions/        ← → /docs/decisions/**
│   │   ├── 07-glossary/         ← → /docs/glossary/**
│   │   ├── 08-ai-coding-harness/← → /docs/harness/**
│   │   └── index.md             ← → /docs/
│   └── writings/            ← hand-written essays/posts
│       └── _archive/        ← superseded notes, kept for reference, never published
├── public/                  ← static assets (icons, favicon), _redirects
│   ├── og/                  ← generated OG PNGs (gitignored; incremental, rebuilt predev/prebuild)
│   └── vault-assets/        ← GENERATED: vault images embedded by published docs (committed, like src/content)
├── scripts/
│   ├── ingest-docs.mjs      ← content pipeline: sources/{docs,writings}/ → src/content/
│   ├── generate-og.mjs      ← hero-art SVG → PNG for social cards, incremental via content hash
│   ├── check-privacy-gate.mjs ← post-build regression check for the vault's privacy gate
│   └── cf-build.sh          ← Cloudflare build: astro build + pagefind (no ingest)
└── src/
    ├── components/          ← Astro UI components (no framework)
    ├── content/             ← GENERATED collections (do not hand-edit)
    │   ├── writings/
    │   └── docs/            ← both leaf documents and folder landing pages (`isSection: true`)
    ├── content.config.ts    ← Zod schemas for `writings` and `docs` collections
    ├── layouts/
    │   └── BaseLayout.astro ← HTML shell, fonts, theme init, header/footer/search
    ├── lib/
    │   ├── entries.ts        ← data access: getAllWritings, getLeafDocs, getDocChildren, buildBreadcrumb, getLinkedFrom, …
    │   ├── site.ts            ← NAV_ITEMS, KIND_LABELS, STATUS_LABELS, KIND_TO_MOTIF, loadContentMeta()
    │   ├── reading.ts         ← date formatting helpers
    │   ├── hero-art.js        ← procedural SVG art generator (vault-kind + writings motifs)
    │   ├── icons.js           ← the design's icon set (Icon.astro + rehype callout/code plugins)
    │   ├── hero-art.d.ts
    │   ├── ingest-manifest.json  ← GENERATED: hero slug, build stats, lastContentChange
    │   ├── link-manifest.json    ← GENERATED: every vault path → {url,title} or {redacted:true}
    │   ├── doc-tree.json          ← GENERATED: nested doc tree for the sidebar component
    │   └── shiki-themes/     ← custom light/dark syntax themes
    ├── pages/
    │   ├── index.astro       ← homepage (typographic hero + Start-here card + latest writing + vault section cards)
    │   ├── 404.astro
    │   ├── rss.xml.ts        ← RSS feed — writings only
    │   ├── index/index.astro ← chronological index across writings + docs
    │   ├── writings/
    │   │   ├── index.astro
    │   │   └── [slug].astro
    │   ├── docs/
    │   │   ├── index.astro      ← vault landing: status legend + per-section previews
    │   │   └── [...path].astro  ← catch-all: section landings AND leaf documents
    │   └── tags/
    │       ├── index.astro      ← every tag
    │       └── [tag].astro      ← everything carrying a tag (writings + docs), month-grouped
    └── styles/
        ├── tokens.css        ← Arkive tokens (colour, type, layout); light default, dark + system overrides
        └── global.css        ← all component/prose styling, written against tokens.css
```

---

## Content pipeline

### Two independent sources, one pipeline

```
sources/writings/*.md  ──┐
  (skip _archive/)       │
                          ├── ingest-docs.mjs ──► src/content/writings/*.md
sources/docs/**/*.md   ──┤                        src/content/docs/**/*.md
  (two publish gates)    │                        src/lib/{ingest-manifest,link-manifest,doc-tree}.json
                          │                        public/og/*.png (via generate-og, incremental)
                          ▼
                   console: wikilink report
                   (N unresolved, N redacted)
```

Run `npm run ingest` (or `dev`/`build`, which run it automatically via `predev`/`prebuild`).

### Vault → site mapping

Defined in `content-meta.yaml` → `vault.sections`. Each configured top-level vault folder maps to
a URL slug and label; folders not listed (`00-principles`, `01-motivations`) never publish.

| Vault folder | Site route | Label |
|---|---|---|
| `02-prd/` | `/docs/prd/**` | Product requirements |
| `03-system-design/` | `/docs/system-design/**` | System design |
| `04-plans/` | `/docs/plans/**` | Plans |
| `05-builds/` | `/docs/builds/**` | Builds |
| `06-decisions/` | `/docs/decisions/**` | Decisions |
| `07-glossary/` | `/docs/glossary/**` | Glossary |
| `08-ai-coding-harness/` | `/docs/harness/**` | AI coding harness |
| `index.md` | `/docs/` | — |

Folder structure is preserved in the URL (unlike the old flattened-slug pipeline). Each path
segment is lowercased with its ordering prefix stripped (`02-features` → `features`); an
`index.md` becomes its **parent folder's** landing page (`isSection: true` in frontmatter) rather
than its own nested route.

`sources/writings/*.md` keeps the old flat-slug behavior (`00-margins.md` → `/writings/00-margins/`,
prefix intentionally preserved) since these are hand-authored, not vault-derived.

### The two publish gates (vault only)

A vault file publishes only if it passes **both**:

1. **Path gate** — its path doesn't match `content-meta.yaml` → `vault.exclude` (glob patterns;
   `00-principles/**`, `01-motivations/**`, `_assets_/**`, `.obsidian/**`, `**/*.canvas`).
2. **Tag gate** — its frontmatter `tags` array doesn't include `private`. This is independent of
   path — a handful of files outside the two excluded folders (e.g. under
   `08-ai-coding-harness/model-selection/`) are tagged `private` and excluded this way too.

Both gates are checked with real YAML parsing (`attrs.tags.includes("private")`), not string
matching — don't "fix" a privacy-gate false negative by grepping harder; fix the frontmatter or
the exclude list.

### Wikilinks and redaction

`sources/docs/**/*.md` is densely interlinked with `[[path|Label]]` / `[[path]]`. A rehype plugin
(`rehypeWikilink` in `astro.config.mjs`, registered before `rehype-slug`) resolves these against
`src/lib/link-manifest.json` (built by ingest, covering **every** vault file — published or not):

- **Resolves and publishes** → target's page's own title/URL is used (or the link's own label,
  if given), rendered as `<a href>`.
- **Exists in the vault but is excluded/private** → renders as a `REDACTED` span
  (`.wikilink-redacted`) with **no title or label leaked** — this is the one path a private
  document's title could otherwise reach the built site, so treat any change here carefully.
- **Doesn't exist at all** (typo, moved file) → renders as plain, unstyled text.

Resolution order: current file's directory, then vault root, then a unique-basename fallback
(only when exactly one vault file has that basename — an ambiguous bare-filename link is left
unresolved rather than guessed).

The **build-time report** (count + list of unresolved/redacted links) is printed by
`ingest-docs.mjs` itself, not by the rehype plugin — Astro's content-layer cache can skip
re-transforming unchanged markdown between builds, which would make a plugin-driven report
undercount on a warm cache. Ingest always re-walks every file, so its count is authoritative.

`astro.config.mjs` disables `smartypants` — Astro's default typographic pass turns `--` into an
en-dash before any rehype plugin runs, which silently breaks a real filename in this vault
(`module-resolution--bundler`). Don't re-enable it without re-checking wikilink resolution.

### Image embeds

Obsidian image embeds (`![[diagram.svg|700]]`, `![[photo.png|Alt text]]`) in published docs are
rewritten by ingest into `<figure class="fig">` with explicit width/height (read from the file; a
numeric option is the display width, any other option is alt text + caption). Assets are resolved
like wikilinks (current folder, vault root, unique basename). **Privacy:** an image is copied to
`public/vault-assets/` only when a *published* doc embeds it and its own path passes every
`vault.exclude` pattern except `_assets_/**` — an image inside `00-principles/` is never copied,
even if a public doc embeds it. Ingest prints `[embeds] N published, N unresolved or private`.

### Status vocabulary

Vault statuses map through `content-meta.yaml` → `vault.statusMap` to the site's six-value
vocabulary (`draft`, `approved`, `building`, `built`, `rejected`, `cancelled`). `deferred` maps to
`draft` (a deliberate simplification — see git history / PR description for the decision).

### Title derivation

When a vault file's frontmatter has no `title`, `ingest-docs.mjs`'s `deriveTitle()` derives one
from the filename: strip `.md`, strip a leading `^\d+[-_]` ordering prefix, strip a leading `_`,
collapse `-`/`_`/`—` runs to spaces, sentence-case, rejoin digit groups (`task 1 1` → `task 1.1`),
then apply `content-meta.yaml` → `vault.titleDictionary` (acronyms/proper nouns) case-insensitively
per whole word. Add to the dictionary rather than special-casing a title in code. A handful of
malformed filenames (`task-1-12and1-13.md`) or hyphen-sensitive titles (`row-level-security.md`)
are meant to be fixed via frontmatter `title:` in the source file, not a third heuristic.

### Publishing a writing

1. Add markdown to `sources/writings/`.
2. Set `status: active` in its frontmatter (or add a `content-meta.yaml` → `entries.<slug>` override).
3. Run `npm run ingest` (or `dev`/`build`).

---

## Site architecture

### Navigation

Three top-level destinations (`src/lib/site.ts` → `NAV_ITEMS`): **Writings**, **Docs**, **Index**.
The vault's seven sections live one level down, inside the document tree sidebar on `/docs/**`
pages — they are not top-nav items.

### Routing

| Route | Page |
|---|---|
| `/` | Home — featured writing, recent (writings + docs mixed), vault stat readout |
| `/writings/` | Writings index |
| `/writings/<slug>/` | Essay or post |
| `/docs/` | Vault root landing, from `sources/docs/index.md` |
| `/docs/<section>/` | Section landing (a folder's `index.md`) |
| `/docs/<...path>/` | Any nested folder landing or leaf document, folder depth preserved |
| `/index/` | Chronological index across writings and docs, grouped by month |
| `/tags/`, `/tags/<tag>/` | Tag index; everything carrying a tag (writings + published docs) |
| `/rss.xml` | Feed — **writings only** (200 docs would make it unreadable) |
| `/404` | Not found |

`src/pages/docs/[...path].astro` is a single catch-all handling both folder landings
(`data.isSection`) and leaf documents — branch on that field rather than adding new routes.

Retired URLs redirect via `public/_redirects` (Cloudflare Pages native format): the old
`/core-drive/**` (Core Drive retired to private), `/builds/` → `/docs/`, and
`/notes/architecture-overview/` → `/writings/architecture-overview/`.

### Data layer (`src/lib/entries.ts`)

- `getAllWritings()`, `getHeroPost()`, `writingUrl(post)`
- `getAllDocs()`, `getLeafDocs()` (excludes `isSection` entries), `getDocsBySection(slug)`
- `getDocChildren(id)` — a folder's generated listing. Reads `doc-tree.json`, **not** an id-prefix
  string match — a subfolder with no `index.md` of its own (e.g. `06-decisions/technical/`) is
  "transparent" in the tree (its files attach to the nearest ancestor that does have a landing
  page), and the listing must match that or it silently omits files.
- `buildBreadcrumb(id)` — walks segment-by-segment, falling back to a title-cased slug for any
  ancestor folder with no published landing page.
- `getLinkedFrom(url, linkManifest)` — reverse `applies_to` lookup for a doc's "Linked from" list.
- `getChronological()` — merged, sorted writings + leaf docs for `/index/` and the search panel.
- `getDocNeighbours(id)` — prev/next leaf docs in the same folder (reads `doc-tree.json`).
- `getFolderLeafCounts()` — leaf-document count per folder landing (reads `doc-tree.json`).
- `tagSlug()`, `tagUrl()`, `getTagIndex()` — tag pages across writings and published docs.

### Document tree (`src/lib/doc-tree.json`, `DocTree.astro` / `DocTreeNode.astro`)

Generated by `ingest-docs.mjs`'s `buildDocTree()`. Renders the reader's current section expanded,
the others collapsed to a single row with a count. Client-side filter input narrows visible
nodes without a page reload. This is the single source of truth for "what's a child of what" —
`getDocChildren()` reads it rather than recomputing nesting from doc ids.

### Content schema (`src/content.config.ts`)

- `writings`: `title, deck, created, updated, version, tags, type (essay|blog|note), seed,
  sourcePath, wordCount, readingMinutes, author, license, audience, status, description`.
- `docs`: `title, deck, created, updated, kind (spec|prd|decision|plan|guidance|glossary|opportunity),
  status (draft|approved|building|built|rejected|cancelled), version, tags, appliesTo (raw
  wikilink targets), isSection, docId (vault frontmatter `id`), sourcePath, wordCount,
  readingMinutes, author, license, description`.

### Hero art (`src/lib/hero-art.js`)

Procedural, seeded SVG (deterministic per document `id` / writing slug). One motif per vault
`kind` (Frame stack / Requirement grid / Branch / Gantt / Radar / Lattice / Scatter), one motif for
all writings (Contour), plus two reserve motifs (Margin, Drift) that exist but aren't wired to any
kind — keep them if editing this file; they're there so a future category doesn't need a new
visual language. Palette is the **Arkive accent (`#8A1F43` light / `#F08FB0` dark) on the page
ground (`#FFFFFF` / `#0B0B0B`)** — the old gold is retired. On pages it appears only as a short
band at the top of essays and leaf docs (not on the home page); it is always used for OG cards.
Keep `KIND_TO_MOTIF` (`src/lib/site.ts`) and the copy in `scripts/generate-og.mjs` in sync, and
bump `PALETTE_ID` in `generate-og.mjs` whenever `HERO_ART_PALETTES` changes.

### OG images (`scripts/generate-og.mjs`)

Incremental: hashes `seed + motif + paletteId` per doc/writing, skips re-rendering when
`public/og/<name>.png` exists with an unchanged hash (tracked in `public/og/.og-manifest.json`),
and prunes PNGs for content that no longer exists. Writings render as `writings--<slug>.png`,
docs as `docs--<id-with-slashes-as-dashdash>.png`.

### Theming ("Arkive")

- **Tokens** live in `src/styles/tokens.css` (the source of truth for colour, type and layout), imported
  before `global.css`. `:root` carries the **light** values; `:root[data-theme="dark"]` and a
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) … }` block carry dark.
  A new colour token must be added to all three blocks.
- **Appearance** is Light / Dark / **System (default)**. `localStorage["arkive-theme"]` holds
  `light` or `dark`; System = key absent. The inline no-flash script in `BaseLayout.astro` sets
  `data-theme` only for an explicit choice, so System follows the OS live. The control is
  `Appearance.astro`: one header button that flips light ↔ dark. A flip that lands on the OS
  scheme *removes* the key (back to System) instead of storing it, so System is always one click
  away without a third option.
  Anything theme-dependent in CSS (Shiki colours, hero-art light/dark copies) must handle all
  three states — explicit attribute *and* the no-attribute media query.
- **Fonts:** only Newsreader (variable, optical-size axis, roman + italic) for display and body,
  and IBM Plex Mono (400/500/600, 400 italic) for UI labels, meta and code — self-hosted via
  fontsource, the two most-used files preloaded. No Google Fonts request.
- **Accessibility baseline:** WCAG 2.2 AA contrast for every text token (re-check the
  ratio when changing a colour), `:focus-visible` ring on everything, `cursor: pointer` on interactive elements,
  ≥ 44 px touch targets on mobile, no text below 12 px, reduced-motion removes transitions and
  smooth scrolling. Status is always shape + text (`StatusIndicator.astro`), never colour alone.
- **Breakpoints:** 720 px (type scale, gutters — from the tokens), plus layout-specific ones:
  header goes icon-only below 1100 px and two-row below 900 px; the docs tree and article TOC
  collapse below 1080 px.

### Search

Pagefind indexes only elements marked `data-pagefind-body` (the `Article.astro` article and docs
section landings) and reads `data-pagefind-meta="kind:…, meta:…"` for the result rows (keep those
values comma-free). `SearchDialog.astro` is a native `<dialog>` using the Pagefind JS API, loaded
through a `Function`-built `import()` so Vite doesn't rewrite it.

### Prose (rehype plugins in `astro.config.mjs`)

TL;DR card, callouts (`div.callout.callout--<type>` with icon label + `.callout__body`), tables
(`div.table-scroll` as a focusable `role=region`), `#` permalinks on h2/h3, `§` ornament for `hr`,
code blocks (`figure.code` header with language + Copy; line numbers by CSS counter;
`// [!code highlight]` via `@shikijs/transformers`), and YouTube facades (a paragraph holding only
a bare YouTube URL; nothing loads from YouTube until play). Copy/permalink/YouTube click handling is
one delegated script in `BaseLayout.astro`.

### Privacy-gate regression check (`scripts/check-privacy-gate.mjs`)

Runs after `astro build` (wired into `npm run build`). Checks two concrete leak vectors — a built
route ever existing under an excluded vault folder name, and an excluded title leaking as an
`<a>` tag's visible link text — rather than a blanket grep for the word "private" or a short
excluded title as a substring, both of which false-positive constantly here (the vault's
*published* content legitimately discusses "private information" as an ordinary design topic; a
motivations file titled "Learn" collides with the word "learn" everywhere). A third check fails
the build if any file under `dist/vault-assets/` isn't embedded by some built page. If you need to
extend this check, keep it structural/precise for the same reason.

### Components (`src/components/`)

| Component | Role |
|---|---|
| `SiteHeader.astro` / `SiteNav.astro` | Sticky header: boxed-§ brand mark, numbered 3-item nav, Search + theme toggle |
| `Appearance.astro` | Light ↔ dark toggle button (see Theming) |
| `Shortcuts.astro` | Keyboard shortcuts + `?` panel: `1`/`2`/`3` → `[data-shortcut]` nav links, `←`/`→` → `a[data-nav]` prev/next. One off switch (`localStorage["arkive-shortcuts"]="off"`, `src/lib/shortcuts.ts`) also gates `/` search — WCAG 2.1.4 |
| `SiteFooter.astro`, `SiteMeta.astro` | Footer, `<title>`/OG/meta tags (incl. theme-color) |
| `SearchDialog.astro` | Pagefind search as a `<dialog>` panel under the header (`/`, ↑/↓, Esc) |
| `Icon.astro` | The design's icon set (`src/lib/icons.js`), always decorative |
| `Article.astro` | Shared essay / leaf-doc template: reading-progress bar, crumbs, band, kicker, h1, deck, meta (… Words, Reading time), prose + TOC (`toc={false}` on docs — the vault tree is their only sidebar), tags, prev/next |
| `DocsShell.astro` | Docs layout: sticky tree + content; mobile "Browse the vault" disclosure |
| `HeroArt.astro` | Light/dark SVG band (cropped to fill), given a `motif` + `seed` |
| `DocTree.astro` / `DocTreeNode.astro` | Vault tree as `<details>` sections/folders + client-side filter |
| `DocList.astro` | Vault listing rows: title · status (or folder count) · chevron |
| `Breadcrumb.astro` | Docs / Section / … / Leaf, truncating |
| `KindChip.astro` | Own-kind (accent) vs. referenced-kind (muted) label |
| `StatusIndicator.astro` | 6 shapes + label (draft ring, approved half, building quarter, built filled, rejected struck, cancelled dashed) |
| `TableOfContents.astro` | "On this page": h2 + nested h3, `aria-current="location"` on the section in view |
| `PostRow.astro` | `.row`: date · kicker/title/deck/tags · arrow; title is the only (stretched) link |
| `MonthIndex.astro` | Month-grouped day · title · kind list (`/index/`, tag pages) |

---

## Configuration (`content-meta.yaml`)

```yaml
site: { title, hero (a writings slug), heroImage, url, repoUrl, intro }
defaults: { author, license, version }
vault:
   root: ./sources/docs
   exclude: [glob patterns]
   sections: { <vault-folder>: { slug, label } }
   statusMap: { <vault-status>: <site-status> }
   titleDictionary: [acronyms and proper nouns]
writings:
   root: ./sources/writings
   exclude: [glob patterns]
entries: {}   # per-slug overrides, writings only
```

---

## Agent constraints

### Do edit

- `content-meta.yaml` — publishing, vault section/status/dictionary config, hero selection
- `src/` outside `src/content/` — site code, components, styles, lib
- `scripts/` — ingest, OG, and privacy-gate scripts
- `astro.config.mjs`, `public/` (except `public/og/`)
- `sources/docs/**` and `sources/writings/**` — these ARE the source docs, both live in this repo

### Do not edit (regenerated)

- `src/content/**/*.md`
- `src/lib/ingest-manifest.json`, `src/lib/link-manifest.json`, `src/lib/doc-tree.json`
- `public/og/*.png`, `public/og/.og-manifest.json`, `public/vault-assets/**`

### Common mistakes to avoid

1. **Editing generated content** — anything in `src/content/` is wiped on next `npm run ingest`.
2. **Recomputing doc nesting from ids instead of reading `doc-tree.json`** — a subfolder without
   its own `index.md` is transparent in the tree; string-prefix matching on doc ids will silently
   drop files that live one level deeper than expected.
3. **Grepping for "private" as a leak check** — too many false positives in this vault's actual
   published content; use the structural checks in `check-privacy-gate.mjs` instead.
4. **Assuming Astro's markdown defaults are safe** — `smartypants` is explicitly disabled; don't
   re-enable it without re-verifying wikilinks containing `--`.
5. **Drifting `KIND_TO_MOTIF`** — keep `src/lib/site.ts` and `scripts/generate-og.mjs` in sync.
6. **Expecting search in dev** — run `npm run build && npm run preview` to test Pagefind.
7. **Assuming dark is the default** — light is the token default; dark comes from `data-theme`
   *or* the system media query. Style both paths.

---

## Build & deploy

**Local full build:**
```bash
npm run build   # prebuild: ingest + generate-og → astro build → pagefind → privacy gate
```

**Cloudflare (`scripts/cf-build.sh`):** build command `bash scripts/cf-build.sh`, output `dist`,
Node from `.node-version` (Astro 7 needs ≥ 22.12). It does **not** run ingest: ingest reads
`updated` dates from git history, which Cloudflare's shallow clone lacks. So run `npm run build`
(or `npm run ingest`) locally and **commit the generated output** — `src/content/**`, the
`src/lib/*.json` manifests and `public/vault-assets/` — before pushing. The script then runs
generate-og (no git needed) → `astro build` → pagefind → privacy gate.

**Gitignored outputs:** `dist/`, `.astro/`, `node_modules/`, `public/og/`.

---

## Dependencies (high level)

| Package | Use |
|---------|-----|
| `astro` 7 | Static site generator |
| `@astrojs/mdx` | MDX support |
| `@astrojs/rss` | RSS feed |
| `pagefind` | Static search index |
| `rehype-slug`, `unist-util-visit` | Heading anchors, custom rehype plugins (wikilinks, callouts, TL;DR, etc.) |
| `js-yaml` | YAML parsing (ingest, site meta) |
| `@resvg/resvg-js` | SVG → PNG for OG images |
| `@fontsource-variable/newsreader`, `@fontsource/ibm-plex-mono` | Self-hosted fonts (the only two typefaces) |
| `@shikijs/transformers` | `[!code highlight]` line notation in code blocks |
