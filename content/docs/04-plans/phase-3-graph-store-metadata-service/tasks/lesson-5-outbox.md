---
publish: true
id: plan.phase-3.lesson-5-outbox
title: "Phase 3 Lesson 5: Outbox, Status and Versions"
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
   - postgresql
status: planned
---

> **Lesson 5 of 13 in Phase 3a.** Before this: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-4-sandbox-providers|lesson 4]]. Next: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-6-links|lesson 6]]. The coach follows the plan's [[04-plans/phase-3-graph-store-metadata-service#How we build|how we build]].

**What gets built:** the `outbox` table, written in the same transaction as every Synergy write, so a later reader (notifications, search indexing, push) never misses or invents an event. The entity writes from lessons 3 and 4 start writing their events. Also two small routes: `PATCH /entities/:id/status` (deprecate and back) and `GET /entities/:id/versions`.

**Implements:** the overview's outbox ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]], Tables), [[06-decisions/technical/synergy-store-choices|Synergy store choices]].

**Learning payoff:** the outbox pattern (why "write the row, then publish" loses events and "publish in the same transaction" doesn't); why a `bigserial` id isn't commit order and `pg_current_xact_id()` is; a non-syncable, hard-delete table with no soft-delete triggers; a read-only role outside RLS for readers that work across users; cursor paging.

**Coach reads first:** the store-choices decision, the overview's event list, [[03-system-design/non-functional/database/non-syncable-tables|non-syncable tables]], lesson 3's delete-model guide, `packages/foundation/core/src/db/migrations/0001_app_runtime_grants.sql`.

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
