---
publish: true
id: system-design.functional-design.public-site.overview
title: "Public Site: System Design"
created: 2026-11-06
kind: spec
version: 1.0.0
tags:
   - system-design
   - site
   - one-repo
status: accepted
applies_to:
   - "[[02-prd/03-features/01-synergy/09.prd.features.synergy.one-repo]]"
---

The public site, `apps/www`, shows Sidekick's progress, writings and docs while the product is built: arkive.blog today, ossidekick.com from the cutover. This page says what the site must always honour and how its current implementation is placed. The details of that implementation live next to its code, in `apps/www/AGENTS.md` (the arkive repo's `CLAUDE.md` until Lesson 0).

**D256** `decision` #site: `apps/www` is temporary: it is rewritten or retired once the MVP ships, so it favours speed over long-term maintainability and is held only to the rules that protect data, published URLs and shared code; the public face that replaces it follows every core principle and system design rule. derived-from [[D2]]

Pratik, 2026-11-06. Whether the site is rewritten or retired depends on whether other people want to use the product. Until then:

| Loosened for `apps/www`                                                                       | Still binds                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| CSS modules ([[D47]]): global stylesheets only, and Stylelint's naming rules                  | the privacy and datum gates, and `publish: true` as the only way to publish          |
| i18n: no catalogs, no `no-literal-string`, no logical-CSS lint; English with `lang` and `dir` | no published URL changes ([[D221]]), tested by the sitemap diff                      |
| TypeScript and ESLint strictness: Astro's `strict` config ([[D50]]), a minimal lint           | the `site` boundaries element ([[D258]]), so the site never reaches user data        |
| content components are plain React with global classes                                        | Prettier and green CI on every PR that touches it                                    |
|                                                                                               | `ui` and every shared package keep their full standards, since the App uses them too |

The exemption covers this implementation only. A component worth keeping moves into `ui`, where the full standards apply. When the replacement starts, the contracts below are its requirements, and everything else (the home page, the layout, the build) is free to be redesigned.

## Contracts that outlive this site

**D257** `rule` #site #content: Any public face of Sidekick honours the content's contracts: published URLs never change, `publish: true` gates every page, Writings and their feed by `created`, "As of" from frontmatter, retired entries off every listing but still open, datum anchors and `/datums.json`, milestones from the phase plans, and the `sidekick:<name>` blocks written into content. derived-from [[D221]] derived-from [[D227]]

`content/` outlives the site, and these promises are made in it or to readers:

- **URLs** ([[D221]], [[D234]]): every path in `sitemap.xml` keeps resolving, or redirects with a 301.
- **Publishing:** a page is public only with `publish: true`; the privacy gate fails a build that would publish a page tagged `private` or link into an excluded path.
- **Writings** and `/rss.xml`, Writings only, newest first by `created` ([[D225]], [[D237]]).
- **"As of"** is `updated` else `created`, from frontmatter only, never file or build time.
- **Retired entries** (`status: deprecated` or `retired`) keep their URL and leave the index, search, tag pages, pager, home, feed and sitemap.
- **Datums:** each bold id gets an anchor (`#D12`), `[[D12]]` links to it, and `/datums.json` indexes the datums in published pages; the build fails on a duplicate id, an unknown kind or a relation that does not resolve.
- **Milestones:** one tile per phase from `04-phases/NN-name/00-plan.md` ([[D224]], [[D236]]).
- **Content components:** each `sidekick:<name>` block's name and props, listed below, because they are written into entries.

## This implementation

A static Astro build, hosted on the `sidekick-www` Worker ([[03-system-design/non-functional/hosting-and-domains|Hosting and domains]]). It reads `content/` by path through `vault.mjs` at build time and makes no API calls, so it is not a consumer of the API under [[D48]] yet; when datums move into the database at Taxila beta, its datum index reads through the API. The pipeline (`vault.mjs`, `entries.ts`, `tree.ts`, the remark and rehype plugins, `arkive.js` and its JS budget, the one `58rem` breakpoint of [[D223]], which binds the site only) is described in `apps/www/AGENTS.md`.

### Content components

**D260** `decision` #site #content: Content components are listed in one map in `apps/www`, each name with its component and a zod schema for its props, and the remark plugin fails the build with the entry's path on an unknown name or props that don't parse. derived-from [[D238]] derived-from [[D49]]

```ts
// apps/www/src/content-components/index.ts
export const CONTENT_COMPONENTS = {
   "phase-timeline": {
      component: PhaseTimeline,
      props: z.object({ phases: z.array(z.string()) }),
   },
};
```

The plugin finds a `sidekick:<name>` block, looks the name up, parses the YAML with the schema, renders the component with `renderToStaticMarkup` and swaps the block for the HTML ([[D227]]). YAML in Markdown is never type-checked, so the schema is what makes a typo fail the build instead of rendering broken HTML. Components use the site's global classes; there is no CSS module to emit, so the handover's question about CSS modules imported from inside a remark plugin no longer arises. The plugin is built in the first site lesson whose entry needs a component.

| Name   | Props | Since |
| ------ | ----- | ----- |
| (none) |       |       |

## Decision History

- 2026-11-06 · accepted · `apps/www` is temporary ([[D256]]); contracts that outlive it ([[D257]]); the content component map ([[D260]])
