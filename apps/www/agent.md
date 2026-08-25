# ARKIVE — Agent Guide

This file indexes the repository for AI coding agents. ARKIVE is a static Astro 7 blog deployed at [https://arkive.blog](https://arkive.blog). It publishes markdown from a **separate docs repo** (`../sidekick/docs` by default); content under `src/content/` is machine-generated on every dev/build run.

## Quick reference

| Task | Command |
|------|---------|
| Dev server (ingest + OG + astro) | `npm run dev` |
| Production build (ingest + OG + astro + pagefind) | `npm run build` |
| Serve built site | `npm run preview` |
| Re-ingest content only | `npm run ingest` |
| Regenerate OG images only | `npm run generate-og` |
| Override docs source | `DOCS_ROOT=/path/to/docs npm run ingest` |

**Requirements:** Node >= 22. No test suite or linter configured. Format with Prettier (`prettier-plugin-astro`, 3-space indent, trailing commas).

**Search caveat:** Pagefind indexes `dist/` at build time. Search does not work in `astro dev`.

---

## Repository map

```
arkive/
├── agent.md                 ← this file
├── CLAUDE.md                ← shorter Claude Code guide (may lag agent.md)
├── content-meta.yaml        ← site config, defaults, per-slug overrides (AUTHOR HERE)
├── astro.config.mjs         ← Astro config, markdown rehype plugins, Shiki themes
├── package.json
├── public/                  ← static assets (fonts, icons, logos, favicon)
│   └── og/                  ← generated OG PNGs (gitignored; rebuilt predev/prebuild)
├── scripts/
│   ├── ingest-docs.mjs      ← content pipeline: docs repo → src/content/
│   ├── generate-og.mjs      ← hero-art SVG → PNG for social cards
│   └── cf-build.sh          ← Cloudflare build: astro build + pagefind (no ingest)
└── src/
    ├── components/          ← Astro UI components (no framework)
    ├── content/             ← GENERATED markdown collections (do not hand-edit)
    │   ├── writings/
    │   ├── core-drive/
    │   ├── plans/
    │   └── builds/
    ├── content.config.ts    ← Zod schema + collection definitions
    ├── layouts/
    │   └── BaseLayout.astro ← HTML shell, fonts, theme init, header/footer/search
    ├── lib/
    │   ├── entries.ts       ← data access: getAllPosts, getHeroPost, postUrl, …
    │   ├── site.ts          ← sections, labels, TYPE_TO_MOTIF, loadContentMeta()
    │   ├── reading.ts       ← date formatting helpers
    │   ├── hero.ts          ← hero-art wrapper (light/dark SVG)
    │   ├── hero-art.js      ← procedural SVG art generator
    │   ├── hero-art.d.ts
    │   ├── ingest-manifest.json  ← GENERATED: hero slug, post count
    │   └── shiki-themes/    ← custom light/dark syntax themes
    ├── pages/
    │   ├── index.astro      ← homepage (featured hero + recent + section grid)
    │   ├── 404.astro
    │   ├── rss.xml.ts       ← RSS feed
    │   ├── index/index.astro ← chronological index of all posts (/index/)
    │   └── [section]/
    │       ├── index.astro  ← section listing (nav sections only)
    │       └── [slug].astro ← post page
    └── styles/
        └── global.css       ← all styling; light/dark via data-theme
```

---

## Content pipeline

### Source → site flow

```
../sidekick/docs/          content-meta.yaml         src/content/<section>/
  essays/        ──┐
  blogs/         ──┤                              writings/
  notes/         ──┤
  core-drive/    ──┼── ingest-docs.mjs ──────────► core-drive/
  plans/         ──┤         │                   plans/
  decisions/     ──┤         ▼                   builds/
  builds/        ──┘   ingest-manifest.json
                       public/og/*.png (via generate-og)
```

### Source folder → section/type mapping

Defined in `scripts/ingest-docs.mjs` (`FOLDER_MAP`):

| Docs folder | Site section | Post type |
|-------------|--------------|-----------|
| `essays/` | `writings` | `essay` |
| `blogs/` | `writings` | `blog` |
| `core-drive/` | `core-drive` | `core-drive` |
| `plans/` | `plans` | `plan` |
| `decisions/` | `plans` | `decision` |
| `builds/` | `builds` | `build` |
| `notes/` | `writings` | `note` |

Files outside these folders, or named `index.md`, are skipped.

### Publishing gate

Only posts with effective `status: active` are ingested. Precedence:

1. `content-meta.yaml` → `entries.<slug>.status`
2. Source frontmatter `status`
3. Default: `draft` (unpublished)

To publish or change metadata, edit the **source doc** in the docs repo or **`content-meta.yaml`** — never `src/content/*.md`.

### Ingest transforms

- Slug from filename: underscores → hyphens, lowercased. Duplicate `section/slug` is a hard error.
- Leading `# H1` stripped from body (layout renders title separately).
- Dates from git history in docs repo (`git log`), fallback to file mtime.
- Word count and reading minutes (220 wpm) computed from body.
- Author/license/version defaults from `content-meta.yaml`.

### Hero (featured) post

`content-meta.yaml` → `site.hero` is required. May be a bare slug (if unambiguous across sections) or `section/slug`. Validated at ingest; written to `src/lib/ingest-manifest.json`.

---

## Site architecture

### Sections and navigation

Four content sections (`src/lib/site.ts`):

| Section | Nav visible | URL prefix | Description |
|---------|-------------|------------|-------------|
| `writings` | yes | `/writings/` | Essays, blogs, and notes |
| `core-drive` | yes | `/core-drive/` | Core principles |
| `plans` | yes | `/plans/` | Plans and decisions |
| `builds` | yes | `/builds/` | Build-from-scratch guides |

Nav order: Writings → Core Drive → Plans → Builds. Source `notes/` files are ingested into `writings` (`type: note`).

Post URLs: `/<section>/<slug>/` (e.g. `/writings/00-margins/`).

### Data layer

`src/lib/entries.ts`:

- `getAllPosts()` — all active posts, newest first
- `getPostsBySection(section)` — active posts in one section
- `getHeroPost()` — featured post from ingest manifest
- `postUrl(post)` — canonical path string

`src/lib/site.ts`:

- `Section`, `PostType`, labels, descriptions
- `TYPE_TO_MOTIF` — maps post type to hero-art motif (keep in sync with `scripts/generate-og.mjs`)
- `loadContentMeta()` — reads `content-meta.yaml`

### Content schema

`src/content.config.ts` — shared Zod schema for all collections. Key fields: `title`, `deck`, `created`, `updated`, `section`, `type`, `status`, `wordCount`, `readingMinutes`, `seed` (hero-art seed), `sourcePath`.

### Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `src/pages/index.astro` | Featured hero, recent posts, section grid |
| `/<section>/` | `src/pages/[section]/index.astro` | Section listing (NAV_SECTIONS only) |
| `/<section>/<slug>/` | `src/pages/[section]/[slug].astro` | Post with TOC (≥3 h2s), hero art, OG image |
| `/index/` | `src/pages/index/index.astro` | Chronological index across all sections |
| `/rss.xml` | `src/pages/rss.xml.ts` | RSS feed |
| 404 | `src/pages/404.astro` | Not found |

### Markdown rendering

Rehype plugins in `astro.config.mjs` (order matters):

1. `rehype-slug` — heading IDs
2. `rehypeTLDR` — `## TL;DR` → styled `.tldr-card`
3. `rehypeCallout` — `> [!info]` blockquotes → callout divs
4. `rehypeTableWrap` — tables wrapped in `.table-scroll`
5. `rehypePermalink` — h2 gets `§` anchor (copy-to-clipboard in BaseLayout)
6. `rehypeOrnament` — `---` hr → decorative SVG

Shiki themes: `src/lib/shiki-themes/arkive-light.json`, `arkive-dark.json` (`defaultColor: false`).

Callout types: `info`, `note`, `caution`, `warning`, `danger`, `alert`, `ref`, `reference`, `see-also`, `question`.

### Search

`src/components/SearchDialog.astro` lazy-loads Pagefind from `/pagefind/` (produced by `pagefind --site dist` in `npm run build`). Opens via header button or `/` keyboard shortcut.

### Theming

Light/dark via `document.documentElement.dataset.theme`. Persisted in `localStorage` key `arkive-theme`. Toggle in `ThemeToggle.astro`; inline script in `BaseLayout.astro` prevents flash.

### Hero art & OG images

- `src/lib/hero-art.js` — seeded procedural SVG by motif (Essay, Blog, Plan, etc.)
- `HeroArt.astro` — renders light/dark SVG inline on pages
- `scripts/generate-og.mjs` — pre-renders 1200×630 PNGs to `public/og/<section>--<slug>.png`
- Post pages reference OG image at `/og/${section}--${slug}.png`

### Components

| Component | Role |
|-----------|------|
| `SiteHeader.astro` | Logo, nav, search trigger, theme toggle, mobile menu |
| `SiteNav.astro` | Desktop/mobile navigation links |
| `SiteFooter.astro` | Footer with repo link |
| `SiteMeta.astro` | `<title>`, meta, Open Graph tags |
| `SearchDialog.astro` | Pagefind overlay |
| `ThemeToggle.astro` | Light/dark switch |
| `HeroArt.astro` | Post hero illustration |
| `PostRow.astro` | Post list item on homepage/sections |

---

## Configuration files

### `content-meta.yaml`

```yaml
site:
  title: ARKIVE
  hero: 00-margins          # bare slug or section/slug
  heroImage: null           # optional override
  url: https://arkive.blog
  repoUrl: https://github.com/...
  intro: "..."

defaults:
  author: ...
  license: CC BY-NC 4.0
  version: 0.0.0

entries:
  my-slug:                  # optional per-slug overrides
    status: active
    title: ...
    deck: ...
```

### `src/lib/ingest-manifest.json` (generated)

```json
{
  "hero": "writings/00-margins",
  "heroImage": null,
  "count": 7,
  "docsRoot": "/path/to/docs",
  "generatedAt": "..."
}
```

---

## Agent constraints

### Do edit

- `content-meta.yaml` — publishing, metadata overrides, hero selection
- `src/` outside `src/content/` — site code, components, styles, lib
- `scripts/` — ingest and build scripts
- `astro.config.mjs`, `public/` (except `public/og/`)
- Source docs in the **docs repo** (not this repo) for post content

### Do not edit (regenerated)

- `src/content/**/*.md`
- `src/lib/ingest-manifest.json`
- `public/og/*.png`

### Common mistakes to avoid

1. **Editing generated content** — changes to `src/content/` are wiped on next `npm run ingest`.
2. **Expecting search in dev** — run `npm run build && npm run preview` to test Pagefind.
3. **Drifting TYPE_TO_MOTIF** — keep `src/lib/site.ts` and `scripts/generate-og.mjs` in sync.
4. **Splitting notes back out** — source `notes/` maps to the `writings` collection; do not reintroduce a `notes` section unless you also restore routing, ingest, and OG generation.

---

## Build & deploy

**Local full build:**
```bash
npm run build   # prebuild: ingest + generate-og → astro build → pagefind
```

**Cloudflare (`scripts/cf-build.sh`):**
Assumes content is already ingested and OG images generated in CI before this step. Runs only `astro build` + `pagefind`.

**Gitignored outputs:** `dist/`, `.astro/`, `node_modules/`, `public/og/`.

---

## Dependencies (high level)

| Package | Use |
|---------|-----|
| `astro` 7 | Static site generator |
| `@astrojs/mdx` | MDX support |
| `@astrojs/rss` | RSS feed |
| `pagefind` | Static search index |
| `rehype-slug` | Heading anchors |
| `js-yaml` | YAML parsing (ingest, site meta) |
| `@resvg/resvg-js` | SVG → PNG for OG images |
| `@fontsource/*` | Self-hosted fonts (Bricolage Grotesque, Newsreader, Space Mono) |

---

## Typical agent workflows

### Publish a new post

1. Add markdown to docs repo under the correct folder (`essays/`, `notes/`, etc.).
2. Set `status: active` in source frontmatter **or** add `entries.<slug>.status: active` in `content-meta.yaml`.
3. Run `npm run ingest` (or `npm run dev` / `npm run build`).
4. Commit generated `src/content/` and `src/lib/ingest-manifest.json` if this repo tracks them.

### Change site copy or hero

Edit `content-meta.yaml` only. Re-run ingest if hero slug validation is needed.

### Add a rehype plugin or markdown feature

Edit `astro.config.mjs`. Add corresponding styles in `src/styles/global.css`.

### Add a new section (rare)

Requires coordinated changes: `FOLDER_MAP` in ingest, `SECTIONS`/`NAV_SECTIONS` in `site.ts`, collection in `content.config.ts`, routing pages, and docs repo folder structure.

### Fix styling

Single stylesheet: `src/styles/global.css`. Theme tokens use CSS custom properties under `[data-theme="light"]` / `[data-theme="dark"]`.
