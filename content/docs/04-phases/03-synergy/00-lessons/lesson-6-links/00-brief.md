---
publish: true
id: plan.phase-3.lesson-6-links
title: "Synergy Lesson 6: Links, Relation Types and Cycles"
created: 2026-11-01
updated: 2026-11-24
kind: plan
version: 1.3.0
tags:
   - plan
   - phase-3
   - task
   - synergy
   - graph
   - postgresql
   - api
status: planned
---

> **Lesson 6 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-5-outbox/00-brief|lesson 5]]. Next: [[04-phases/03-synergy/00-lessons/lesson-7-staleness/00-brief|lesson 7]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** single links ("solo" relationships) between any two entities, with an optional label and a type from a seeded vocabulary; the cycle check that refuses a reference loop; the server half of type registration, so Synergy knows which feature gates each type and can refuse or show a link as `locked`; and the links routes with idempotent creates.

**Implements:** the overview's Type registration, Tables (`relationships`, `relation_types`, `idempotency_keys`), Write path ("Link from a field, the links panel or the API", "Every link create") and API ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]); [[03-system-design/functional-design/04-synergy/mentions-and-link-lifetime|Mentions and link lifetime]] (kinds, `cited`); [[03-system-design/functional-design/04-synergy/synergy-store-choices|Synergy store choices]] (the cycle check); [[03-system-design/functional-design/04-synergy/violations-and-exceptions|Violations and exceptions]].

**Learning payoff:** polymorphic references (a link can point at any provider's entity because both ends are `entity_index` ids); a vocabulary table keyed by `source_key` and `target_key` with labels in copy; recursive CTEs and Postgres's `CYCLE` clause; why only references are checked for cycles; idempotency keys and safe retries; dependency injection by data (the registry hands Synergy a map; Synergy imports no feature).

**Coach reads first:** the overview, the mentions decision, [[02-prd/03-features/01-synergy/02.prd.features.synergy.relationships|relationships PRD]], [[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]], [[03-system-design/non-functional/content/centralized-copy|centralized copy]], lesson 4's sandbox packages.

## Handover from lesson 5

Lesson 5 ([[04-phases/03-synergy/00-lessons/lesson-5-outbox/01-walkthrough|walkthrough]], [sidekick#69](https://github.com/mehtapratik/sidekick/pull/69)) left the repo like this:

- **Every write records its events.** `recordEvent(tx, event)` in Synergy's `repository/outbox.ts`, inside the write's transaction, after the change it describes. A new event is a kind added to `OUTBOX_EVENT_KINDS` (the CHECK regenerates with `db:generate`) and its payload added to `OutboxPayloads`; the typecheck fails until both exist. This lesson adds relationship created, updated, cited, uncited, deleted and restored, from the overview's list. Integration tests read the outbox as `postgres` in reader order (`ORDER BY xact_id, id`; see `tests/integration/outbox.test.ts`).
- **Actor columns:** `toActorColumns(actor)` from `repository/actor.ts` on every insert and update, never `actor.id` by hand (in `.set()`, `undefined` leaves the old value). `Actor` lives in `repository/actor.ts`.
- **The ETag is a hash of the response** ([[D271]], `entityETag` in `api/entity.ts`), so the roll-up lesson 7 adds is covered with no change. Handlers share pieces through `api/entity.ts`, never through another handler's file; one handler per file ([[08-ai-coding-harness/architecture-invariants|naming rule]]).
- **Paging:** `GET /entities/:id/versions` pages 20 at a time with an opaque cursor (`api/version-cursor.ts`, `invalid_cursor` for one it didn't make, `PAGE_SIZE + 1` to know there's more). Backlinks are the second paged list: extract the cursor, the `limit + 1` step and a `{ items, nextCursor }` page shape into one helper then, from the two real cases. Each list keeps its own page size.
- **Still open:** creating with an id that already exists answers 500 until this lesson's idempotency keys; the guard's error-code style ([[backlogged-unplanned#B15 — One style for every error response|B15]]).
- **Version 1 is in the log from creation**, so every live entity has at least one `version_log` row.
- **Dev:** migrated through Synergy `0012`.

## Steps

**Good to write yourself:** the cycle-check query (step 4), after the coach explains recursive CTEs.

1. **Relation types.** `relation_types`: `source_key` (identity), `target_key`, kind (reference or association), status, system flag; seeded with the starter vocabulary (`violates` ↔ `violated-by` is an association, `exception-to` ↔ `has-exception` a reference) plus the system rows `untyped` (kind reference, shows no type name) and `superseded-by` (used in lesson 8). Copy keys for their labels go in `packages/foundation/copy`. `GET /api/synergy/relation-types`.
2. **Relationships, solo only.** `relationships` with `role` (only `solo` used now), from, to, optional label, type (NOT NULL, defaulting to `untyped`), the version and revision snapshot of the target, `cited`, `mentioned`, provenance and tombstone columns. Leave room for lesson 8's list columns and lesson 10's anchor columns as the overview describes, or add them there: decided in the lesson. Indexes on `to_id` and `from_id`.
3. **Registration, server half.** `LinkableTypeServer` with `provider`, `type` and `entitlement` (`resolve` arrives in 3b, `addAnchor` in lesson 10). The sandbox packages each export one; the registry collects them into the map Synergy receives. Synergy never imports a provider.
4. **The cycle check.** A recursive CTE over live references with the `CYCLE` clause, run under the user lock on every reference create or retype. Associations may cycle.
5. **Routes.** `POST /api/synergy/links` (cited link; idempotency key; refuses `cycle`, `locked` when the caller lacks the target type's entitlement, `deprecated_vocabulary`, `not_found`), `PATCH /links/:id` (label, type, `cited`; a type change runs the cycle check when the new type is a reference, and one from an association to a reference moves the snapshot to the target's current version and revision), `DELETE /links/:id` (tombstone; a link with neither `cited` nor `mentioned` is gone), `GET /entities/:id/links?direction=out|in`, with an optional `type` filter, and each link's state (`unknown`, `locked`, `deleted`) decided from the index and the registry. Each write emits its outbox events.
6. **Prove it.** Integration tests: a note links to a task with a label and a type; a retried create with the same idempotency key returns the same link; a reference cycle is refused and an association cycle isn't; revoking `sandbox-tasks` makes the note-to-task link `locked` while the note stays readable, and refuses a new one; the locked link's response carries name, type and status but no content; backlinks (`direction=in`) page correctly; a deprecated type is refused; retyping a `violates` link to `exception-to` keeps its id and moves its snapshot to the target's current version, and is refused with `cycle` when the reference would close a loop; `type=violates` returns only violations; another user's ids are `not_found`.

**Exit check:** step 6 green in CI. Proves the exit criteria "a link can carry a label and a type", "reference cycles are rejected" and "disabling a module makes its links locked".

**Unit-test candidates:** the state decision (unknown, locked, deleted) as a pure function of index row, registry and entitlements.

**Out of scope:** dots and the roll-up (lesson 7), lists and supersede (lesson 8), links from content (lesson 9), anchors (lesson 10), restore (lesson 11), resolved render data (3b).

## Segments

This lesson runs in six segments, each a fresh session, so no session carries the whole lesson's chat (the lessons-mode skill's session economy). The Steps above say what gets built; the segments say in which order and how each piece is checked.

**How to run a segment:**

1. Start a fresh session on Pratik's Mac (Remote Control, folder `~/Projects/sidekick`) with the segment's model, and this prompt: "Run Synergy lesson 6, segment N. Follow lessons mode. Read the lesson 6 brief (Handover from lesson 5, segment N, and the Handover of every earlier segment) and only the files segment N lists."
2. Settle the segment's **Decide first** items with Pratik before the first step. Each one has a recommendation.
3. Coach the steps one at a time. Run tests with `--output-logs=errors-only` and show only failures; show diffs, not whole files.
4. When **Verify** passes, Pratik commits and pushes to `feat/synergy/links`. The coach then fills in the segment's **Handover** in this file, in the same commit or the next one, and ends the session.

All commands run from the repo root, `~/Projects/sidekick`. One branch for the lesson, `feat/synergy/links`, created from `main` in segment 1 after this plan merges; one code PR, opened in segment 6. The close-out (walkthrough, notes, plan ✅, Handover in lesson 7's brief, live docs) is its own session after the PR merges, and reads the merged code and the Handovers below, not the segment chats.

**Models:** Sonnet 5.5 at medium effort, except segment 4 (cycle check and idempotency) at high effort. Move one segment to Opus only when a design question stalls it, never the whole lesson.

### Segment 1: Relation types

**Model:** Sonnet 5.5, medium. **Brief step:** 1.

**Goal:** the seeded vocabulary every link's type points at, and `GET /api/synergy/relation-types`.

**Decide first:**

- **The words for the labels.** The brief puts them in `packages/foundation/copy`; [[D201]] puts them in Synergy's own catalog, and lessons I1 and I2 replace `@sidekick/copy` with catalogs. Recommended: store and return keys only now, and add the words when I1 creates Synergy's catalog. Nothing in 3a draws a relation type's name.
- **No `user_id`.** The vocabulary is the same for every user, and user-defined types are post-MVP. Recommended: a global table that `app_runtime` may only read (RLS forced, a `SELECT` policy `USING (true)`, no write grants), with rows only from migrations. Delete model: hard delete (a type is deprecated by status, never deleted).
- **Symmetric types** (`related-to`, `contradicts`) have no inverse name. Recommended: `target_key` equals `source_key`.

**Steps:**

1. Create the branch: `git switch main && git pull && git switch -c feat/synergy/links`. Run the baseline `pnpm test:integration --output-logs=errors-only` and record each package's count in the Handover.
2. Schema `packages/platform/synergy/src/db/schema/relation-types.ts`, exported from `src/db/schema/index.ts`: `source_key` (text, primary key), `target_key` (text, not null), `kind` (text, CHECK `reference` or `association`), `status` (text, CHECK `active` or `deprecated`, default `active`), `is_system` (boolean, default false), `created_at`, `updated_at`.
3. `pnpm db:generate` writes `0013_*.sql` in `packages/platform/synergy/src/db/migrations/` with its snapshot and journal entry (the three move together). Append to the `.sql`: the grants and policy from "Decide first", and the seed `INSERT` of 13 rows. References: `derived-from` ↔ `source-of`, `cites` ↔ `cited-by`, `supported-by` ↔ `evidence-for`, `explained-by` ↔ `explains`, `exception-to` ↔ `has-exception`. Associations: `inspired-by` ↔ `inspiration-for`, `next` ↔ `previous`, `related-to`, `contradicts`, `defined-by` ↔ `defines`, `violates` ↔ `violated-by`. System references: `untyped`, `superseded-by` ↔ `supersedes` ([[02-prd/03-features/01-synergy/02.prd.features.synergy.relationships|relationships PRD]], starter vocabulary).
4. `pnpm db:migrate` (dev DB).
5. Contract `packages/platform/synergy/src/contracts/relation-type.ts` (`RelationType`, `RELATION_KIND`), exported from `src/contracts/index.ts`.
6. Repository `packages/platform/synergy/src/repository/relation-types.ts`: `listRelationTypes(tx)` and `getRelationType(tx, sourceKey)` (segment 4 uses it).
7. Handler `packages/platform/synergy/src/api/list-relation-types.ts`, exported from `src/server.ts`. Route `apps/app/src/app/api/synergy/relation-types/route.ts`: `export const GET = withApiGuard(listRelationTypes);`.
8. Add `relation_types: 'hard delete'` to `TABLES` in `packages/foundation/core/tests/integration/catalog.test.ts`.
9. Test `packages/platform/synergy/tests/integration/relation-types.test.ts`: the route returns the 13 types with their kinds, `untyped` and `superseded-by` are system rows, and an `INSERT` as `app_runtime` fails.

**Verify:**

- `pnpm turbo typecheck lint test --filter=@sidekick/synergy --filter=@sidekick/core --output-logs=errors-only`: passes.
- `pnpm test:integration --output-logs=errors-only`: passes; Synergy and core each go up by the new tests only.
- `pnpm prettier:check`: passes.

**Handover:**

_Filled by the segment session: what was built (files, commit), departures from this plan, Pratik's questions with a one-line answer each, test counts, open items._

### Segment 2: The relationships table and its events

**Model:** Sonnet 5.5, medium. **Brief step:** 2, and the outbox kinds from the Handover from lesson 5.

**Goal:** the `relationships` table for solo links, with its RLS, triggers and indexes, and the outbox kinds its writes will record.

**Decide first:**

- **Lesson 8's list columns and lesson 10's anchor columns: now or later?** Recommended: later. Each lesson's migration adds the columns it writes and tests; a column with no writer is a foundation with no near-term use. Adding nullable columns to this table later is cheap.
- **`relationship_restored`:** the Handover from lesson 5 lists it, but nothing writes it until lesson 11. Recommended: add it in lesson 11, with its writer.

**Steps:**

1. Schema `packages/platform/synergy/src/db/schema/relationships.ts`, exported from `src/db/schema/index.ts`: `id` (uuid, client-generated), `user_id`, `role` (text, CHECK `solo`; lesson 8 widens it), `from_id` and `to_id` (FK `entity_index(id)`), `label` (nullable), `type` (not null, default `untyped`, FK `relation_types(source_key)`), `to_version` and `to_revision` (the snapshot), `cited` and `mentioned` (boolean), the provenance columns from `columns.ts`, `deleted_at`, `deletion_batch_id`, `created_at`, `updated_at`. A CHECK that a live row is `cited` or `mentioned`. Indexes on `to_id`, `from_id` and `(user_id, type)`.
2. In `packages/platform/synergy/src/repository/outbox.ts`, add `relationship_created`, `relationship_updated`, `relationship_cited`, `relationship_uncited` and `relationship_deleted` to `OUTBOX_EVENT_KINDS`, and their payloads to `OutboxPayloads`.
3. `pnpm db:generate` writes `0014_*.sql` (the table and the regenerated outbox CHECK). Append: own-rows RLS forced, the soft-delete trigger and the restore-aware update trigger, as `entity_index` has them (migrations `0002`, `0003`, `0005`).
4. `pnpm db:migrate`.
5. Add `relationships: 'tombstones visible'` to `TABLES` in `packages/foundation/core/tests/integration/catalog.test.ts`.

**Verify:**

- `pnpm turbo typecheck lint test --filter=@sidekick/synergy --filter=@sidekick/core --output-logs=errors-only`: passes.
- `pnpm test:integration --output-logs=errors-only`: passes; the catalog test now covers `relationships`. The table's behaviour is proven through the routes in segments 4 to 6.

**Handover:**

_Filled by the segment session: what was built (files, commit), departures from this plan, Pratik's questions with a one-line answer each, test counts, open items._

### Segment 3: Registration (server half) and link state

**Model:** Sonnet 5.5, medium. **Brief step:** 3, and the unit-test candidate.

**Goal:** Synergy receives a map of linkable types as data and decides a link's state from it, without importing a provider ([[D200]]).

**Decide first:**

- **State precedence.** Recommended: `unknown` (no registration for the target's provider and type), then `locked` (the caller lacks the type's entitlement), then `deleted`. A locked target must not reveal whether it was deleted.

**Steps:**

1. `LinkableTypeServer` (`provider`, `type`, `entitlement`; `resolve` in 3b, `addAnchor` in lesson 10) and `LinkableTypes` (a `ReadonlyMap` keyed by provider and type) in `packages/platform/synergy/src/linkable-type.ts`, exported from `src/server.ts`.
2. `packages/features/_sandbox/notes/src/server.ts` exports `LINKABLE_TYPES` with one entry (`FEATURE_KEY`, `ENTITY_TYPE.NOTE`, entitlement `FEATURE_KEY`); the same in `packages/features/_sandbox/tasks/src/server.ts` for tasks.
3. `packages/features-registry/src/server.ts` (`import 'server-only'`) builds the map from both and throws on a duplicate key; add `"./server": "./src/server.ts"` to `packages/features-registry/package.json` exports. Test `packages/features-registry/src/server.test.ts`: one entry per sandbox type.
4. Export `getEnabledFeatures` from `@sidekick/core` (a `./features` entry in `packages/foundation/core/package.json`), so a Synergy handler can read the caller's entitlements.
5. Pure function `packages/platform/synergy/src/api/link-state.ts`: the state from the target's index row (or none), the map and the enabled features. Unit test `packages/platform/synergy/src/api/link-state.test.ts`, one case per state and one per precedence rule.

**Verify:**

- `pnpm turbo typecheck lint test --filter=@sidekick/synergy --filter=@sidekick/features-registry --filter=@sidekick/sandbox-notes --filter=@sidekick/sandbox-tasks --filter=@sidekick/core --output-logs=errors-only`: passes, with the new unit tests.
- `pnpm lint`: the boundaries rule accepts every new import (Synergy imports no provider; the registry imports the sandboxes).

**Handover:**

_Filled by the segment session: what was built (files, commit), departures from this plan, Pratik's questions with a one-line answer each, test counts, open items._

### Segment 4: The cycle check and creating links

**Model:** Sonnet 5.5, high. **Brief steps:** 4 and `POST /links` from 5. **Pratik writes** the cycle-check query, after the coach explains recursive CTEs and the `CYCLE` clause.

**Goal:** `POST /api/synergy/links` creates a cited link, refuses a reference that would close a loop, and is safe to retry.

**Decide first:**

- **Idempotency.** Recommended: an optional `Idempotency-Key` header. Table `idempotency_keys`: `user_id`, `key`, request hash, response status and body, `created_at`; primary key `(user_id, key)`. The same key with the same body replays the stored response; the same key with another body answers 422 `idempotency_key_reused`. Expiry and pruning wait for the first pruning job (an open item).
- **Error statuses.** Recommended: `cycle` 409, `locked` 403, `deprecated_vocabulary` 422, `idempotency_key_reused` 422.
- **Sandbox creates** still answer 500 on a repeated id. Recommended: out of scope (not in this lesson's exit check); record it as an open item for the close-out.

**Steps:**

1. Explain recursive CTEs and `CYCLE`; Pratik writes `packages/platform/synergy/src/repository/cycle-check.ts`: does a path of live references already lead from the new link's target back to its source? Only kind `reference` edges are walked; associations may cycle.
2. Schema `packages/platform/synergy/src/db/schema/idempotency-keys.ts`; `pnpm db:generate` writes `0015_*.sql`; append own-rows RLS forced, no soft-delete triggers; `pnpm db:migrate`. Add `idempotency_keys: 'hard delete'` to the catalog test's `TABLES`.
3. `packages/platform/synergy/src/repository/idempotency.ts`: find a stored response, save one.
4. Error codes and statuses in `packages/platform/synergy/src/contracts/errors.ts`. Contract `packages/platform/synergy/src/contracts/link.ts`: the link response and the create request schema (`id`, `fromId`, `toId`, optional `type` and `label`).
5. `packages/platform/synergy/src/repository/relationships.ts`, `createRelationship` inside `withUserLock`: both ends live and owned (`not_found`), the type exists and is active (`deprecated_vocabulary`), the cycle check for a reference (`cycle`), snapshot the target's version and revision, insert with `cited = true`, `recordEvent` `relationship_created`.
6. Handler `packages/platform/synergy/src/api/create-link.ts`: `createLink(linkableTypes)` returns the route handler; it refuses `locked` from the target's registration and the caller's entitlements, replays or stores the idempotent response, and answers 201. Export it from `src/server.ts`.
7. Route `apps/app/src/app/api/synergy/links/route.ts`: `export const POST = withApiGuard(createLink(LINKABLE_TYPES), { lockUser: true });`, with the map from `@sidekick/features-registry/server`.
8. Test `packages/platform/synergy/tests/integration/create-link.test.ts`: a note links to a task with a label and a type; a retry with the same key returns the same link and writes one row and one event; another body with that key is 422; a reference cycle is `cycle`, an association cycle is created; a deprecated type (set by the admin client) is `deprecated_vocabulary`; without `sandbox-tasks` the link to a task is `locked`; another user's ids are `not_found`.

**Verify:**

- `pnpm turbo typecheck lint test --filter=@sidekick/synergy --output-logs=errors-only`: passes.
- `pnpm test:integration --output-logs=errors-only`: passes, with the new `create-link` tests.

**Handover:**

_Filled by the segment session: what was built (files, commit), departures from this plan, Pratik's questions with a one-line answer each, test counts, open items._

### Segment 5: Changing and deleting links

**Model:** Sonnet 5.5, medium. **Brief step:** 5, `PATCH` and `DELETE`.

**Goal:** a link's label, type and `cited` change in place, a retype is checked like a create, and a delete leaves a tombstone.

**Steps:**

1. In `packages/platform/synergy/src/repository/relationships.ts`, `updateRelationship` inside `withUserLock`: a new type must be active; a new reference type runs the cycle check; association to reference moves the snapshot to the target's current version and revision; `cited` false with `mentioned` false tombstones the link. Events: `relationship_updated` (label or type), `relationship_cited`, `relationship_uncited`, `relationship_deleted`.
2. `deleteRelationship` in the same file: tombstone with a new `deletion_batch_id`, `relationship_deleted`.
3. Handlers `packages/platform/synergy/src/api/update-link.ts` and `packages/platform/synergy/src/api/delete-link.ts`, exported from `src/server.ts`; the update request schema goes in `src/contracts/link.ts`.
4. Route `apps/app/src/app/api/synergy/links/[id]/route.ts`: `PATCH` and `DELETE`, both `{ lockUser: true }`.
5. Tests `packages/platform/synergy/tests/integration/update-link.test.ts` and `delete-link.test.ts`: retyping `violates` to `exception-to` keeps the id and moves the snapshot to the target's current version; the same retype is `cycle` when the reference would close a loop; a deprecated new type is refused; uncite of a cited-only link tombstones it; delete tombstones and records the event; another user's link is `not_found`.

**Verify:**

- `pnpm turbo typecheck lint test --filter=@sidekick/synergy --output-logs=errors-only`: passes.
- `pnpm test:integration --output-logs=errors-only`: passes, with the new tests.

**Handover:**

_Filled by the segment session: what was built (files, commit), departures from this plan, Pratik's questions with a one-line answer each, test counts, open items._

### Segment 6: Listing links, and the exit check

**Model:** Sonnet 5.5, medium. **Brief steps:** 5, `GET /entities/:id/links`, and 6.

**Goal:** an entity's links in either direction, filtered by type and paged, each with its state; then the whole step 6 list green in CI.

**Steps:**

1. Extract the paging pieces from `packages/platform/synergy/src/api/version-cursor.ts` (the opaque cursor, the `limit + 1` read, the `{ items, nextCursor }` page) into `packages/platform/synergy/src/api/paging.ts`, and move `list-versions.ts` onto it. Each list keeps its own page size. The versions tests stay green unchanged.
2. `listEntityLinks` in `packages/platform/synergy/src/repository/relationships.ts`: live links by `from_id` (`out`) or `to_id` (`in`), with an optional `type`, joined to the other end's index row.
3. Handler `packages/platform/synergy/src/api/list-entity-links.ts`: `listEntityLinks(linkableTypes)`; each link gets its state from `link-state.ts`. A locked link carries name, type and status, and no content. Export it from `src/server.ts`.
4. Route `apps/app/src/app/api/synergy/entities/[id]/links/route.ts`: `GET`.
5. Test `packages/platform/synergy/tests/integration/list-entity-links.test.ts`: `direction=in` pages backlinks correctly; `type=violates` returns only violations; revoking `sandbox-tasks` makes the note-to-task link `locked` while the note stays readable; a deleted target shows `deleted`; another user's entity is `not_found`.
6. Walk the brief's step 6 list and name the test that proves each line; write any line still missing.
7. Pratik opens the PR from `feat/synergy/links` (title `feat(synergy): links, relation types and cycle check`).

**Verify:**

- `pnpm turbo typecheck lint test --force --output-logs=errors-only` and `pnpm test:integration --output-logs=errors-only`: pass.
- CI green on the PR: the lesson's exit check.

**Handover:**

_Filled by the segment session: what was built (files, commit, PR), departures from this plan, Pratik's questions with a one-line answer each, test counts, open items. The close-out session starts from here._
