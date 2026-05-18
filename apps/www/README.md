# ARKIVE

Public journal for [Project Sidekick](https://github.com/mehtapratik/sidekick). Built with Astro; content ingested from `../sidekick/docs` at build time.

## Design

Warm-paper light theme with optional dark mode. Serif headlines (Averia Serif Libre), Barlow body, JetBrains Mono accents. No logo on pages — the wordmark `ARKIVE` is the only brand element. The K letterform is reserved for favicons and app icons.

## Local development

```bash
npm install
# expects sidekick/docs at ../sidekick/docs
npm run dev
```

Override docs path:

```bash
DOCS_ROOT=/path/to/sidekick/docs npm run dev
```

## Brand icons

Source assets live in `public/brand/`:

- `favicon.svg` / `favicon-dark.svg` — SVG favicons for light/dark UA
- `app-icon.svg` / `app-icon-maskable.svg` — PWA icons
- `og.svg` — 1200x630 social card
- `k-dark.png` / `k-light.png` — bitmap source for raster PNG favicons

Raster PNGs for favicons and social cards are generated before each build:

```bash
npm run icons:raster
```

## Hero & drafts

Edit [`content-meta.yaml`](content-meta.yaml):

- `site.hero` — slug of the featured home post (use `category/slug` if ambiguous)
- `site.heroImage` — optional image under `public/` (e.g. `/images/hero/custom.jpg`)
- `entries.<slug>.draft: true` — exclude from site

## Production (Cloudflare Pages)

Build command:

```bash
bash scripts/cf-build.sh
```

Output directory: `dist`

Set `CF_PAGES_DEPLOY_HOOK` in the sidekick repo to redeploy when `docs/**` changes.
