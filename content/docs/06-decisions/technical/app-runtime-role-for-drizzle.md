---
publish: true
id: decision.technical.app-runtime-role-for-drizzle
created: 2026-09-19
kind: decision
version: 1.1.0
tags:
   - decision
   - technical
   - architecture-decision
   - rls
   - supabase
   - drizzle
status: accepted
---

Using nonsuperuser role, `app_runtime` makes RLS enforced at the database level for all runtime queries, which is consistent with the architecture's philosophy of [[enforced-conventions]].

## Setup

The role is created by migration `0001_app_runtime_grants.sql`, so every fresh database reproduces the same security boundary. The migration creates it idempotently and **without login**, because a `CREATE ROLE … PASSWORD` statement would put a credential into a public repository:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime
      NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;
```

`NOBYPASSRLS` and `NOSUPERUSER` are the load-bearing attributes; the rest are spelled out so a reviewer does not need to know PostgreSQL defaults.

After `pnpm db:migrate`, enable login **once per database** — out of band, in the Supabase SQL Editor — and put the password only in `DATABASE_URL`:

```sql
-- Run once per database in Supabase SQL Editor only — never commit
ALTER ROLE app_runtime WITH LOGIN PASSWORD 'your-strong-password';
```

Until this step runs, the role holds all its privileges but cannot connect, so a fresh environment fails closed.

The block was added to `0001` after that migration had already been applied. This deliberately breaks the rule against editing applied migrations: Drizzle never re-runs an applied migration, and on any database where the role exists the block is a no-op, so no two databases can diverge. Without it, a fresh database fails at the `GRANT`s because nothing creates the role.

The same migration grants privileges and default privileges (safe to commit — no secrets):

```sql
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
	ON ALL TABLES
	IN SCHEMA public TO app_runtime;

ALTER DEFAULT PRIVILEGES
	IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON
	TABLES TO app_runtime;
```

`ALTER DEFAULT PRIVILEGES` means every new table created by future migrations is automatically accessible to `app_runtime` — no per-table GRANT needed when adding feature packages.

## Verification

`SET ROLE app_runtime` does not work in the Supabase SQL Editor — Supabase restricts role switching in the dashboard. Verify the setup using system catalog queries instead:

```sql
-- Role exists, can log in, and cannot bypass RLS
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname = 'app_runtime';

-- Grants applied
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_runtime';

-- RLS policies exist
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles';
```

**True end-to-end verification:** update `DATABASE_URL` in `.env.local` to `app_runtime` credentials and confirm the running application loads correctly.

## Tradeoff

Non-superuser roles require explicit privilege grants. `ALTER DEFAULT PRIVILEGES` eliminates the per-table maintenance burden for future tables. Role creation and grants are versioned in migrations; the only manual step is enabling login with a password once per database, which is documented here as the single source of truth for that step.
