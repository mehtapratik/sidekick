-- block_update_on_deleted said "Restore it first", but it refuses every update
-- to a soft-deleted row, the restore included (D11). Same behaviour, corrected
-- message. Shared SQL functions are public API: CREATE OR REPLACE changes it for
-- every package that binds it, so the behaviour must stay exactly as it was.
-- Tables that need restores bind their own function (Synergy:
-- synergy_block_update_on_deleted).
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
