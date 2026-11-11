-- Synergy's version of core's block_update_on_deleted: refuses every update to
-- a soft-deleted row "EXCEPT" the one that restores it (deleted_at back to NULL).
-- Lesson 3 binds it to Synergy's tables with:
--   CREATE TRIGGER no_update_deleted_[table]
--     BEFORE UPDATE ON [table]
--     FOR EACH ROW EXECUTE FUNCTION synergy_block_update_on_deleted();
CREATE FUNCTION synergy_block_update_on_deleted() 
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- D66 - Tombstone Visibility -> `AND NEW.deleted_at IS NOT NULL` is 
    -- an exception only applicable to Synergy. This clause will allow 
    -- Synergy to restore deleted rows (links/relationships)
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN 
        RAISE EXCEPTION
            'Cannot update a soft-deleted row in % (id: %). Restore it first.',
            TG_TABLE_NAME, OLD.id;
    END IF;
    RETURN NEW;
END;
$$;
