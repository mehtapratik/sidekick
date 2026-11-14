---
publish: true
id: system-design.non-functional.database.soft-delete-support
title: Soft-Delete Support
created: 2026-09-19
updated: 2026-11-14
kind: spec
version: 2.1.0
tags:
   - system-design
   - database
   - soft-delete
---

Both soft-delete [[03-system-design/non-functional/database/delete-models|delete models]] bind two triggers per table: one that refuses hard deletes, and one that guards updates to a deleted row. The first is the same for both models; the second depends on whether the table restores.

## Refuse hard deletes (both soft models)

Core's `enforce_soft_delete` (core `0003`):

```sql
-- Blocks hard deletes unless explicitly opted in
CREATE OR REPLACE FUNCTION enforce_soft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_hard_delete', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Hard deletes are prohibited on %. Use soft delete (set deleted_at).', TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER no_hard_delete_[table]
  BEFORE DELETE ON [table]
  FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();
```

Erasure opts in with `SET LOCAL app.allow_hard_delete = 'true'`. A delete that cascades from a parent (`ON DELETE CASCADE` from `profiles`) fires this trigger too.

## Tombstones hidden: freeze the row

Core's `block_update_on_deleted` refuses every update to a deleted row (core `0003`, message corrected in `0010`):

```sql
CREATE OR REPLACE FUNCTION block_update_on_deleted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot update a soft-deleted row in % (id: %). This table does not allow restores.',
      TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER no_update_deleted_[table]
  BEFORE UPDATE ON [table]
  FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();
```

Both functions are core's public API: other packages bind them, so a `CREATE OR REPLACE` must keep their behaviour exactly ([[03-system-design/non-functional/database/migration|Migration]]).

## Tombstones visible: allow a strict restore

A table that restores binds a restore-aware function instead. Synergy's is `synergy_block_update_on_deleted` (Synergy `0000`, made strict in `0005`, [[D263]]):

1. an update to a live row passes;
2. an update that leaves the row deleted is refused;
3. a restore (`deleted_at` back to NULL) passes only if nothing but `deleted_at` and the provenance columns (`updated_at`, `actor_kind`, `actor_id`, `reason`) changed. The trigger compares `to_jsonb(NEW)` and `to_jsonb(OLD)` without those columns, so every column added later is protected automatically.

A restore that also edits is two statements in one transaction: restore, then a normal save. Promoting this function into core with an argument (`block_update_on_deleted('allow_restore')`) waits until a second package needs restores.

## Append-only: refuse every update

An append-only table (a log) keeps `enforce_soft_delete` for deletes and binds an update-refusing function instead of either update trigger. Synergy's is `synergy_refuse_update` (Synergy `0007`), bound to `version_log`; the migration also revokes `UPDATE` and `DELETE` from `app_runtime`. See [[03-system-design/non-functional/database/delete-models|Delete models]].
