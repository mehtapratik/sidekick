-- Restores are strict (lesson 3): an update to a soft-deleted row is allowed only
-- when it restores the row and changes nothing but deleted_at and the bookkeeping
-- columns. A restore that also edits is two statements in one transaction:
-- restore, then a normal save (which runs the content_seq check).
-- Synergy's own function: only Synergy's tables bind it, so replacing it here
-- changes exactly those tables.
CREATE OR REPLACE FUNCTION synergy_block_update_on_deleted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.deleted_at IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot update a soft-deleted row in % (id: %). Restore it first.',
            TG_TABLE_NAME, OLD.id;
    END IF;

    -- The row as JSON, minus the columns a restore may change, must not differ
    IF to_jsonb(NEW) - ARRAY['deleted_at', 'updated_at', 'actor_kind', 'actor_id', 'reason']
        IS DISTINCT FROM
        to_jsonb(OLD) - ARRAY['deleted_at', 'updated_at', 'actor_kind', 'actor_id', 'reason'] THEN
        RAISE EXCEPTION
            'A restore in % (id: %) may change only deleted_at and the provenance columns.',
            TG_TABLE_NAME, OLD.id;
    END IF;

    RETURN NEW;
END;
$$;
