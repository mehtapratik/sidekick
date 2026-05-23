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
