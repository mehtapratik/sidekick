---
title: Phase 1.1 Walkthrough
---

# Phase 1.1 Walkthrough — Database Security Hardening

This guide walks through Phase 1.1 step by step. It assumes you have completed Phase 1: Supabase is connected, the `profiles` table exists, Drizzle migrations are working, and the basic RLS policy was created via the Supabase dashboard.

Every step explains what you are doing and why. Follow the reasoning, not just the commands.

---

## Background — The Gap Phase 1.1 Addresses

After Phase 1, security enforcement existed at the application layer but not the database layer. Three concrete problems:

1. **Drizzle connected as the Postgres superuser.** Superusers bypass all Row Level Security — every Drizzle query ran with unrestricted access, regardless of what RLS policies were defined.
2. **`withRLS` set a session variable outside a real transaction.** `set_config` with `is_local = true` only scopes to the current *transaction*. Called outside a transaction block, there is no scope guarantee — the variable could persist across pooled connections and leak one user's ID into another user's request.
3. **No database-level enforcement for soft deletes.** Hard deletes and updates on soft-deleted rows were blocked only by convention, not by the database. The service role (`createAdminClient()`) would bypass any RLS-based protection entirely.

Phase 1.1 closes all three gaps.

---

## Task 1.1.1 — Understand Why Superuser Bypasses RLS

> **What and why:** Before making changes, understand what you are fixing. This mental model will make every subsequent step obvious.

Postgres has three privilege layers:

1. **Superusers** (`postgres` role, Supabase service role) — bypass *everything*: RLS policies, triggers that use `SECURITY DEFINER`, ownership checks. No exceptions.
2. **Table owners** — bypass RLS by default, but you can force it with `ALTER TABLE t FORCE ROW LEVEL SECURITY`.
3. **Regular (non-superuser) roles** — RLS is fully enforced.

Drizzle's `DATABASE_URL` in Phase 1 pointed to the Supabase pooler using the `postgres` superuser credentials. This means every query Drizzle ran was invisible to RLS — as if RLS did not exist.

The fix: create a non-superuser role (`app_runtime`) and switch `DATABASE_URL` to connect as that role. Once Drizzle connects as a regular role, all RLS policies are enforced for every runtime query.

> **Why not just rely on `withRLS` to protect everything?** `withRLS` sets a session variable that RLS *policies* read. If Drizzle connects as a superuser, RLS policies are never evaluated — the session variable is set but never checked. The policy is bypassed entirely. Switching roles is what makes the policy actually run.

> **What about `createAdminClient()` and the service role?** The Supabase service role is also a superuser — it bypasses RLS too. This is intentional for the admin client: it's used for trusted, elevated operations. But this means service role queries must also never be used for operations that should be user-scoped. Phase 1.1 introduces a second layer of enforcement for that: BEFORE triggers, which fire even for superusers.

> **Why can BEFORE triggers fire when RLS cannot?** Triggers are procedural code bound to the table's DDL — they execute as part of the statement execution pipeline. Superuser status bypasses *permission checks and row filtering*, but not the statement execution pipeline itself. Triggers run regardless of who issued the query. This makes them the right mechanism for hard constraints (like prohibiting hard deletes) that must hold even for privileged callers.

---

## Task 1.1.2 — Create the `app_runtime` PostgreSQL Role

> **What and why:** `app_runtime` is a non-superuser role that Drizzle will use for all runtime queries. Creating the role is a **one-time manual step in the Supabase SQL Editor** — it must never be in a migration file because it requires a password, and the repository is public. Credentials in version control are a security incident.

Open **Supabase Dashboard → SQL Editor → New query** and run:

```sql
CREATE ROLE app_runtime WITH LOGIN PASSWORD 'choose-a-strong-password-here';
```

Save this password somewhere secure (your password manager). You will need it in Task 1.1.6 when updating `.env.local`.

> **Why not prefix with `public.`?** PostgreSQL roles are cluster-level objects — they are not part of any schema. There is no `public.app_runtime`. The `public.` prefix is for tables and functions that live inside the `public` schema. Roles never take a schema prefix.

> **Why `LOGIN` and `PASSWORD`?** The role needs to be able to open a database connection (`LOGIN`). Without `LOGIN`, the role exists but cannot authenticate. The password is the credential Supabase Supavisor will verify when Drizzle connects. If you forget `LOGIN`, the pooler will refuse the connection.

