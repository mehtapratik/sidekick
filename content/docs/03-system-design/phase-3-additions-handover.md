---
publish: true
id: system-design.handover.phase-3-additions
title: "Phase 3 Additions: System Design Handover"
created: 2026-11-05
updated: 2026-11-06
kind: plan
version: 1.0.0
status: deprecated
tags:
   - system-design
   - handover
   - one-repo
   - i18n
   - synergy
---

> **Retired 2026-11-06.** The pass settled all twelve questions with Pratik and wrote the answers into the live pages (D249 to D260): [[03-system-design/functional-design/05-public-site/00-overview|Public site]], [[03-system-design/non-functional/hosting-and-domains|Hosting and domains]], [[03-system-design/non-functional/css/design-tokens|Design tokens]], [[03-system-design/non-functional/css/native-ui|Native UI]], [[03-system-design/non-functional/content/internationalization|Internationalization]], the [[03-system-design/functional-design/04-synergy/00-overview|Synergy overview]], [[03-system-design/non-functional/runtime-validations|Runtime validations]] and [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]]. Two answers changed the scope: the public site is temporary (D256), and Mantine leaves the App in a new lesson M1 (D255). This page stays as the record of the questions.

The system design was last written for Synergy alone: [[03-system-design/functional-design/04-synergy/00-overview|Synergy]] 1.3.0, from arkive #25, with the violations work (#33, #34) folded in since. Phase 3 has grown after that. Lesson 0 merges Arkive into Sidekick, the site lessons S1 to S7 rebuild the public site and move it to ossidekick.com, and the i18n lessons I1 and I2 replace `@sidekick/copy` (arkive #38 to #50). Those decisions live in PRD, spec and plan pages, and the system design pages they touch still describe the old shape.

This page is the input for one system-design pass. It lists what was added, where the current design is now wrong or silent, and the questions the pass has to settle with Pratik, each with a recommendation. The pass writes its answers into the system design pages; this page then retires.

## Read first

