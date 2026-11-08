---
publish: true
id: plan.phase-3.lesson-4-sandbox-providers
title: "Synergy Lesson 4: Sandbox Providers and the First Routes"
created: 2026-11-01
updated: 2026-11-01
kind: plan
version: 1.0.0
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

**Coach reads first:** the overview, [[03-system-design/functional-design/00-feature-system/core|feature system]], `packages/features-registry/src/`, `apps/web/src/app/api/health/route.ts`, `packages/foundation/core/src/api/guard.ts`, `packages/ops/src/scripts/entitlements-grant.ts` in the Sidekick repo.

## Steps

**Good to write yourself:** the notes table and its save route (steps 2 and 4); tasks then copies the shape.

1. **The packages.** `_sandbox/notes` and `_sandbox/tasks` (package names decided in the lesson, for example `@sidekick/sandbox-notes`). Add the `packages/features/_sandbox/*` workspace glob, the matching tsconfig project glob, and a boundaries element pattern for `packages/features/_sandbox/*` listed before `packages/features/*`, so lint treats each as its own feature and notes can't import tasks. Each exports a `FeatureManifest` (`sandbox-notes`, `sandbox-tasks`) that the registry adds to `ALL_FEATURES`.
2. **The tables.** A `notes` table (title, body as minimal Tiptap JSON) and a `tasks` table (title, done), each in its own package's migrations (lesson 2's pattern), soft delete with tombstones hidden, RLS on own rows, and a deferrable foreign key to `entity_index(id)`, so a provider row can't exist without its index row.
3. **Entry points.** `@sidekick/synergy` gets `/server` (repository and save call; imports `server-only`), `/contracts` (zod schemas, types and error codes) and an empty `/react` for 3b.
4. **Create and save.** Routes in `apps/web` (for example `/api/sandbox/notes`) through `withApiGuard` with the feature key: create writes the note and calls `registerEntity` (provider `sandbox-notes`, type `note`) in one `withRLS` transaction; save sends the base `content_seq` and gets 409 `stale_content` when it's stale. Same for tasks.
5. **Synergy's first route.** `GET /api/synergy/entities/:id` returns the index fields and `ETag: "<content_seq>"`, and answers 304 to a matching `If-None-Match`. `not_found` covers other users' ids too.
6. **The error map.** One function in `apps/web` (or Synergy's `/contracts`, decided in the lesson) from error code to HTTP status, per the overview's table, so every later route reuses it. Error bodies carry the code, never a message.
7. **Grant and try it.** `pnpm ops:entitlements:grant --email <you> --feature sandbox-notes --feature sandbox-tasks --apply` against dev, then create, save and fetch a note with `curl`, including a 304 and a stale save.
8. **Prove it.** Integration tests through the routes: create and save a note and a task; a stale save gets 409; `GET` returns the ETag and a 304; a caller without `sandbox-notes` gets 403; another user's id gets 404.

**Exit check:** step 8 green in CI, and step 7 by hand.

**Unit-test candidates:** the error map.

**Out of scope:** `resolve`, `render` and the playground (3b), links (lesson 6), status and versions routes (lesson 5).
