# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ARKIVE is a static Astro blog (deployed at https://arkive.blog) that publishes docs written in a *separate* repo — `../sidekick/docs` by default. Content in `src/content/` is **generated, not authored here**: the ingest script wipes and regenerates it on every dev/build run.

## Commands

```bash
npm run dev       # runs ingest first (predev), then astro dev
npm run build     # runs ingest, astro build, then pagefind index over dist/
npm run preview   # serve the built dist/
npm run ingest    # re-run content ingestion alone (scripts/ingest-docs.mjs)
```

- Requires Node >= 22.
- `DOCS_ROOT=/path/to/docs npm run ingest` overrides the source docs location (defaults to `../sidekick/docs`). Ingest exits with an error if the docs root doesn't exist.
- Search (Pagefind) only works against a built site — it indexes `dist/` at build time, so it won't return results in `astro dev`.
- Formatting: Prettier with `prettier-plugin-astro`, 3-space indent, trailing commas.
- No test suite or linter is configured.

## Content pipeline (the big picture)

1. `scripts/ingest-docs.mjs` walks `DOCS_ROOT` for `.md` files under five category directories: `essays/`, `plans/`, `decisions/`, `builds/`, `notes/`. Anything outside those (or named `index.md`) is skipped.
2. **Publishing gate:** only files whose effective `status` is `active` are ingested. Status (and any other frontmatter field) can be overridden per-slug in `content-meta.yaml` under `entries:`; precedence is override → source frontmatter → default (`draft`, i.e. unpublished).
3. For each ingested file it normalizes frontmatter (title, deck, dates from git history via `git log` in the docs repo, word count, reading minutes, author/license defaults from `content-meta.yaml`) and writes the result to `src/content/<category>/<slug>.md`. Slugs come from the filename (underscores → hyphens, lowercased); a duplicate `category/slug` pair is a hard error. The leading `# H1` is stripped from the body (the layout renders the title).
4. It also writes `src/lib/ingest-manifest.json` recording the resolved hero (featured) post — `site.hero` in `content-meta.yaml`, which may be a bare slug if unambiguous — plus the post count. This manifest is imported at build time by `src/lib/entries.ts`.

Consequences:
- To change what's published or fix a post's metadata, edit the source doc in the docs repo or `content-meta.yaml` — **not** the files in `src/content/` (they get deleted and rewritten).
- `src/content/` and `src/lib/ingest-manifest.json` are committed but machine-generated; expect them to churn.

## Site architecture

- Astro 7, fully static, no UI framework. Collections are defined in `src/content.config.ts` — one collection per category, all sharing a single zod schema.
- Routing: `src/pages/[category]/index.astro` (category listing) and `src/pages/[category]/[slug].astro` (post page), plus `index.astro`, `404.astro`, and `rss.xml.ts`. URLs are `/<category>/<slug>/`.
- `src/lib/entries.ts` is the data-access layer (`getAllPosts`, `getPostsByCategory`, `getHeroPost`, `postUrl`); it filters to `status === "active"` and sorts newest-first. `src/lib/site.ts` holds the `Category` type, labels/descriptions, and the `content-meta.yaml` loader.
- Markdown rendering is customized via inline rehype plugins in `astro.config.mjs`:
  - an `## TL;DR` section becomes a styled `.tldr-card` div,
  - `---` (hr) becomes a decorative SVG ornament,
  - h2s get `§` permalink anchors (after `rehype-slug`).
  - Shiki uses custom themes from `src/lib/shiki-themes/` (light/dark, `defaultColor: false`).
- Search is Pagefind, lazy-loaded client-side in `src/components/SearchDialog.astro` from `/pagefind/` assets produced at build time.
- Styling is a single `src/styles/global.css`; theming is light/dark via `ThemeToggle.astro`.
