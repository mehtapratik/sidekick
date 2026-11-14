---
publish: true
id: system-design.non-functional.database.delete-models
title: Delete Models
created: 2026-11-14
updated: 2026-11-14
kind: spec
version: 1.0.0
tags:
   - system-design
   - database
   - soft-delete
   - rls
status: accepted
---

**D264** `decision` #database #soft-delete: Every table chooses one of three delete models (hard delete, soft delete with tombstones hidden, soft delete with tombstones visible), names it in its schema file, and is listed below with its model. derived-from [[D11]] related-to [[D66]]

A delete model says what happens to a row when it is deleted, and who can still see or change it. It decides the table's columns, its row-level security policy and its triggers, so it is chosen when the table is designed, never drifted into (Pratik, 2026-11-01).

## Choosing a model

Ask in order:

1. **Can a deleted row be gone for good?** No offline device needs to learn it was deleted, and nothing undoes the delete. Then **hard delete**.
2. **Otherwise, soft delete.** Does anything need to read a deleted row? An id elsewhere that must say "deleted", a Trash, undo or restore. If not, **tombstones hidden** (the default for syncable tables).
3. **Only if something must read or restore it: tombstones visible.** It costs a repository as the only access path (every query states whether it wants live rows), tests that read a deleted row, and an entry in the table list below with its reason.

## The three models

| Model | On delete | Who sees a deleted row | Restore | RLS policy | Triggers |
| ----- | --------- | ---------------------- | ------- | ---------- | -------- |
| **Hard delete** | The row is removed. | Nobody. | None. | Own rows ([[03-system-design/non-functional/security/row-level-security#Hard delete and tombstones visible|template]]) | None. |
| **Soft delete, tombstones hidden** | `deleted_at` is set. The row stays for sync and is pruned later. | Nobody: every query filters it (D11), and the policy hides it. | None. The row is frozen. | Own live rows ([[03-system-design/non-functional/security/row-level-security#Tombstones hidden|template]]) | `enforce_soft_delete`, `block_update_on_deleted` ([[03-system-design/non-functional/database/soft-delete-support|soft-delete support]]) |
| **Soft delete, tombstones visible** | `deleted_at` is set. | The table's repository, which asks for tombstones explicitly. | Allowed: an update that only clears `deleted_at` (and the provenance columns). | Own rows, no `deleted_at` term ([[03-system-design/non-functional/security/row-level-security#Hard delete and tombstones visible|template]]) | `enforce_soft_delete`, a restore-aware update trigger such as `synergy_block_update_on_deleted` |

A soft-deleted row under either soft model is never hard-deleted by the app. Erasure (account deletion, GDPR) removes it on purpose, with `SET LOCAL app.allow_hard_delete = 'true'`, and that also applies to rows reached through `ON DELETE CASCADE`, which fire the same `BEFORE DELETE` trigger.

## Every table

| Table | Package | Model | Why |
| ----- | ------- | ----- | --- |
| `profiles` | core | Hard delete | Goes with its auth user (`ON DELETE CASCADE`); nothing syncs it offline or restores it. |
| `user_feature_entitlements` | core | Hard delete | Revoking a feature deletes its row; only ops scripts write it. |
| `entity_index` | Synergy | Tombstones visible | A link to a deleted entity still shows its name and status, and lesson 11 restores entities ([[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]]). |
| `version_log` | Synergy | Tombstones visible | Follows its entity; undoing a version bump would tombstone a row and keep its history readable. |

Synergy's later tables join this list in the lessons that add them. The outbox and idempotency keys will be hard delete ([[03-system-design/non-functional/database/non-syncable-tables|non-syncable]]).

## Restores are strict

Under tombstones visible, a restore changes only `deleted_at` and the provenance columns. A restore that also edits is two statements in one transaction: restore, then a normal save ([[D263]]).

## Decision History

- 2026-11-14 · accepted · Delete Models (Synergy lesson 3)
