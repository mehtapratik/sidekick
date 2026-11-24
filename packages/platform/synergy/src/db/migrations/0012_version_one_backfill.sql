-- From Synergy lesson 5, registerEntity logs version 1, so an entity's history
-- starts at its creation. Entities created before that have no version 1 row:
-- add one, dated at the entity's creation. Their creator wasn't recorded
-- (entity_index keeps only the last writer), so the row says the system wrote
-- it, and why. Runs as the migration role, which bypasses RLS.
INSERT INTO 
    version_log 
        (user_id, entity_id, version, created_at, actor_kind, actor_id, reason)
    SELECT 
        ei.user_id, ei.id, 1, ei.created_at, 'system', NULL, 'backfill: version 1 (Synergy lesson 5)'
    FROM 
        entity_index ei
    WHERE NOT EXISTS (
        SELECT 1 FROM version_log vl WHERE vl.entity_id = ei.id AND vl.version = 1
    );
