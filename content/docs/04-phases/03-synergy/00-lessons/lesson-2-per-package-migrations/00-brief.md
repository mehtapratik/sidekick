---
publish: true
id: plan.phase-3.lesson-2-per-package-migrations
title: "Synergy Lesson 2: Per-Package Migrations"
created: 2026-11-01
updated: 2026-11-11
kind: plan
version: 1.1.0
tags:
   - plan
   - phase-3
   - task
   - database
   - drizzle
   - testing
status: completed
---

> **Lesson 2 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-1-layer-folders/00-brief|lesson 1]]. Next: [[04-phases/03-synergy/00-lessons/lesson-3-entity-index/00-brief|lesson 3]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** each package that owns tables gets its own Drizzle config, its own migrations folder and its own migrations table. `pnpm db:migrate` runs them in dependency order (foundation, then platform, then features), and the throwaway test database is built the same way, so Synergy's integration tests in lesson 3 run against every migration.

**Implements:** [[03-system-design/non-functional/database/migration|Migration]] (each package owns its Drizzle config and migrations), [[03-system-design/non-functional/monorepo/dependency-flow|Platform layer]] (consequences).

**Learning payoff:** what drizzle-kit records in its migrations table and journal, and why two packages must not share one; Turbo's `dependsOn: ["^task"]`, which runs a task in a package's dependencies first, so the package graph sets the migration order; why applied migrations never move between packages; building a test database from scratch.

**Coach reads first:** [[03-system-design/non-functional/database/migration|Migration]], `packages/foundation/core/drizzle.config.ts`, `packages/foundation/core/tests/with-test-db.sh`, `packages/foundation/core/tests/helpers/`, `turbo.json` and `.github/workflows/ci.yml` in the Sidekick repo.

## Steps

**Good to write yourself:** the Turbo change (step 2), after the coach explains `^`.

1. **Synergy's Drizzle config.** `packages/platform/synergy/drizzle.config.ts` with its own `out` folder and its own migrations table (`migrations.table`, for example `__drizzle_migrations_synergy`). Core keeps the default table name: renaming it would make drizzle-kit think nothing was applied and run every migration again.
2. **Order.** `db:migrate` in `turbo.json` gets `dependsOn: ["^db:migrate"]`, and synergy lists `@sidekick/core` as a dependency, so core's migrations always run first. Explain why ordering by the package graph is the same as ordering by layer.
3. **A first Synergy migration.** Synergy's restore-aware update trigger function (allows an update to a deleted row only when it restores it, `OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL`), as a custom migration. Lesson 3 binds it to tables. It's small, real, and proves the second stream runs.
4. **The test database.** Move `with-test-db.sh` to the repo root (for example `scripts/with-test-db.sh`) and have it run every package's migrations in order, the same way `pnpm db:migrate` does. Point core's `test:integration` at it; synergy gets the same script.
5. **Shared test helpers.** Synergy is the second package that needs `tests/helpers/` (`db.ts`, `http.ts`, `mocks.ts`). **Decide in the lesson** where they live. The coach's starting recommendation: a root singleton `packages/test-utils` (`@sidekick/test-utils`), a new boundaries element that only test files may import. It imports `core`, so it can't be foundation.
6. **Prove it.** A fresh database migrates in order (`pnpm test:integration` passes in core and in synergy, with synergy's suite checking that its trigger function exists), and `pnpm db:migrate` against dev applies only Synergy's new migration.

**Exit check:** step 6, and CI green.

**Done:** see the [[04-phases/03-synergy/00-lessons/lesson-2-per-package-migrations/01-walkthrough|walkthrough]] ([sidekick#53](https://github.com/mehtapratik/sidekick/pull/53)) for where the build differs from these steps.

**Out of scope:** Synergy tables (lesson 3), the `_sandbox` packages' migrations (lesson 4).
