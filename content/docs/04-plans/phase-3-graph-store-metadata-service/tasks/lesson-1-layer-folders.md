---
publish: true
id: plan.phase-3.lesson-1-layer-folders
title: "Synergy Lesson 1: Layer Folders and Lint"
created: 2026-11-01
updated: 2026-11-01
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-3
   - task
   - monorepo
   - eslint
status: planned
---

> **Lesson 1 of 13 in Phase 3a.** Before this: [[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/lesson-8-close-out|Phase 2 close-out]]. Next: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-2-per-package-migrations|lesson 2]]. The coach follows the plan's [[04-plans/phase-3-graph-store-metadata-service/phase-3-graph-store-metadata-service#How we build|how we build]].

**What gets built:** every layer gets its own folder. `core`, `ui` and `copy` move into `packages/foundation/`, an empty `packages/platform/synergy` (`@sidekick/synergy`) appears, and lint fails on a package that sits in no layer.

**Implements:** [[06-decisions/technical/platform-layer|Platform layer]], [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]] 1.3.0, [[03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries|eslint-plugin-boundaries]] 2.2.0.

**Learning payoff:** what foundation, platform and feature mean and why the folder is the layer; moving files without losing history (`git mv`); how pnpm workspace globs, TypeScript project references and the boundaries plugin each find a package; policies that default to "disallow".

**Coach reads first:** the three decision notes above, `eslint.config.js`, `pnpm-workspace.yaml`, every `tsconfig.json` under `packages/`, `packages/core/package.json` and `.prettierignore` in the Sidekick repo.

## Steps

**Good to write yourself:** the boundaries policies (step 4), once the coach has explained the element types.

1. **Move foundation.** `git mv packages/core packages/ui packages/copy packages/foundation/`. Package names stay, so no import changes. Fix what depends on depth: the three `tsconfig.json` `extends` (`../../../tsconfig.base.json`), core's `db:generate` and `db:migrate` scripts (`../../../.env.local`), the `packages/core/…` and `packages/ui/…` file globs in `eslint.config.js` (lines naming `log.ts`, `rls.ts` and the React block), `.prettierignore` and the comment in `.env.example`. Reinstall so the lockfile follows.
2. **Create the platform package.** `packages/platform/synergy` with `package.json` (`@sidekick/synergy`), `tsconfig.json`, an `src/index.ts` that exports nothing yet, and the `lint`, `typecheck` and `test` scripts the other packages have. The `/server`, `/react` and `/contracts` entry points arrive in lesson 4.
3. **Globs.** `pnpm-workspace.yaml` lists `packages/foundation/*`, `packages/platform/*` and `packages/features/*` (plus the singletons), and the import resolver's `project` list in `eslint.config.js` gets the same folders. Lesson 4 adds `packages/features/_sandbox/*`.
4. **Boundaries.** Add the `foundation` and `platform` element types, remove the `packages/*` catch-all, and turn on the rule that reports files in no element (check its name in boundaries v7). Policies: apps, the registry, features and ops may import platform; platform may import only foundation; platform packages may not import each other.
5. **Prove the policies.** In a scratch branch, inside a package with `pnpm lint`: one allowed import (synergy imports core), one refused import (core imports synergy), and one package in no layer (a throwaway `packages/stray`) that fails. Remove the scratch changes.
6. **Prove the move.** `pnpm turbo run build lint typecheck test --force`, `pnpm test:integration` and `pnpm db:migrate` against dev, all green.
7. **Docs (coach, in the arkive PR).** Update the live docs that name the old paths: the Synergy overview, testing layers, Lexicon highlighting, centralized copy, ESLint best-practice rules, shared tsconfig, TypeScript hoisting and the agent guide (dependency direction). Add a post note to the Phase 2 walkthrough. Finished walkthroughs keep their old paths.

**Exit check:** step 5's three lint results, and step 6 green.

**Out of scope:** per-package migrations (lesson 2), the `_sandbox` packages (lesson 4), any Synergy code.