> **Verification:** After running the statement, confirm the role was created:
> ```sql
> SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'app_runtime';
> ```
> You should see one row with `rolcanlogin = true`.

---

## Task 1.1.3 — Run Migration 0001: Grant Permissions to `app_runtime`

> **What and why:** A role with no grants can connect but cannot touch any tables. `GRANT` statements authorize `app_runtime` to read and write the tables it needs. These statements are safe to commit — they contain no secrets.

Create the file `packages/core/src/db/migrations/0001_app_runtime_grants.sql`:

```sql
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;
```

> **Why `GRANT USAGE ON SCHEMA public`?** Before a role can access any object inside a schema, it must have `USAGE` on the schema itself. Without this, even explicit table grants are ineffective — the role cannot resolve the schema path.

> **Why `ALTER DEFAULT PRIVILEGES`?** `GRANT ... ON ALL TABLES` applies to tables that exist *right now*. Future tables (added by Phase 3+ migrations) would not be covered. `ALTER DEFAULT PRIVILEGES` tells Postgres: for every table created in this schema from this point forward, automatically grant these permissions to `app_runtime`. Without this, every new feature migration would need a manual `GRANT` or the app would get permission denied errors on new tables at runtime.

> **Why sequences?** Auto-incrementing columns and `DEFAULT gen_random_uuid()` calls touch sequences. Without sequence grants, `INSERT` statements on tables with serial or UUID defaults would fail.

Now register this migration in the journal. Open `packages/core/src/db/migrations/meta/_journal.json` and add:

```json
{
  "idx": 1,
  "version": "7",
  "when": 1778377618178,
  "tag": "0001_app_runtime_grants",
  "breakpoints": true
}
```

> **Critical: `when` must be strictly greater than the previous entry.** Drizzle's migration runner orders migrations by `when` timestamp. If your new entry has a `when` value earlier than the `0000` migration's timestamp, Drizzle will silently skip it — it considers the migration already applied. Check `0000`'s `when` value and set yours to `that_value + 1`.

Apply the migration:

```bash
pnpm db:migrate
```

Verify the grants were applied:

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_runtime';
```

You should see rows listing `profiles` (and any other tables) with `SELECT`, `INSERT`, `UPDATE`, `DELETE` privileges.

> **Why not `db:generate` first?** `db:generate` reads your TypeScript schema files and generates SQL migrations from the *difference* between the schema and the current database state. It is for TypeScript-schema-driven changes. This migration contains raw SQL (GRANT statements) that Drizzle's schema introspection has no concept of. Running `db:generate` would be useless at best and harmful at worst — it might generate a conflicting file. Hand-written SQL migrations skip `db:generate` and go straight to `db:migrate`.

---

## Task 1.1.4 — Run Migration 0002: Formalize the Profiles RLS Policy

> **What and why:** The RLS policy from Phase 1 was created via the Supabase dashboard — it exists in the database but not in version control. This migration brings it under version control and upgrades it to the stronger policy pattern for Phase 1.1.

Phase 1's policy only filtered `SELECT` queries (it had no `WITH CHECK` clause). Phase 1.1 upgrades to `FOR ALL` with both `USING` and `WITH CHECK`, covering all statement types. It also adds `FORCE ROW LEVEL SECURITY` so the policy applies even to the table owner.

Create `packages/core/src/db/migrations/0002_profiles_rls_policy.sql`:

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile"
  ON profiles FOR ALL
  USING  (id::text = current_setting('app.current_user_id', true))
  WITH CHECK (id::text = current_setting('app.current_user_id', true));
```

Register it in `_journal.json`:

```json
{
  "idx": 2,
  "version": "7",
  "when": 1778377618179,
  "tag": "0002_profiles_rls_policy",
  "breakpoints": true
}
```

Apply:

```bash
pnpm db:migrate
```

