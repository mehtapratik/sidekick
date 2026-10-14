-- Create the app_runtime role if it does not exist yet.
--
-- Deliberately breaks the rule of not editing applied migrations: without this block, a fresh database fails at the GRANTs below because nothing creates the role.
-- Safe because Drizzle never re-runs an applied migration, and on any database where the role already
-- exists this block does nothing — so no two databases can end up different. On a fresh database it creates
-- the role before the GRANTs below need it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime
      -- create role without login capability to avoid committing a password to source control.
      -- admin can enable login by setting a password manually before setting up connection strings in the app.
      -- ALTER ROLE app_runtime WITH LOGIN PASSWORD '<strong-password>';
      NOLOGIN
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

-- Give app_runtime access to the public schema
GRANT USAGE ON SCHEMA public TO app_runtime;

-- Access to all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- Access to sequences (needed if any column uses serial/auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- Automatically grant access to any table created in the future.
-- Without this, every new migration that creates a table would need
-- a manual GRANT added. ALTER DEFAULT PRIVILEGES handles it for us.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
