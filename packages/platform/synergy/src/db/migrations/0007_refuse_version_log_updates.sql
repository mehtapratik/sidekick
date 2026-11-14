-- version_log is append-only (0006): a row records one version bump and is
-- never changed. Swap the restore-aware trigger for one that refuses every
-- update; enforce_soft_delete stays, so only erasure deletes a row.

-- The restore-aware trigger reads deleted_at, which 0006 dropped.
DROP TRIGGER no_update_deleted_version_log ON version_log;

-- Synergy's own function, for every append-only table it will have.
CREATE FUNCTION synergy_refuse_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'Rows in % are append-only (id: %). Record a new row instead.',
        TG_TABLE_NAME, OLD.id;
END;
$$;

CREATE TRIGGER no_update_version_log
   BEFORE UPDATE ON version_log
   FOR EACH ROW EXECUTE FUNCTION synergy_refuse_update();

-- A second wall: the app's role can't even try. A cascade from a deleted
-- entity or profile still works, because referential actions run as the
-- table's owner.
REVOKE UPDATE, DELETE ON version_log FROM app_runtime;
