---
title: Soft delete support
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - database
  - soft-delete
appliesTo: []
isSection: false
docId: system-design.non-functional.database.soft-delete-support
sourcePath: sources/docs/03-system-design/non-functional/database/soft-delete-support.md
wordCount: 148
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Enforce the principle of soft deletion, we will implement two functions and triggers:

`enforce_soft_delete` with BEFORE DELETE trigger:

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

`block_update_on_deleted` with BEFORE UPDATE trigger:

```sql
-- Blocks updates on already soft-deleted rows
CREATE OR REPLACE FUNCTION block_update_on_deleted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot update a soft-deleted row in % (id: %). Restore it first.',
      TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER no_update_deleted_[table]
  BEFORE UPDATE ON [table]
  FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();
```