- [[02-prd/03-features/01-synergy/09.prd.features.synergy.one-repo|One Repo]] (D213 to D227) and the [[02-prd/03-features/01-synergy/spec#One Repo|spec's One Repo section]] (stories 95 to 106, D228 to D239).
- [[03-system-design/non-functional/content/internationalization|Internationalization]] (D240 to D248). It is already a system design page, so the pass connects it to the rest rather than redesigning it.
- The [[04-phases/03-synergy/00-plan|Synergy plan]] 2.3.0: the i18n lessons, the site lessons and "Decisions made while planning".
- [[04-phases/03-synergy/00-lessons/lesson-0-one-repo/00-brief|Lesson 0]], for the order in which the repo changes land.
- The pages the pass edits: [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]], [[03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries|eslint-plugin-boundaries]], [[03-system-design/non-functional/monorepo/vercel|Vercel]], [[03-system-design/technology-stack|Technology stack]], [[03-system-design/non-functional/css/css—modules|CSS modules]], [[03-system-design/non-functional/code-quality-checks/prettier-at-repo-level|Prettier at repo level]], [[03-system-design/non-functional/code-quality-checks/typescript/shared-tsconfig|Shared tsconfig]] and the Synergy overview.
- The design handover for the new site, in the project's shared files (`one-repo/design/`). It is never committed.

## What was added

| Addition                                                                                                  | Datums                                 | Built in                       |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------ |
| One repo: `content/docs`, `content/writings`, `apps/www`, `apps/app`, `@sidekick/content`, licences       | [[D213]] to [[D217]]                   | Lesson 0, PRs 1 to 3           |
| The site type-checked with `astro check` and hosted on the `sidekick-www` Worker with branch previews     | [[D220]], [[D231]], [[D233]]           | Lesson 0, PRs 4 and 5, hosting |
| No published URL changes, tested by the sitemap diff                                                      | [[D221]], [[D234]]                     | Every step                     |
| Project vocabulary in `07-glossary/`, no `CONTEXT.md`                                                     | [[D226]]                               | Lesson 0, PR 1                 |
| English only but i18n-ready: next-intl, use-intl, colocated catalogs, `@sidekick/i18n`, logical CSS, lint | [[D240]] to [[D248]]                   | I1, I2                         |
| The new site: one `58rem` breakpoint, milestone tiles, Writings-only feed, components in content          | [[D223]] to [[D225]], [[D227]]         | S1 to S6                       |
| The cutover: ossidekick.com, `app.ossidekick.com`, arkive.blog 301s for a year, no App link               | [[D218]], [[D219]], [[D222]], [[D235]] | S7                             |

Order inside Phase 3: Lesson 0, lessons 1 to 13, Checkpoint 3a, I1, I2, S1 to S7, then 3b.

## Where the design is now wrong or silent

Grouped by area. Each item names the page, what it says today and what has been decided since. Items marked **(decide)** need a question below; the rest are updates the pass can write directly.

### Repo and package map

- **Dependency flow** (1.6.0). The apps row names `apps/web` and "later `apps/cli`"; there is no `apps/www` and no `content/`. Foundation lists `copy`, which I1 deletes, and not `i18n`, which I1 creates. `dependency-flow.svg` shows the same. **(decide: Q1, Q2, Q3)**
- **React as peer dependency** ([[D58]]) says `apps/web` owns the installed React. Two apps now install it: `apps/app`, and `apps/www`, which renders content components with `renderToStaticMarkup` ([[D227]]). Both take `react` from the pnpm catalog; the page should say so.
- **eslint-plugin-boundaries.** `apps/*` is one `app` element, so `apps/www` would get an app's rights: the registry, features, platform packages and `@sidekick/core`, which holds the database client. `content/` matches no element. **(decide: Q1, Q2)**
- **Synergy overview.** The package table and `synergy-packages.svg` name `apps/web`; [[D201]] says every label comes from `packages/copy`. **(decide: Q4, Q5)**
- **Lesson 1's move list** still moves `copy` into `packages/foundation/`, and I1 deletes it a few weeks later. That is fine, but the pass should say it is expected, so nobody "fixes" lesson 1 to skip the move.

### Hosting and domains

- **Vercel** ([[D54]]): root directory `apps/web`, and the stable `vercel.app` URL as `NEXT_PUBLIC_APP_URL`. Since then: root directory `apps/app` (Lesson 0, PR 2), Skip deployment on for content-only commits ([[D215]]), and from the cutover `app.ossidekick.com` as a DNS-only CNAME, with `NEXT_PUBLIC_APP_URL` and Supabase's Site URL changed on the same day ([[D218]]).
- **No page describes the public site's hosting.** The Worker ([[D220]]), the URL rule ([[D221]]), the zero-downtime cutover and the arkive.blog redirect rules ([[D222]]) live only in the PRD and spec. **(decide: Q9)**
- **Technology stack** (1.0.0) has one hosting row (Vercel) and no row for the public site (Astro, Cloudflare Workers) or i18n (next-intl, use-intl).
- **System overview diagram** (`architectural-overview.svg`) shows only the App's tiers. The public site is a second, static surface with no API calls.
- **Turbo env.** The shared `build` task lists the App's environment variables (`NEXT_PUBLIC_APP_URL`, Supabase, Stripe), so a change to any of them also misses the site's cache. Small, but `@sidekick/www#build` can declare its own `env` when it gets its `inputs` line in Lesson 0.
- **Node version files.** Sidekick's CI reads `.nvmrc` (24); the spec gives the site `.node-version` 24 because Cloudflare reads that file. Two files for one version should be stated as deliberate, or one should go.

### Code quality and tooling

- **Prettier** ([[D56]]): `.prettierignore` gains `content/` ([[D216]]) and the files the site ships as given, and the root gains `prettier-plugin-astro`. The page's script examples also predate `prettier --check .`.
- **ESLint does not reach the site yet.** `apps/www` has no `lint` script, and nothing decides how `.astro` files are linted. When it does run, the Pages Router ban in `eslint.config.js` matches `apps/*/src/pages/**` with selector `Program`, so it fails every Astro page. [[D248]]'s `no-literal-string` must cover the site's user-facing code. **(decide: Q8)**
- **Stylelint.** `lint:styles` globs only `*.module.css`, and `selector-class-pattern` requires camelCase. The site's stylesheet is global with kebab-case classes (`.prose`, `.wide`), and `stylelint-use-logical` ([[D246]], [[D248]]) has to see it and `tokens.css`. **(decide: Q7)**
- **Shared tsconfig** ([[D50]]) says every package extends `tsconfig.base.json`; the site extends `astro/tsconfigs/strict`. **(decide: Q8)**
- **CI.** The labeler workflow ([[D215]]) is the first one that needs `pull-requests: write`; CI is read-only today. `pnpm typecheck` gains `astro check` and the build gains the privacy and datum gates ([[D231]]). The catalog check ([[D248]]) becomes a Turbo task. Testing layers should say which of these are checks and which are tests.

### Styling and the design system

- **One token source.** [[D227]] moves `tokens.css` into `@sidekick/ui` as "the one token source". The App styles with Mantine's theme and CSS modules ([[D47]], the Mantine page), and nothing says whether the Mantine theme reads the same variables. **(decide: Q6)**
- **CSS modules everywhere** ([[D47]]) says "all styling uses CSS modules without exception". The site's S1 stylesheet is global, and only its content components use CSS modules. **(decide: Q7)**
- **The one breakpoint** ([[D223]]) is written as a site rule. The App uses Mantine's breakpoints. The pass should say that D223 binds the site only, or extend it to the App on purpose.

### The public site

- **The site has no system design page.** Its pipeline (`vault.mjs`, `entries.ts`, `tree.ts`, the remark and rehype plugins), the `publish: true` gate, the privacy and datum gates, retired entries and "As of" are written only in the site's agent notes (`CLAUDE.md`, becoming `apps/www/AGENTS.md`). **(decide: Q9)**
- **Components in content** ([[D227]]): a remark plugin loads a component by name, validates its props, renders it with `renderToStaticMarkup` and replaces the fenced block. Two things are unsettled. Where the name-to-component map and the props schemas live (zod is the house validator, [[D49]]). And whether a CSS module imported by a component rendered from inside a remark plugin is processed and emitted by Astro's build, since that component is outside Astro's component graph. **(decide: Q10)**
- **One interface** ([[D48]]) forbids pages that read the database directly. The site reads Markdown files at build time, which is not user data, so it does not break D48, but no page says so. It matters later: datums move into the database at Taxila beta, and then the site's datum index would read through the API like any other consumer.
- **Live paths.** [[03-system-design/functional-design/04-synergy/violations-and-exceptions|Violations and exceptions]] cites the arkive repo's `CLAUDE.md` and `src/lib/datums.mjs`, which become `apps/www/AGENTS.md` and `apps/www/src/lib/datums.mjs`. Lesson 0's step 9 does not list this page.

### Internationalization against the rest of the design

- **`@sidekick/i18n`'s layer.** It is domain-free, so foundation. But foundation packages never import each other, and `ui` primitives have words of their own (a close button's accessible name). **(decide: Q3)**
- **Whose namespace a type label is in.** [[D201]] keys a type's label as `synergy.type.sandbox-notes.note`. [[D243]] says a package's strings live in its own catalog under its own namespace, so the label "Note" belongs to the `sandbox-notes` provider, not to Synergy. **(decide: Q4)**
- **How the Sneak Peek Link gets its words.** The component is host-agnostic: the host injects the transport, and a third party can render it. A `useTranslations` call needs a provider above it, which Sidekick's pages get from next-intl and a third party does not have. **(decide: Q5)**
- **Validation messages.** `/contracts` shares zod schemas between server and browser ([[D199]]). Zod's default messages are English sentences, which breaks keys-never-copy ([[D201]]) once they reach an API response. **(decide: Q11)**
- **The person's locale and time zone.** [[D242]] reads the locale from "their setting" and [[D245]] shows dates "in the person's time zone", but the profile has neither field. next-intl also needs an explicit `timeZone`, or server-rendered and browser-rendered dates can differ. **(decide: Q12)**
- **Amounts with a currency** ([[D245]]) are a rule for every future table, so it belongs in the database conventions ([[03-system-design/non-functional/database/syncable-tables|syncable tables]]) as well as on the i18n page.
- **Other consumers of keys.** The API returns keys, so `apps/cli`, bots and third parties need the catalogs to show labels. Nothing in Phase 3 needs it; the pass should record it as a known gap, not design it.
- **Retiring Centralized Copy.** I1's docs PR retires [[D36]], rewrites [[D23]] in best practices and fixes the architecture invariants ([[04-phases/03-synergy/00-plan#i18n lessons|plan]]). The pass only confirms that list is complete.

