-- anon and authenticated are the roles Supabase's Data API (PostgREST) runs requests as:
-- anon without a login, authenticated with a signed-in user's token. Both are reachable
-- with the public key the browser holds. Supabase's default privileges grant them every
-- privilege, TRUNCATE included, on each table postgres creates in public.
--
-- Sidekick never uses the Data API: user queries run as app_runtime through withRLS, and
-- privileged writes run as postgres. RLS already gives these roles zero rows, but TRUNCATE
-- ignores RLS, and a policy mistake would expose data. Revoke them so grants are a second wall.
-- service_role keeps its grants: the server-only admin client uses it.

-- Existing tables (profiles, user_feature_entitlements)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- Functions are executable by PUBLIC (every role) by default, so revoking from anon and
-- authenticated alone would change nothing. Triggers don't need EXECUTE to fire, and nothing
-- calls these functions directly, so revoke from PUBLIC too.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Tables, sequences and functions postgres creates from now on. Default privileges are kept
-- per creating role; migrations run as postgres, so this covers everything we create.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
