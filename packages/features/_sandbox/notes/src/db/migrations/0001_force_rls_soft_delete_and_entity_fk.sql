-- FORCE: the policy binds the table owner too, so RLS holds even if app_runtime
-- ever owned this table. Roles with BYPASSRLS (postgres) still bypass it.
ALTER TABLE sandbox_notes FORCE ROW LEVEL SECURITY;

-- Soft delete only: a DELETE is refused unless its transaction opts in with
-- SET LOCAL app.allow_hard_delete = 'true' (erasure). Core's shared function.
CREATE TRIGGER no_hard_delete_sandbox_notes
   BEFORE DELETE ON sandbox_notes
   FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

-- Tombstones hidden: a deleted note is frozen, and nothing restores it.
-- Core's shared function, which refuses every update to a deleted row.
CREATE TRIGGER no_update_deleted_sandbox_notes
   BEFORE UPDATE ON sandbox_notes
   FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();

-- A note can't exist without its entity_index row. DEFERRABLE INITIALLY
-- DEFERRED: Postgres checks it at commit, not per statement, so the create
-- route may insert the note before registerEntity inserts its index row, as
-- long as both happen in the same transaction.
ALTER TABLE sandbox_notes
   ADD CONSTRAINT sandbox_notes_id_entity_index_id_fk
   FOREIGN KEY (id) REFERENCES entity_index (id)
   DEFERRABLE INITIALLY DEFERRED;
