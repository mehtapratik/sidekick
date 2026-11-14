---
publish: true
id: system-design.functional-design.04-synergy.tombstone-visibility
title: Tombstone Visibility
created: 2026-10-31
updated: 2026-11-14
kind: spec
version: 1.1.0
tags:
   - system-design
   - synergy
   - rls
status: accepted
---

**D66** `decision` #synergy #soft-delete #rls: Synergy's soft-deleted rows stay visible to Synergy's own queries, and restoring one is allowed. exception-to [[D11]] derived-from [[D112]] derived-from [[D98]]

## What

Synergy's soft-deleted rows (tombstones) stay visible to Synergy's own queries, and restoring one is allowed. Three existing templates are adjusted for Synergy's tables:

- **RLS policies compare only `user_id`.** The [[03-system-design/non-functional/security/row-level-security|row-level security]] template adds `AND deleted_at IS NULL` to `USING`; Synergy's policies don't. The repository, Synergy's only access path, filters `deleted_at IS NULL` in each query that wants live rows.
- **Restoring passes the update trigger.** The [[03-system-design/non-functional/database/soft-delete-support|soft-delete]] template's `block_update_on_deleted` refuses any update to a deleted row. Synergy's version allows exactly one: an update that restores the row (`OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL`) and changes nothing else ([[D263]]). Every other update to a tombstone is still refused.
- **The outbox and idempotency keys are non-syncable tables** with hard delete and no soft-delete triggers, so the 90-day pruning and key expiry work. `enforce_soft_delete` stays on the syncable tables.

## Why

- A deleted target still shows its name and status. Under the template's `USING`, the join from a reference to its target's index row would return nothing, and the link couldn't say "deleted".
- Mentions of a removed relationship show "No longer linked", which must differ from an id that never existed.
- Undo and restore (spec stories, and the restore checks) update a tombstone back to live; under the template both the policy and the trigger would refuse it.
- A restore trigger that recognises the restoring update needs no session flag that every caller has to remember.

## Consequences

- Every repository query states whether it wants live rows; integration tests cover a deleted target, a "No longer linked" mention and undo.
- `row-level-security.md` and `soft-delete-support.md` describe one template per [[03-system-design/non-functional/database/delete-models|delete model]] (lesson 3); this decision's model is tombstones visible.

## Strict restore (Synergy lesson 3)

**D263** `decision` #synergy #soft-delete #restore: A restore changes only `deleted_at` and the provenance columns (`updated_at`, `actor_kind`, `actor_id`, `reason`); `synergy_block_update_on_deleted` refuses a restore that changes anything else. derived-from [[D66]]

- **Why:** a restore that also edited content would skip the save path: no `content_seq` stale check, no counter bump, no version log. A restore brings back exactly what was deleted.
- **How:** the trigger compares `to_jsonb(NEW)` and `to_jsonb(OLD)` without the allowed columns. Listing what may change, not what may not, protects every column added later.
- **Restore and edit** is two statements in one transaction: restore, then a normal save.
- **The design-time guard** is lesson 11's `restoreEntity(tx, id, actor)`, which takes no edit fields; the trigger guards every other writer.

## Decision History

- 2026-10-31 · accepted · Tombstone Visibility
- 2026-11-14 · accepted · Strict restore ([[D263]]), Synergy lesson 3
