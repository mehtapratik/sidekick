-- Synergy's tables keep their tombstones visible (D66): 0002's policies compare
-- only user_id, and these triggers hold the soft-delete rules for every writer.

-- FORCE: the policies bind the table owner too. If app_runtime ever owned these
-- tables, RLS would still hold. Roles with BYPASSRLS (postgres, for migrations
-- and ops scripts) still bypass it.
ALTER TABLE entity_index FORCE ROW LEVEL SECURITY;
ALTER TABLE version_log FORCE ROW LEVEL SECURITY;

-- Soft delete only: a DELETE is refused unless its transaction opts in with
-- SET LOCAL app.allow_hard_delete = 'true' (erasure). Core's shared function.
CREATE TRIGGER no_hard_delete_entity_index
   BEFORE DELETE ON entity_index
   FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

CREATE TRIGGER no_hard_delete_version_log
   BEFORE DELETE ON version_log
   FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

-- A tombstone can be restored, but not otherwise updated. Synergy's own
-- function (0000), not core's block_update_on_deleted, which refuses restores.
CREATE TRIGGER no_update_deleted_entity_index
   BEFORE UPDATE ON entity_index
   FOR EACH ROW EXECUTE FUNCTION synergy_block_update_on_deleted();

CREATE TRIGGER no_update_deleted_version_log
   BEFORE UPDATE ON version_log
   FOR EACH ROW EXECUTE FUNCTION synergy_block_update_on_deleted();
