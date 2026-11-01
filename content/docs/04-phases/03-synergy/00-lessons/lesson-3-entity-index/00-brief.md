---
publish: true
id: plan.phase-3.lesson-3-entity-index
title: "Synergy Lesson 3: Entity Index and Version Log"
created: 2026-11-01
updated: 2026-11-01
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-3
   - task
   - synergy
   - database
   - rls
   - postgresql
status: planned
---

> **Lesson 3 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-2-per-package-migrations/00-brief|lesson 2]]. Next: [[04-phases/03-synergy/00-lessons/lesson-4-sandbox-providers/00-brief|lesson 4]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** Synergy's first tables, `entity_index` and `version_log`, with RLS on `user_id` only, the restore-aware trigger bound, partial unique indexes and provenance columns. Also the lock-first helper and the first repository functions: register an entity, save content with the `content_seq` stale check, and read one. And a written rule for choosing a table's delete model.

**Implements:** the [[03-system-design/functional-design/04-synergy/00-overview|Synergy overview]] (Tables, Tombstones, the lock-first rule in Write path), [[03-system-design/functional-design/04-synergy/content-sequence|Content sequence]], [[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]].

**Learning payoff:** why Synergy's RLS leaves `deleted_at` to the repository; a trigger that tells a restore from any other update; advisory locks and why one fixed lock order prevents deadlocks; optimistic concurrency with a counter (`UPDATE … WHERE content_seq = $base`); partial unique indexes; why an integer beats a timestamp as a concurrency token.

**Coach reads first:** the decisions above, [[03-system-design/non-functional/security/row-level-security|row-level security]], [[03-system-design/non-functional/database/soft-delete-support|soft-delete support]], [[03-system-design/non-functional/database/syncable-tables|syncable tables]], [[03-system-design/non-functional/database/non-syncable-tables|non-syncable tables]], `packages/foundation/core/src/db/` (schema, `rls.ts`, migrations 0003 and 0007) in the Sidekick repo.

## Steps

**Good to write yourself:** the RLS policy migration (step 3) and the stale-check update (step 5).

1. **Design the tables.** Columns from the overview: `entity_index` (id, `user_id`, provider, type, display name, optional title, status `active | deprecated | superseded`, version, revision, `content_seq`, `edited_at`, timestamps, provenance, `deleted_at`) and `version_log` (entity, version, optional change note, actor, time). Keys only: provider, type and status are keys, never labels. Drizzle schema in `packages/platform/synergy/src/db/schema/`, with a one-line comment naming the delete model.
2. **Generate.** `drizzle-kit generate` from the synergy package; read the SQL. `user_id` references `profiles`, which works because core's migrations ran first (lesson 2).
3. **Lock it down.** A custom migration: enable and force RLS, own-rows policies comparing only `user_id = nullif(current_setting('app.current_user_id', true), '')::uuid`, `enforce_soft_delete` and the restore-aware trigger from lesson 2 bound to both tables. Every unique index on them is partial (`WHERE deleted_at IS NULL`).
4. **The lock.** A helper that every Synergy write calls first: `pg_advisory_xact_lock(hashtextextended(user_id::text, 0))`. Explain the story it prevents (a delete and a new reference into the same target both committing) and why one lock per user costs nothing for one person.
5. **The repository.** In `@sidekick/synergy` (server code only; the `/server` entry point arrives in lesson 4): `registerEntity`, `saveContent` (base `content_seq`, revision or version, optional change note) and `getEntity`. A stale base gets the `stale_content` error code. Every query states whether it wants live rows.
6. **Prove it.** Integration tests, through the repository (provider routes arrive in lesson 4): register an entity and save it twice; a save with a stale `content_seq` gets `stale_content`; a version save writes a `version_log` row and leaves `revision` alone; another user's rows are invisible; a deleted row can be restored but not otherwise updated. Pratik breaks the policy and the trigger one at a time and watches the tests fail.
7. **Delete models (Pratik, 2026-11-01).** In this lesson's PRs:
   - **Arkive (coach drafts, Pratik edits):** revise [[03-system-design/non-functional/security/row-level-security|row-level security]] and [[03-system-design/non-functional/database/soft-delete-support|soft-delete support]] into explicit variants, and write the guide for choosing a table's delete model, linked from [[03-system-design/non-functional/database/syncable-tables|syncable]] and [[03-system-design/non-functional/database/non-syncable-tables|non-syncable tables]]. Asked in order: can a deleted row stay gone for good (no offline sync, no undo)? Then **hard delete**. Otherwise **soft delete, tombstones hidden** (the default). **Tombstones visible** only when something must read a deleted row (an id elsewhere that must say "deleted", a Trash, undo or restore), and it costs a repository as the only access path, tests that read a deleted row, and an entry in the guide's table list with its reason. The list starts with `profiles` and `user_feature_entitlements` (both hard delete) and Synergy's tables.
   - **Sidekick:** a one-line comment naming the model in each existing Drizzle schema file (`profiles.ts`, `user-feature-entitlements.ts`). Applied migrations are not edited. A new core migration corrects `block_update_on_deleted`'s message with `CREATE OR REPLACE FUNCTION`: it says "Restore it first", but it refuses the restore too.

**Exit check:** step 6 green in CI, and `pnpm db:migrate` applied to dev.

**Unit-test candidates:** none of note; this lesson is all database behaviour.

**Out of scope:** provider tables and routes (lesson 4), the outbox (lesson 5; this lesson's writes get their events there), relationships.
