-- Stand-ins for the Supabase-managed pieces our migrations depend on, so the
-- RLS proof test can run against a throwaway local Postgres. Mirrors what we
-- verified on the live project (2026-10-14): postgres is NOT a superuser but
-- has CREATEROLE and BYPASSRLS; supabase_auth_admin owns auth.users and has
-- neither. Run as the throwaway cluster's superuser, before migrations.

-- Supabase's migration role
CREATE ROLE postgres LOGIN CREATEROLE BYPASSRLS;
ALTER DATABASE postgres OWNER TO postgres;  -- lets it create objects in public

-- Supabase Auth's role and its users table (only the columns we use)
CREATE ROLE supabase_auth_admin LOGIN NOBYPASSRLS;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
ALTER TABLE auth.users OWNER TO supabase_auth_admin;

-- Same rights Supabase gives postgres, so migrations 0004/0005 can add the
-- foreign key and the trigger
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT REFERENCES, TRIGGER ON auth.users TO postgres;

-- The Data API's roles, with the default privileges Supabase gives them on every
-- table, sequence and function postgres creates in public (checked on the live
-- project 2026-10-23). postgres is a member of both there too.
CREATE ROLE anon NOLOGIN NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
GRANT anon, authenticated TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated;
