---
publish: true
id: plan.phase-3.lesson-4-sandbox-providers
title: "Synergy Lesson 4: Sandbox Providers and the First Routes"
created: 2026-11-01
updated: 2026-11-14
kind: plan
version: 1.1.1
tags:
   - plan
   - phase-3
   - task
   - synergy
   - feature-system
   - api
status: planned
---

> **Lesson 4 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-3-entity-index/00-brief|lesson 3]]. Next: [[04-phases/03-synergy/00-lessons/lesson-5-outbox/00-brief|lesson 5]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** the first two feature packages, `packages/features/_sandbox/notes` and `packages/features/_sandbox/tasks`, the mock providers Synergy is proven with. Each has its own table, migrations and feature manifest, and create and save routes that write the provider's row and call Synergy in the same transaction. Synergy gets its first route, `GET /api/synergy/entities/:id` with an ETag and 304, plus the error-to-HTTP map and its three entry points.

**Implements:** the plan's [[04-phases/03-synergy/00-plan#Decisions made while planning|sandbox decision]], the overview's Packages, Write path ("Create", "Save content") and API sections ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]), [[03-system-design/functional-design/04-synergy/content-sequence|Content sequence]] (the ETag).

**Learning payoff:** what makes a feature package (manifest, own tables, own routes, imported by the registry and the app); one transaction across two packages; deferrable foreign keys and why the provider row can be written before its index row; conditional requests (`ETag`, `If-None-Match`, 304); mapping stable error codes to HTTP statuses in one place; package entry points (`exports`) and `server-only`.

**Coach reads first:** the overview, [[03-system-design/functional-design/00-feature-system/core|feature system]], `packages/features-registry/src/`, `apps/app/src/app/api/health/route.ts`, `packages/foundation/core/src/api/guard.ts`, `packages/ops/src/scripts/entitlements-grant.ts` in the Sidekick repo.

## Handover from lesson 3

Lesson 3 ([[04-phases/03-synergy/00-lessons/lesson-3-entity-index/01-walkthrough|walkthrough]], [sidekick#58](https://github.com/mehtapratik/sidekick/pull/58)) left the repo like this:

- **Tables:** `entity_index` (soft delete with tombstones visible) and `version_log` (append-only since the follow-up, Synergy `0006` and `0007`; Synergy `0001` to `0007` in all), RLS on `user_id` only, FORCE, `enforce_soft_delete` on both, a strict restore-aware trigger on `entity_index` ([[D263]]) and an update-refusing one on `version_log`, which `app_runtime` can't update or delete. Keys are text with a CHECK ([[D266]]). Every table's model is in [[03-system-design/non-functional/database/delete-models|Delete models]]; add the sandbox tables to its list.
- **Repository** (`packages/platform/synergy/src/repository/`, not exported yet; step 3's `/server` exports it): `registerEntity(tx, payload)`, `saveEntityContent(tx, payload)` (base `baselineContentSeq`, `bump: 'revision' | 'version'`, optional `changeNote`; throws `SynergyError` with `stale_content` or `not_found`), `getEntity(tx, id, { includeDeleted })` (returns `EntityIndexRow | undefined`). Writes are wrapped in `withUserLock`, and lint rule `sidekick/require-user-lock` fails any write in `src/repository/` outside it ([[D265]]). `Actor` is `{ kind: 'system' }` or `{ kind: 'human' | 'agent' | 'api_key', id }`; the user id always comes from the `withRLS` session, never a parameter.
- **Tests:** Synergy's `vitest.config.ts` aliases `server-only` to a stub, so tests can call the repository through `withRLS`. Drizzle wraps database errors (`DrizzleQueryError`); a trigger's message is on `error.cause`. Each test registers its own rows. Deleting a test user who owns entities is refused by the soft-delete trigger through the cascade, so tests don't clean up users (the database is throwaway).
- **Decide in this lesson: take the user lock at the start of every provider write.** A provider writes its own row before calling Synergy, so the lock isn't first in the transaction. Once Synergy writes a provider row under the lock (lesson 10's `addAnchor`), two tabs can deadlock: tab 1 holds note N's row and waits for the user lock; tab 2 holds the user lock and waits for N's row. Recommendation (Pratik's idea, 2026-11-14): move the lock function into core and give `withRLS` an option (`{ lockUser: true }`) that takes it right after setting the user, used by every provider write route; keep `withUserLock` in Synergy as the guarantee (a second lock in one transaction is free). It changes core's public `withRLS`, so it's its own step with a test.
- **Names:** a database row type is `<Table>Row` (`EntityIndexRow`); `/contracts` keeps the plain noun (`Entity`) for its zod-inferred types, with a mapper from row to contract ([[08-ai-coding-harness/coding-standards|Coding standards]]). Inferred types are named as interfaces (`interface X extends Y {}`, allowed by lint).
- **Every exported member gets a short JSDoc line** saying what it does (Pratik, 2026-11-14), from this lesson on.
- **Editor gotcha:** after changing `eslint-plugin-sidekick`, rebuild it and restart the editor's ESLint server ([[08-ai-coding-harness/commands-and-environment|Commands and environment]]).

## Steps

**Good to write yourself:** the notes table and its save route (steps 2 and 4); tasks then copies the shape.

1. **The packages.** `_sandbox/notes` and `_sandbox/tasks` (package names decided in the lesson, for example `@sidekick/sandbox-notes`). Add the `packages/features/_sandbox/*` workspace glob, the matching tsconfig project glob, and a boundaries element pattern for `packages/features/_sandbox/*` listed before `packages/features/*`, so lint treats each as its own feature and notes can't import tasks. Each exports a `FeatureManifest` (`sandbox-notes`, `sandbox-tasks`) that the registry adds to `ALL_FEATURES`.
2. **The tables.** A `notes` table (title, body as minimal Tiptap JSON) and a `tasks` table (title, done), each in its own package's migrations (lesson 2's pattern), soft delete with tombstones hidden, RLS on own rows, and a deferrable foreign key to `entity_index(id)`, so a provider row can't exist without its index row.
3. **Entry points.** `@sidekick/synergy` gets `/server` (repository and save call; imports `server-only`), `/contracts` (zod schemas, types and error codes) and an empty `/react` for 3b.
4. **Create and save.** Routes in `apps/app` (for example `/api/sandbox/notes`) through `withApiGuard` with the feature key: create writes the note and calls `registerEntity` (provider `sandbox-notes`, type `note`) in one `withRLS` transaction; save sends the base `content_seq` and gets 409 `stale_content` when it's stale. Same for tasks.
5. **Synergy's first route.** `GET /api/synergy/entities/:id` returns the index fields and `ETag: "<content_seq>"`, and answers 304 to a matching `If-None-Match`. `not_found` covers other users' ids too.
6. **The error map.** One function in `apps/app` (or Synergy's `/contracts`, decided in the lesson) from error code to HTTP status, per the overview's table, so every later route reuses it. Error bodies carry the code, never a message.
7. **Grant and try it.** `pnpm ops:entitlements:grant --email <you> --feature sandbox-notes --feature sandbox-tasks --apply` against dev, then create, save and fetch a note with `curl`, including a 304 and a stale save.
8. **Prove it.** Integration tests through the routes: create and save a note and a task; a stale save gets 409; `GET` returns the ETag and a 304; a caller without `sandbox-notes` gets 403; another user's id gets 404.

**Exit check:** step 8 green in CI, and step 7 by hand.

**Unit-test candidates:** the error map.

**Out of scope:** `resolve`, `render` and the playground (3b), links (lesson 6), status and versions routes (lesson 5).
