-- The outbox is insert-only for the app (Synergy lesson 5). Two walls:
-- 0008's policy decides WHICH rows app_runtime may insert (its own user's);
-- this REVOKE decides WHICH operations it may run at all. Without the REVOKE,
-- a SELECT would quietly return nothing; with it, the SELECT fails loudly.

-- FORCE: the policy binds the table owner too (see 0003).
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;

-- Readers get their own role (lesson 5, step 2); pruning arrives with the
-- first reader. INSERT stays, from the default privileges in core's 0001.
REVOKE SELECT, UPDATE, DELETE ON outbox FROM app_runtime;
