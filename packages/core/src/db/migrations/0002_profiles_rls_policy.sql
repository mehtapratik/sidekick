-- Ensure RLS is on (idempotent — safe to run even if already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- FORCE means the policy applies even to the table owner role.
-- Belt-and-suspenders: if app_runtime ever gained table ownership,
-- it would still be restricted.
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

-- Drop first so this migration is safe to re-run
DROP POLICY IF EXISTS "users_own_profile" ON profiles;

-- A user can only read or write their own profile row.
-- USING controls which rows are visible on SELECT/UPDATE/DELETE.
-- WITH CHECK controls which rows can be written on INSERT/UPDATE.
CREATE POLICY "users_own_profile"
  ON profiles
  FOR ALL
  USING  (id::text = current_setting('app.current_user_id', true))
  WITH CHECK (id::text = current_setting('app.current_user_id', true));
