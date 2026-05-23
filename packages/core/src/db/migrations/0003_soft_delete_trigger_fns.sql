-- Blocks hard deletes unless explicitly opted in via SET LOCAL.
-- Apply to every syncable feature table with:
--   CREATE TRIGGER no_hard_delete_[table]
--     BEFORE DELETE ON [table]
--     FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();
CREATE OR REPLACE FUNCTION enforce_soft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_hard_delete', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'Hard deletes are prohibited on %. Use soft delete (set deleted_at).', TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END;
$$;

-- Blocks updates on already soft-deleted rows.
-- Apply to every syncable feature table with:
--   CREATE TRIGGER no_update_deleted_[table]
--     BEFORE UPDATE ON [table]
--     FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();
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
