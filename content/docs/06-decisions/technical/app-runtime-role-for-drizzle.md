---
publish: true
id: decision.technical.app-runtime-role-for-drizzle
created: 2026-09-19
kind: decision
version: 1.0.0
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

Role creation is a **one-time manual step** performed in the Supabase SQL Editor — it is not in any migration file. The reason: the `CREATE ROLE` statement includes a password, and the repository is public. Credentials must never enter version control.

```sql
-- Run once in Supabase SQL Editor only — never commit
CREATE ROLE app_runtime WITH LOGIN PASSWORD 'your-strong-password';
```

GRANT statements and default privileges are in migration (safe to commit — no secrets):

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
-- Role exists
SELECT rolname, rolcanlogin
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

Non-superuser roles require explicit privilege grants. `ALTER DEFAULT PRIVILEGES` eliminates the per-table maintenance burden for future tables, but the initial role creation and `GRANT` on existing tables is a one-time manual step that lives outside of the automated migration flow. This is documented here as the single source of truth for that step.
