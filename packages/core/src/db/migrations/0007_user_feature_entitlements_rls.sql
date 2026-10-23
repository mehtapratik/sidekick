-- Ensure RLS is on (idempotent — safe to run even if already enabled)
ALTER TABLE public.user_feature_entitlements ENABLE ROW LEVEL SECURITY;

-- FORCE means the policy applies even to the table owner role.
ALTER TABLE public.user_feature_entitlements FORCE ROW LEVEL SECURITY;

-- Revoke mutations by app_runtime role on this table
-- By default, all tables on `public` schema get CRUD permissions
-- Blocking mutations here since users must never grant themselves features
REVOKE UPDATE, INSERT, DELETE ON public.user_feature_entitlements FROM app_runtime;

-- Drop the policy if already exists before creating to allow migration re-runs
DROP POLICY IF EXISTS "users_read_own_entitlements" ON public.user_feature_entitlements;

-- A user can only read their own entitlements.
CREATE POLICY "users_read_own_entitlements"
  ON public.user_feature_entitlements
  FOR SELECT
  USING  (user_id::text = current_setting('app.current_user_id', true));
