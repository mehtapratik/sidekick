---
publish: true
id: plan.phase-3.lesson-5-outbox
title: "Synergy Lesson 5: Outbox, Status and Versions"
created: 2026-11-01
updated: 2026-11-24
kind: plan
version: 1.2.0
tags:
   - plan
   - phase-3
   - task
   - synergy
   - database
   - postgresql
status: completed
---

> **Lesson 5 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-4-sandbox-providers/00-brief|lesson 4]]. Next: [[04-phases/03-synergy/00-lessons/lesson-6-links/00-brief|lesson 6]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** the `outbox` table, written in the same transaction as every Synergy write, so a later reader (notifications, search indexing, push) never misses or invents an event. The entity writes from lessons 3 and 4 start writing their events. Also two small routes: `PATCH /entities/:id/status` (deprecate and back) and `GET /entities/:id/versions`.

**Implements:** the overview's outbox ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]], Tables), [[03-system-design/functional-design/04-synergy/synergy-store-choices|Synergy store choices]].

**Learning payoff:** the outbox pattern (why "write the row, then publish" loses events and "publish in the same transaction" doesn't); why a `bigserial` id isn't commit order and `pg_current_xact_id()` is; a non-syncable, hard-delete table with no soft-delete triggers; a read-only role outside RLS for readers that work across users; cursor paging.

**Coach reads first:** the store-choices decision, the overview's event list, [[03-system-design/non-functional/database/non-syncable-tables|non-syncable tables]], lesson 3's delete-model guide, `packages/foundation/core/src/db/migrations/0001_app_runtime_grants.sql`.

## Handover from lesson 4

Lesson 4 ([[04-phases/03-synergy/00-lessons/lesson-4-sandbox-providers/01-walkthrough|walkthrough]], [sidekick#64](https://github.com/mehtapratik/sidekick/pull/64)) left the repo like this:

- **Writes take the lock first:** `withApiGuard(handler, { feature, lockUser: true })` takes the user's advisory lock right after setting the user, so it always comes before any row lock. `withUserLock` lives in `@sidekick/core/db`; Synergy's repository imports it. Read routes leave `lockUser` out.
- **An error response rolls back (D268):** any handler response of 400 or above undoes the transaction, so a handler's write order doesn't matter for correctness. The outbox rows this lesson writes therefore disappear with a failed request, which is what an outbox needs.
- **Route pattern:** the handler lives in its package's `/server` entry and validates with `parseRequestBody(req, schema)` (a ready 400 `validation_failed`); `apps/app` mounts it in a one-line route file. Synergy's routes go the same way: `readEntity` is in `@sidekick/synergy/server`, mounted at `GET /api/synergy/entities/[id]` with no feature gate. In `apps/app`, only route files may import `/server` entries (D269).
- **Errors:** `errorResponse(code, status)` from `@sidekick/core/api`; statuses by name from `HTTP_STATUS` (`@sidekick/core/http`); Synergy's codes in `SYNERGY_ERROR_CODE` with `SYNERGY_ERROR_STATUS`, turned into responses by `synergyErrorResponse`. A new code goes in both, and the `Record` type fails the typecheck until it has a status.
- **Contracts:** each response has a zod schema and an inferred type (`entitySchema` and `Entity`, with `toEntity` from a row). The versions route's page and the status route's response follow that.
- **Decide in this lesson: the ETag must change when status changes.** Today `ETag: "<content_seq>"`, and a status change won't move `content_seq`, so after `PATCH /entities/:id/status` a client's `If-None-Match` would get 304 with a stale status. HTTP requires an ETag over the whole response; the likely fix is `"<content_seq>.<updated_at>"` (`updated_at` moves on every write), with the client deciding how loudly to say what changed (Pratik, 2026-11-20).
- **Known gap:** creating with an id that already exists answers 500 (a duplicate key). Idempotency keys arrive in lesson 6; the create handlers are where they'll plug in.
- **Not yet consistent:** the guard's own codes are UPPER_CASE with an English `error` field (`{ error: 'Forbidden', code: 'FEATURE_DISABLED' }`), while every other error is `{ code }` in snake_case, and core's codes have no inventory like `SYNERGY_ERROR_CODE`. Decide once, when the client starts reading codes.
- **Tests:** a package's integration tests go through the real guard with `signInAs(userId)` (a mocked `@sidekick/core/supabase/server`, see the sandbox packages' `tests/helpers.ts`). Core's catalog test lists every table with its delete model: the outbox table must be added there (hard delete) and in [[03-system-design/non-functional/database/delete-models|Delete Models]]. A throwaway table in a test must end in `_probe`. Integration tests run only through the root `pnpm test:integration`.
- **Dev:** migrated through the sandbox tables; Pratik's account holds `sandbox-notes` and `sandbox-tasks`.

## Steps

**Good to write yourself:** the consumer role and its grants (step 2).

1. **The table.** `outbox`: event type (a key), subject, actor, payload, time and `xact_id` (`pg_current_xact_id()`), with an index on `xact_id`. Non-syncable: hard delete, no soft-delete triggers, listed in the delete-model guide. `app_runtime` may insert only its own user's events and read none (RLS, a `REVOKE`, or both: decided in the lesson, as in Phase 2 lesson 3).
2. **The consumer role.** A read-only role for future readers, outside RLS. Nothing uses it yet; a test proves it can read and can't write. No pruning job until the first reader (store-choices decision).
3. **Write events.** One helper the repository calls inside each write. Lessons 3 and 4's writes now emit entity created, content saved and version bumped. Every later lesson adds the events for what it builds, from the overview's list.
4. **Status.** `PATCH /api/synergy/entities/:id/status` with `active` or `deprecated` (superseded is set by lesson 8, never by hand). A metadata write: no counter moves. Emits status changed.
5. **Versions.** `GET /api/synergy/entities/:id/versions`, cursor-paged.
6. **Prove it.** Integration tests: each write leaves exactly the expected events, in commit order by `xact_id`; a failed write leaves none; deprecate and reactivate; the version log pages; `app_runtime` can't read the outbox.

**Exit check:** step 6 green in CI.

**Unit-test candidates:** the cursor encoding.

**Out of scope:** any outbox reader, pruning, push to clients (post-MVP).
