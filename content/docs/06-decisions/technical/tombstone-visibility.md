---
publish: true
id: decision.technical.tombstone-visibility
created: 2026-10-31
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - synergy
   - rls
status: accepted
applies_to:
   - "[[03-system-design/functional-design/04-synergy/00-overview]]"
   - "[[03-system-design/non-functional/security/row-level-security]]"
   - "[[03-system-design/non-functional/database/soft-delete-support]]"
---

## What

Synergy's soft-deleted rows (tombstones) stay visible to Synergy's own queries, and restoring one is allowed. Three existing templates are adjusted for Synergy's tables:

- **RLS policies compare only `user_id`.** The [[03-system-design/non-functional/security/row-level-security|row-level security]] template adds `AND deleted_at IS NULL` to `USING`; Synergy's policies don't. The repository, Synergy's only access path, filters `deleted_at IS NULL` in each query that wants live rows.
- **Restoring passes the update trigger.** The [[03-system-design/non-functional/database/soft-delete-support|soft-delete]] template's `block_update_on_deleted` refuses any update to a deleted row. Synergy's version allows exactly one: an update that restores the row (`OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL`). Every other update to a tombstone is still refused.
- **The outbox and idempotency keys are non-syncable tables** with hard delete and no soft-delete triggers, so the 90-day pruning and key expiry work. `enforce_soft_delete` stays on the syncable tables.

## Why

- A deleted target still shows its name and status. Under the template's `USING`, the join from a reference to its target's index row would return nothing, and the link couldn't say "deleted".
- Mentions of a removed relationship show "No longer linked", which must differ from an id that never existed.
- Undo and restore (spec stories, and the restore checks) update a tombstone back to live; under the template both the policy and the trigger would refuse it.
- A restore trigger that recognises the restoring update needs no session flag that every caller has to remember.

## Consequences

- Every repository query states whether it wants live rows; integration tests cover a deleted target, a "No longer linked" mention and undo.
- **Follow-up:** `row-level-security.md` and `soft-delete-support.md` still describe the old templates. They need their own revision (a variant for tables whose tombstones must stay readable), outside this decision.