### Security and auth

- The App's sign-up is off and the site has no App link until Open House ([[D219]]). The authentication page should record the sign-up setting and the Supabase redirect URLs that change at the cutover (Site URL, the `vercel.app` URL, localhost and the preview pattern kept).

## Questions for the pass

One at a time, recommendation first, Pratik decides. Write each answer into the page it changes, with a Decision History row and a log row.

1. **What may `apps/www` import?** Recommended: a new boundaries element type, `site` (`apps/www`), that may import only foundation packages, and that nothing imports. The public site is static and public; it must never reach `core`'s database client, the registry or a feature, and lint should make that impossible rather than unlikely. Runner-up: keep it an `app` and rely on review.
2. **Is `content/` an element?** Recommended: no. It holds Markdown and no code, so ESLint ignores it, and the site reads it through `vault.mjs` by path, not by import. The `@sidekick/content` dependency exists for Turbo's hashing and Vercel's skip ([[D215]]); the dependency flow page should say exactly that, so nobody adds code to it.
3. **Where does `@sidekick/i18n` live, and may `ui` use it?** Recommended: `packages/foundation/i18n`, and `ui` primitives take their words as props, so the foundation rule stays flat and `ui` stays usable in a host that has no catalogs. Runner-up: one explicit exception, `ui` may import `i18n`, written as a boundaries rule.
4. **Who owns a type's label?** Recommended: the provider. Each provider's catalog holds its types' labels (`sandbox-notes.type.note`); Synergy's catalog holds only Synergy's own words (link states, the seeded relation types, error codes). This follows [[D243]] and keeps "deleting a feature deletes its words". [[D201]] is rewritten to say so, and its `synergy.type.<provider>.<type>` example goes.
5. **How do the Sneak Peek Link's labels reach it?** Recommended: the component calls `useTranslations('synergy')` from `use-intl`, not `next-intl`, and the host wraps it in an intl provider. In the App that is next-intl's provider, which is use-intl's; a third party wraps it in use-intl's `IntlProvider` with Sidekick's catalog. The pass should check that one copy of `use-intl` serves both, the way [[D58]] does for React. Runner-up: labels injected as a prop, like the transport.
6. **Is `tokens.css` the App's token source too?** Recommended: yes, as the target, and not built yet. `tokens.css` is the one source for the site and for `ui` from S1; the App's Mantine theme reads the same CSS variables when the App is next restyled, and until then the page says the App is not on the tokens. A second source is what [[D227]] set out to prevent.
7. **What does [[D47]] cover?** Recommended: CSS modules for every component, in the App, in packages and in the site's content components. The site may also have one global stylesheet for its chrome and prose. Stylelint gets a second config block for the site: kebab-case classes, and `stylelint-use-logical` on every CSS file in both apps and `ui`.
8. **How do the site's TypeScript and lint join the repo's?** Recommended: the site keeps `astro/tsconfigs/strict` and adds the base options Astro does not set, and [[D50]] names the site as its one exception. In I2, `apps/www` gets a `lint` script with `eslint-plugin-astro`, and the Pages Router ban is narrowed to the App's folders.
9. **Where does the site's design live?** Recommended: two new pages. A **Public site** page in `functional-design/` (the content pipeline, gates, routes, retired entries, milestones, the feed, components, the JS budget), with `apps/www/AGENTS.md` keeping only the short rules. And a **Hosting and domains** page in `non-functional/` that holds the App on Vercel ([[D54]], revised in place), the site on the Worker ([[D220]]), the domains and the cutover ([[D218]], [[D222]]), with the Vercel page folded into it.
10.   **How are content components built and styled?** Recommended: a component map in `apps/www` (name, component, zod props schema), the way the feature registry collects manifests, with a build failure on an unknown name or bad props ([[D238]]). Before the design commits to CSS modules here, the first lesson that builds a component spikes whether Astro emits a CSS module imported from inside a remark plugin. If it does not, the fallback is to render the block through an Astro wrapper component.
11.   **How do validation errors stay keys?** Recommended: `/contracts` sets a zod error map that turns every issue into a key and parameters (`{ code: 'too_small', path, minimum }`), the API returns those, and the App translates them with ICU messages. The runtime validations page ([[D49]]) records the rule.
12.   **Where do locale and time zone come from before a setting exists?** Recommended: no profile columns yet, since a nullable column is cheap to add later. I1 sets next-intl's `timeZone` explicitly in `i18n/request.ts` (UTC, or the browser's time zone sent in a cookie, decided in I1's brief) so server and browser agree. The columns arrive with the settings screen.

## Constraints to keep

- Individual first: one person, every setting optional ([[D1]]).
- One interface for every consumer ([[D48]]).
- Scope by the cost to add later: decide now only what would force a migration or a rewrite later.
- Pratik types every change; the coach explains. The pass writes docs, not code.
- Datum ids are global and never renumbered. New datums start at **D249**; check with `node scripts/check-datums.mjs --next`.
- Retired pages (the one-repo map and its tickets, the Synergy map and tickets) are records and are never edited. New decisions go into live pages only.
- A page whose decision lands in a later lesson describes the target and says what the code does until then, as [[03-system-design/non-functional/content/centralized-copy|Centralized Copy]] does now.

## Done when

- Every item above is either updated in its page or answered by a question, and every question's answer is in a live page with a Decision History row and a row in the [[06-decisions/log|decisions log]].
- The Synergy plan's "Handover from system design" table gains a row for each answer that changes a lesson, and Lesson 0's step 9 lists any extra live paths found.
- `npm run build` passes, with the privacy and datum gates.
- This page is marked `status: deprecated`.
