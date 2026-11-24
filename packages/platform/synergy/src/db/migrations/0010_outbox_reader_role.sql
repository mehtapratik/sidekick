-- Create the outbox_reader role if it does not exist yet.
-- Outbox readers (notifications, search, push) work across users, so they connect as this role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'outbox_reader') THEN
    CREATE ROLE outbox_reader
      -- create role without login capability to avoid committing a password to source control.
      -- admin can enable login by setting a password manually before setting up connection strings in the app.
      -- ALTER ROLE outbox_reader WITH LOGIN PASSWORD '<strong-password>';
      NOLOGIN
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

-- Give outbox_reader access to the public schema
GRANT USAGE ON SCHEMA public TO outbox_reader;

-- Read-only access to outbox table
GRANT SELECT ON outbox TO outbox_reader;