> **Why `FORCE ROW LEVEL SECURITY`?** Without `FORCE`, the table owner (the `postgres` superuser, which runs migrations) can bypass RLS. `FORCE` makes RLS apply to the table owner too. Superusers (the cluster-level `postgres` and Supabase's service role) still bypass it — `FORCE` does not change superuser behavior. But it closes the gap for table-owner bypasses.

> **Why `FOR ALL` instead of separate `FOR SELECT` policies?** `FOR ALL` covers `SELECT`, `INSERT`, `UPDATE`, and `DELETE` in one policy. Using separate policies per statement type adds noise with no benefit when the predicate is identical for all operations.

> **What is `USING` vs `WITH CHECK`?**
> - `USING` is evaluated for existing rows — it filters which rows a query can *see* or *affect* (`SELECT`, `UPDATE`, `DELETE`).
> - `WITH CHECK` is evaluated for new rows — it checks whether the row being *written* is allowed (`INSERT`, `UPDATE`).
>
> Both use the same predicate here: the row's `id` must match the current user's ID.

> **Why does `WITH CHECK` allow `deleted_at IS NOT NULL`?** When restoring a soft-deleted row (setting `deleted_at = NULL`), the write must be allowed. If `WITH CHECK` required `deleted_at IS NULL`, a restore UPDATE would fail. By omitting that condition from `WITH CHECK`, restores are allowed. `USING` still blocks *reading* deleted rows — SELECT won't return them.

---

## Task 1.1.5 — Run Migration 0003: Define Shared Soft-Delete Trigger Functions

> **What and why:** The architecture requires soft deletes on all syncable tables. Two invariants must hold even for the Supabase service role (superuser): (1) hard deletes are prohibited — use `deleted_at` instead; (2) updates on already-soft-deleted rows are prohibited — restore first. BEFORE triggers enforce both invariants for *all callers*, including superusers. The functions are defined once here; Phase 3 feature migrations bind them with `CREATE TRIGGER` per table.

Create `packages/core/src/db/migrations/0003_soft_delete_trigger_fns.sql`:

```sql
CREATE OR REPLACE FUNCTION enforce_soft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_hard_delete', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'Hard deletes are prohibited on %. Use soft delete (set deleted_at).',
      TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION block_update_on_deleted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot update a soft-deleted row in % (id: %). Restore it first.',
      TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN NEW;
END;
$$;
```

Register it in `_journal.json`:

```json
{
  "idx": 3,
  "version": "7",
  "when": 1778377618180,
  "tag": "0003_soft_delete_trigger_fns",
  "breakpoints": true
}
```

Apply:

```bash
pnpm db:migrate
```

> **Why define the functions now instead of in Phase 3?** Function definitions are table-independent. Defining them here means Phase 3 feature migrations only need two lines per table: `CREATE TRIGGER no_hard_delete_notes BEFORE DELETE ON notes FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete()`. If you deferred the function definitions to Phase 3, each feature migration would need to carry the full function body — duplicated across every feature. Shared infrastructure belongs in core.

> **What is `TG_TABLE_NAME`?** It is a special variable available inside PostgreSQL trigger functions. At runtime, it automatically resolves to the name of the table that fired the trigger. This allows one shared function to produce a useful error message regardless of which table it's bound to — no per-table customization needed.

> **What is `app.allow_hard_delete`?** It is the admin escape hatch. For legitimate hard deletes (e.g., a GDPR erasure job), code can run `SET LOCAL app.allow_hard_delete = 'true'` inside a transaction. `SET LOCAL` scopes the setting to the current transaction and automatically clears it when the transaction ends. This is the *only* approved pathway for hard deletes.

> **`IS DISTINCT FROM 'true'` vs `!= 'true'`:** If `app.allow_hard_delete` is not set, `current_setting('app.allow_hard_delete', true)` returns an empty string (not NULL — the `true` second argument suppresses the "setting not set" error). `'' != 'true'` is `true` — correct. But `NULL != 'true'` is `NULL` in Postgres — which is falsy, meaning the trigger would allow the delete. Using `IS DISTINCT FROM` handles both the empty string case and any future NULL case safely.

> **Why BEFORE and not AFTER triggers?** `BEFORE` triggers can cancel the operation by returning `NULL`. `AFTER` triggers run after the row is already changed — they can still raise exceptions (which roll back the transaction), but the pattern is cleaner with `BEFORE` because the intent is to *prevent* the operation, not clean up after it.

---

## Task 1.1.6 — Update `DATABASE_URL` to Connect as `app_runtime`

> **What and why:** Grants are in place. Now switch Drizzle's runtime connection to use `app_runtime` instead of the superuser. This is the step that activates RLS enforcement for all Drizzle queries.

Open `.env.local` at the repo root (this file is gitignored — never commit it). Update `DATABASE_URL` to use `app_runtime` credentials:

```env
DATABASE_URL=postgresql://app_runtime.[project-ref]:[app_runtime-password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Find your pooler host and project ref in **Supabase Dashboard → Project Settings → Database → Connection string (Transaction mode, port 6543)**. The path structure is the same as before — only the username and password change.

Leave `DATABASE_DIRECT_URL` unchanged. It still uses the superuser `postgres` credentials because Drizzle Kit migrations need superuser access to create tables, define policies, and grant permissions.

> **Why the pooler (port 6543) and not the direct connection?** `DATABASE_URL` is used by your running application — serverless route handlers that create many short-lived connections. The pooler (Supabase Supavisor, port 6543) manages connection pooling and prevents exhausting Postgres's connection limit. The direct connection (port 5432) is for migrations, which need a stable, persistent connection for DDL transactions.

> **Why `SET ROLE app_runtime` does not work in the Supabase SQL Editor:** Supabase restricts role switching in the dashboard SQL editor. If you try `SET ROLE app_runtime`, you will get `ERROR 42501: permission denied to set role "app_runtime"`. This is a Supabase security restriction, not a problem with your setup. Use the system catalog queries in Task 1.1.8 to verify the role is configured correctly. True end-to-end verification is the running application.

---

## Task 1.1.7 — Fix `withRLS` to Use a Real Transaction

> **What and why:** Phase 1's `withRLS` called `set_config('app.current_user_id', userId, true)` outside a transaction. The `true` third argument means "local to the current transaction" — but without an explicit transaction, there is no transaction to scope to. The setting persists on the connection indefinitely. In Supabase Supavisor's transaction pooler (port 6543), connections are reused across requests. A leaked `app.current_user_id` from request A can persist when the same connection serves request B — the wrong user ID would be used for RLS filtering.

Open `packages/core/src/db/rls.ts`. The current implementation is:

```ts
export async function withRLS<T>(
  userId: string,
  fn: (db: typeof import('./index').db) => Promise<T>,
): Promise<T> {
  await db.execute(sql`select set_config('app.current_user_id', ${userId}, true)`)
  return await fn(db)
}
```

Replace it with:

```ts
import { sql } from 'drizzle-orm'
import { db } from './'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function withRLS<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`)
    return fn(tx)
  })
}
```

Update call sites to use `tx` instead of `db` inside the callback:

```ts
// Before
const profile = await withRLS(userId, async (db) => {
  return db.select().from(profiles).where(eq(profiles.id, userId))
})

// After — parameter name changes from db to tx; behaviour is identical
const profile = await withRLS(userId, async (tx) => {
  return tx.select().from(profiles).where(eq(profiles.id, userId))
})
```

> **Why does `db.transaction()` fix the scope issue?** `db.transaction()` opens an explicit Postgres transaction. Inside a transaction, `set_config` with `is_local = true` is automatically cleared when the transaction commits or rolls back. The variable scope is now tied to the transaction lifetime, not the connection lifetime. When the transaction ends, the setting is gone — the connection is clean before it returns to the pool.

> **Why the `Tx` type alias?** Drizzle's transaction callback receives a transaction object whose type is not exported directly. The `Parameters<Parameters<typeof db.transaction>[0]>[0]` pattern extracts the type from the function signature itself — it will stay correct if Drizzle's transaction API changes. Explicitly naming it `Tx` makes call sites readable.

> **Does wrapping every query in a transaction add overhead?** Slightly. Postgres begins a transaction for every statement anyway — the overhead of an explicit `BEGIN`/`COMMIT` is minimal compared to the network round-trip. The security guarantee is worth it.

---

## Task 1.1.8 — Clean Up the Stale Dashboard Policy

> **What and why:** Migration 0002 ran `DROP POLICY IF EXISTS "users_own_profile"`. But the original Phase 1 policy was created via the Supabase dashboard under a different name — `"Users can manage their own profile"`. The `DROP` in the migration did not drop it (the name did not match). The `profiles` table now has two policies. Duplicate policies with identical predicates are harmless but confusing. Drop the old one manually.

In the Supabase SQL Editor:

```sql
DROP POLICY "Users can manage their own profile" ON profiles;
```

Verify only one policy remains:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';
```

You should see one row: `users_own_profile`, command `ALL`, with a `qual` and `with_check` value showing the `id::text = current_setting(...)` predicate.

> **Why did the DROP in the migration not catch this?** SQL `DROP POLICY IF EXISTS` matches on the exact policy name. The dashboard names policies differently depending on how you create them. This is a one-time manual cleanup; future policies will be created by migrations from the start and will not have this name mismatch.

> **What does the `qual` column show in `pg_policies`?** `qual` is the `USING` clause — the predicate applied to existing rows. `with_check` is the `WITH CHECK` clause applied to written rows. Both should show `(id)::text = current_setting('app.current_user_id'::text, true)` after this cleanup.

---

## Task 1.1.9 — Verify the Full Setup

> **What and why:** Each component was verified independently. Now confirm the end-to-end chain is working: Drizzle connects as `app_runtime`, RLS filters queries correctly, and the application loads without errors.

### Check role and grants exist

```sql
-- Role exists and can log in
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'app_runtime';

-- Grants applied on profiles
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_runtime' AND table_name = 'profiles';

-- One policy, correct predicate
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';

-- Trigger functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('enforce_soft_delete', 'block_update_on_deleted');
```

### Check the running application

Start the dev server:

```bash
pnpm dev
```

Log in and navigate to the dashboard. If the page loads and you see your data, `app_runtime` has the grants it needs and `withRLS` is setting the session variable correctly inside a transaction.

If you see a database error on load, the most likely cause is the `app_runtime` password in `.env.local` not matching what was set in `CREATE ROLE`. Double-check the credentials.

### What you should now have

| Invariant | Enforcement mechanism |
|---|---|
| User A cannot read User B's data | RLS `USING` clause — enforced for `app_runtime` (non-superuser) |
| User ID cannot leak between pooled connections | `db.transaction()` wrapping — `set_config` is transaction-scoped |
| Hard deletes are prohibited on syncable tables | BEFORE DELETE trigger (fires for all roles including superuser) |
| Updates on soft-deleted rows are prohibited | BEFORE UPDATE trigger (fires for all roles including superuser) |
| Future tables automatically accessible to `app_runtime` | `ALTER DEFAULT PRIVILEGES` in migration 0001 |

---

## What Changed in `packages/core`

| File | Change |
|---|---|
| `src/db/rls.ts` | Wrapped `set_config` in `db.transaction()` to properly scope the session variable |
| `src/db/migrations/0001_app_runtime_grants.sql` | New: GRANT statements for `app_runtime` on existing and future tables |
| `src/db/migrations/0002_profiles_rls_policy.sql` | New: `FORCE ROW LEVEL SECURITY` + formalised `FOR ALL` policy with `WITH CHECK` |
| `src/db/migrations/0003_soft_delete_trigger_fns.sql` | New: shared trigger functions for hard-delete prevention and update-on-deleted prevention |
| `src/db/migrations/meta/_journal.json` | Three new entries (idx 1, 2, 3) with strictly increasing `when` timestamps |

`.env.local` (gitignored, not committed):

| Variable | Change |
|---|---|
| `DATABASE_URL` | Now uses `app_runtime` credentials (non-superuser) instead of the `postgres` superuser |
| `DATABASE_DIRECT_URL` | Unchanged — migrations still use the superuser |

---

## Going Further

**Binding triggers to feature tables (Phase 3):** When Phase 3 introduces `notes` and other syncable tables, each feature migration needs two `CREATE TRIGGER` lines:

```sql
CREATE TRIGGER no_hard_delete_notes
  BEFORE DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

CREATE TRIGGER no_update_deleted_notes
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();
```

The trigger functions are already defined — you are just binding them to new tables.

**Legitimate hard deletes (GDPR erasure, B1):** If you ever need to hard-delete rows (e.g. a compliance erasure job), the only approved pathway is:

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL app.allow_hard_delete = 'true'`)
  await tx.delete(notes).where(eq(notes.userId, userId))
})
```

`SET LOCAL` scopes the permission to the transaction. When the transaction commits, the setting clears automatically. Never use `SET` (session-scoped) for this.
