---
publish: true
id: plan.phase-3.lesson-1-layer-folders
title: "Synergy Lesson 1: Layer Folders and Lint"
created: 2026-11-01
updated: 2026-11-11
kind: plan
version: 1.1.2
tags:
   - plan
   - phase-3
   - task
   - monorepo
   - eslint
status: planned
---

> **Lesson 1 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-0-one-repo/00-brief|lesson 0]]. Next: [[04-phases/03-synergy/00-lessons/lesson-2-per-package-migrations/00-brief|lesson 2]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** every layer gets its own folder. `core`, `ui` and `copy` move into `packages/foundation/`, an empty `packages/platform/synergy` (`@sidekick/synergy`) appears, and lint fails on a package that sits in no layer. The public site becomes its own `site` element that may import only foundation, with a minimal lint of its own.

**Implements:** [[03-system-design/non-functional/monorepo/dependency-flow|Platform layer]], [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]] 1.3.0, [[03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries|eslint-plugin-boundaries]] 2.3.0 ([[D258]]).

**Learning payoff:** what foundation, platform and feature mean and why the folder is the layer; moving files without losing history (`git mv`); how pnpm workspace globs, TypeScript project references and the boundaries plugin each find a package; policies that default to "disallow".

**Coach reads first:** the three decision notes above, `eslint.config.js`, `pnpm-workspace.yaml`, every `tsconfig.json` under `packages/`, `packages/core/package.json` and `.prettierignore` in the Sidekick repo.

## Handover from lesson 0

Lesson 0 ([[04-phases/03-synergy/00-lessons/lesson-0-one-repo/01-walkthrough|walkthrough]]) left the repo like this:

- **New workspace packages:** `apps/www` (`@sidekick/www`, the Astro site, no `lint` script yet), `apps/app` (`@sidekick/app`, was `apps/web`) and `content` (`@sidekick/content`, Markdown only, guarded by `pnpm check:content` in CI and pre-commit). The boundaries `app` element (`apps/*`) currently matches `apps/www` too; step 4's `site` element must come before it.
- **Root config:** `prettier-plugin-astro` is a root dev dependency with an `*.astro` override, and `content/` is in `.prettierignore`. Lint-staged and Prettier load plugins from the root.
- **pnpm:** settings live in `pnpm-workspace.yaml` (`allowBuilds` now includes `workerd`); the old `.npmrc` was never read and is gone (#47). When you reinstall after `git mv`, the lockfile keys packages by folder.
- **History:** `main` has one merge commit (`8825103`, the import). Everything else stays squash-only. `.git-blame-ignore-revs` lists two format commits.
- **Hosting:** Vercel builds `apps/app` and skips content-only commits; the Worker `sidekick-www` builds the site from `main` (watch paths `apps/www/*`, `content/*` and the root files). Lesson 1's reinstall changes `pnpm-lock.yaml`, a watch path, so its PR also gets a site preview; adding the site's `lint` script changes `apps/www/`, so expect a site build there too.

## Steps

**Good to write yourself:** the boundaries policies (step 4), once the coach has explained the element types.

1. **Move foundation.** `git mv packages/core packages/ui packages/copy packages/foundation/`. Package names stay, so no import changes. Fix what depends on depth: the three `tsconfig.json` `extends` (`../../../tsconfig.base.json`), core's `db:generate` and `db:migrate` scripts (`../../../.env.local`), the `packages/core/…` and `packages/ui/…` file globs in `eslint.config.js` (lines naming `log.ts`, `rls.ts` and the React block), `.prettierignore` and the comment in `.env.example`. Reinstall so the lockfile follows.
2. **Create the platform package.** `packages/platform/synergy` with `package.json` (`@sidekick/synergy`), `tsconfig.json`, an `src/index.ts` that exports nothing yet, and the `lint`, `typecheck` and `test` scripts the other packages have. The `/server`, `/react` and `/contracts` entry points arrive in lesson 4.
3. **Globs.** `pnpm-workspace.yaml` lists `packages/foundation/*`, `packages/platform/*` and `packages/features/*` (plus the singletons), and the import resolver's `project` list in `eslint.config.js` gets the same folders. Lesson 4 adds `packages/features/_sandbox/*`.
4. **Boundaries.** Add the `foundation` and `platform` element types, remove the `packages/*` catch-all, and turn on the rule that reports files in no element (check its name in boundaries v7). Policies: apps, the registry, features and ops may import platform; platform may import only foundation; platform packages may not import each other. Add the `site` element for `apps/www` before `app` (the first match wins): it may import only foundation, and nothing imports it.
   4a. **Lint the site, minimally.** `apps/www` gets a `lint` script and `eslint-plugin-astro`; one override block at the end of `eslint.config.js` turns the strictness rules off for `apps/www/**` and leaves `boundaries` and the basics on; the Pages Router ban and the Next.js rules gain `ignores: ["apps/www/**"]`. The site is temporary and not held to the App's strictness ([[D256]]).
5. **Prove the policies.** In a scratch branch, inside a package with `pnpm lint`: one allowed import (synergy imports core), one refused import (core imports synergy), one package in no layer (a throwaway `packages/stray`) that fails, and an Astro page that imports `@sidekick/core`, which fails. Remove the scratch changes.
6. **Prove the move.** `pnpm turbo run build lint typecheck test --force`, `pnpm test:integration` and `pnpm db:migrate` against dev, all green.
7. **Docs (coach, in the docs PR).** Update the live docs that name the old paths: the Synergy overview, testing layers, Lexicon highlighting, centralized copy, ESLint best-practice rules, shared tsconfig, TypeScript hoisting and the agent guide (dependency direction). Add a post note to the Phase 2 walkthrough. Moving `copy` is expected even though I1 deletes it later: skipping it would need a temporary pattern for it. Finished walkthroughs keep their old paths.

**Exit check:** step 5's three lint results, and step 6 green.

**Out of scope:** per-package migrations (lesson 2), the `_sandbox` packages (lesson 4), any Synergy code.
