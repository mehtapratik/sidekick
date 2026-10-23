---
publish: true
id: build.phase-2.lesson-3
title: "Phase 2 lesson 3 walkthrough: entitlements"
created: 2026-10-23
updated: 2026-10-23
kind: guidance
version: 1.0.0
tags:
   - build
   - walkthrough
   - phase-2
   - feature-system
   - database
   - drizzle
   - rls
   - postgresql
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-8and2-9]]"
---

# Phase 2 Lesson 3 Walkthrough — Entitlements

This guide reproduces lesson 3 of [[04-plans/phase-2-core-infrastructure-api-guard-feature-system|Phase 2]] step by step: tasks 2.8 and 2.9, which record which features each user has and let the guard read them. It assumes lesson 2 is merged ([[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-2-resolve-api-caller|lesson 2 walkthrough]]) and that the latest migration is `0005`.

The result shipped as [sidekick#15](https://github.com/mehtapratik/sidekick/pull/15). The design is recorded in [[contracts#Entitlements|contracts]] (version 2.4.0).

Every step explains what you are doing and why. Follow the reasoning, not just the commands.

---

## Step 1 — Design the Table

> **What and why:** An entitlement says "user X has feature Y". A present row means enabled; disabling deletes the row. Design the columns from three questions: what identifies an entitlement, can a user have the same feature twice, and what happens when the user is deleted?

1. Branch from an up-to-date `main`:

```bash
git switch main
git pull origin main
git switch -c feature/P2L3-entitlements
```

2. Settle the columns:

| Column        | Type          | Why                                                                                                                       |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `user_id`     | `uuid`        | References `profiles.id`, which is the auth user's id. Named `user_id` because the value is `userId` everywhere else.     |
| `feature_key` | `text`        | A `FeatureManifest.key`. Not a Postgres enum: an enum needs a migration for every new feature, and features live in code. |
| `created_at`  | `timestamptz` | Answers "when did this user get this feature?" during support. Not an audit log.                                          |

- **No duplicates:** a composite primary key on `(user_id, feature_key)`. It forbids the same feature twice and gives the index `getEnabledFeatures` uses, because its leading column is `user_id`. A surrogate `id` would only pay off if something referenced a single row, and nothing does.
- **User deleted:** `ON DELETE CASCADE` to `profiles`. Deleting from `auth.users` cascades to `profiles`, then here. Referencing `profiles` keeps our tables pointing at our tables (`auth.users` belongs to Supabase, which is why `0004` needed a `REFERENCES` grant), and no entitlement can exist without a profile. An entitlement is account state, not a transaction record, so nothing requires keeping it once the user erases their account.
- **No `deleted_at`:** soft delete is for syncable entities that clients create offline. Entitlements aren't one, and a soft-deleted row would make re-enabling an un-delete.

3. Create `packages/core/src/db/schema/user-feature-entitlements.ts`:

```ts
import {
   pgTable,
   primaryKey,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

export const userFeatureEntitlements = pgTable(
   "user_feature_entitlements",
   {
      userId: uuid("user_id")
         .notNull()
         .references(() => profiles.id, { onDelete: "cascade" }),
      featureKey: text("feature_key").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (self) => {
      return [
         primaryKey({
            columns: [self.userId, self.featureKey],
         }),
      ];
   },
);
```

The string passed to `uuid()` is the SQL column name; the object key is only the TypeScript name. A column-level `.primaryKey()` makes that one column the primary key, so two of them would declare two primary keys, which Postgres rejects. The composite key goes in `pgTable`'s third argument, which returns an **array** of constraints (returning the bare `primaryKey(...)` gives a confusing overload error).

4. Export it from `packages/core/src/db/schema/index.ts`. Drizzle Kit reads only that file, so an unexported table produces no migration:

```ts
export * from "./user-feature-entitlements";
```

---

## Step 2 — Generate the Migration

> **What and why:** Drizzle Kit compares the schema with the last snapshot in `migrations/meta/` and writes only the difference. It doesn't connect to the database, but the config still needs `.env.local` to load.

1. Generate it with a readable name:

```bash
pnpm --filter @sidekick/core db:generate --name user_feature_entitlements
```

2. Read `0006_user_feature_entitlements.sql`. The composite key is a named constraint inside `CREATE TABLE`, and the foreign key comes after it as a separate `ALTER TABLE`, because Drizzle always adds foreign keys last so tables can be created in any order. `--> statement-breakpoint` is where Drizzle splits the file into separate statements.

3. Notice what's missing: access control. `0001`'s `ALTER DEFAULT PRIVILEGES` grants `app_runtime` `SELECT`, `INSERT`, `UPDATE` and `DELETE` the moment the table exists, with no RLS on it.

**The journal and snapshot.** `_journal.json` lists migrations in order. `drizzle-kit migrate` records each one it applies in `drizzle.__drizzle_migrations` and on the next run applies only newer entries. An edited migration therefore never re-runs where it was applied, while a fresh database gets the edited version, so the two drift. That's why applied migrations are never edited. `0006_snapshot.json` is the whole schema after this migration, the baseline for the next `generate`.

---

## Step 3 — Lock It Down

> **What and why:** Who may write this table? Not `app_runtime`: every user request runs as that role, so one careless route would let a user grant themselves a feature. Only the privileged `postgres` role (`DATABASE_DIRECT_URL`) writes rows, and it needs nothing granted: it owns the table, and it has `BYPASSRLS`, which beats even `FORCE`. Nobody updates rows: granting is an insert and revoking is a delete.

1. Create an empty custom migration:

```bash
pnpm --filter @sidekick/core db:generate --custom --name user_feature_entitlements_rls
```

2. Write `0007_user_feature_entitlements_rls.sql`:

```sql
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
```

Don't copy `0002`'s `FOR ALL … WITH CHECK` policy. `FOR ALL` with `WITH CHECK` lets a user insert rows carrying their own `user_id`, which, combined with the default `INSERT` grant, is exactly a user granting themselves a feature. `FOR SELECT` takes only `USING`; `WITH CHECK` has nothing to check on a read, and Postgres rejects it.

`REVOKE` mirrors the `GRANT` in `0001`: same three parts, with `GRANT … TO` swapped for `REVOKE … FROM`.

---

## Step 4 — Read It

> **What and why:** The guard (lesson 4) opens `withRLS(caller.userId, …)` and needs the caller's feature keys inside that transaction.

Why it takes `tx`, not `userId`:

- `withRLS` sets `app.current_user_id` with `set_config(…, true)`, which lasts only until the transaction ends, so a pooled connection never carries one user's id into the next request.
- The user is already inside `tx`, and the policy filters on it, so the query needs no `where`. A `userId` parameter would be redundant, or could disagree with the transaction and quietly return nothing.
- Without `tx`, the function would need its own connection: one with no user sees zero rows, and a second `withRLS` costs a second pooled connection per request.
- It returns keys, not manifests, so `packages/core` never imports the registry.

1. Create `packages/core/src/features/entitlements.ts`:

```ts
import "server-only";

import type { RlsTx } from "../db";
import { userFeatureEntitlements } from "../db/schema";

const selectFeatureKeys = async (tx: RlsTx) =>
   tx
      .select({ featureKey: userFeatureEntitlements.featureKey })
      .from(userFeatureEntitlements);

const toFeatureKeyArray = (
   entitlements: Awaited<ReturnType<typeof selectFeatureKeys>>,
) => entitlements.map(({ featureKey }) => featureKey);

/**
 * Retrieves the enabled feature keys of the user whose id withRLS set on tx.
 * RLS filters the rows, so the query needs no user filter of its own.
 * @param tx Transaction opened by withRLS for the caller
 * @returns Keys of enabled features
 */
export async function getEnabledFeatures(tx: RlsTx): Promise<string[]> {
   return toFeatureKeyArray(await selectFeatureKeys(tx));
}
```

The database call and the pure transform are separate functions, and `getEnabledFeatures` composes them. Selecting only `featureKey` lets Drizzle infer the row type. There's no `ORDER BY`, so callers must not rely on order.

---

## Step 5 — Prove It

> **What and why:** Unit tests can't prove RLS or grants; only a real Postgres can. `tests/with-test-db.sh` builds a throwaway PostgreSQL 17 from the Supabase stand-ins and every migration, runs the command and deletes the cluster. Install the tools once with `brew install postgresql@17`.

1. The seed needs the privileged role, and the script didn't export one. `DATABASE_URL` is `app_runtime` and `TEST_AUTH_DATABASE_URL` is `supabase_auth_admin`; neither can write this table. Add to `tests/with-test-db.sh`:

```bash
# postgres: the privileged migration/seed role, the only one that writes entitlements
export TEST_ADMIN_DATABASE_URL="$(url postgres)"
```

2. Create `packages/core/tests/integration/entitlements.test.ts`, not under `src/`: `pnpm test` runs everything under `src/` without a database. The file:

- opens `authDb`, `adminDb` and `runtimeDb` with `postgres(url, { max: 1 })`;
- inserts three users into `auth.users` (the `0005` trigger creates their profiles, which the foreign key needs), then seeds entitlements through `adminDb` with postgres.js's multi-row helper, `adminDb(rows, 'user_id', 'feature_key')`. Building `(${a}, ${b})` strings inside the tagged template sends them as one text parameter, not SQL;
- has six tests:

| Test                                                    | How                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| returns only userA's / userB's feature keys (`it.each`) | `withRLS(userId, getEnabledFeatures)`, sorted before comparing                 |
| returns zero rows without a user context                | `runtimeDb\`SELECT 1 FROM user_feature_entitlements\``                         |
| cannot insert, even for the caller's own user           | `withRLS` insert → rejects with "permission denied for table …"                |
| cannot delete, even the caller's own rows               | `withRLS` delete → rejects with "permission denied for table …"                |
| cascades through profiles to their entitlements         | delete from `auth.users` via `authDb`, then count via `adminDb` (bypasses RLS) |

Match the error message, not just the rejection. Both the `REVOKE` and RLS fail with SQLSTATE 42501, but "permission denied" comes only from the `REVOKE`. Drizzle wraps the driver error, so the message sits on `cause`:

```ts
const permissionDenied = {
   cause: expect.objectContaining({
      message: "permission denied for table user_feature_entitlements",
   }),
};

await expect(insert).rejects.toMatchObject(permissionDenied);
```

3. Run it:

```bash
pnpm --filter @sidekick/core test:integration
```

Expect 9 passed: 6 here and 3 in `rls.test.ts`.

4. **Break each wall, one at a time.** Guess which test fails before running, and put each one back before the next. Editing a migration is safe here because the script rebuilds the database every run.

| Break                          | What fails                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy `USING (true)`          | Both own-rows reads (each user sees everything) and the context-free query, which only returned zero rows because `NULL` never matched.                  |
| `REVOKE` commented out         | Insert now fails with "new row violates row-level security policy" (RLS denies by default). Delete **doesn't fail at all**: RLS filters it to zero rows. |
| `ON DELETE restrict` in `0006` | The cascade test fails on the `DELETE FROM auth.users` line with a foreign key violation. The whole statement rolls back, user and profile included.     |

The second row is the reason both walls exist: without the `REVOKE`, a forbidden delete silently does nothing.

---

## Step 6 — Apply to Dev

> **What and why:** Put the table on the dev Supabase project, which is a real database, so commit first.

1. From the repo root:

```bash
pnpm db:migrate
```

2. Check it in the Supabase dashboard: the table shows RLS enabled and no rows, and `users_read_own_entitlements` is listed for `SELECT`.

3. In the SQL Editor, list who holds which privileges:

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'user_feature_entitlements'
order by grantee, privilege_type;
```

`app_runtime` should hold only `SELECT`. Expect Supabase's own `anon`, `authenticated` and `service_role` to hold full privileges too, because Supabase's default privileges grant them on every new `public` table. RLS stops `anon` and `authenticated`: the policy compares against `app.current_user_id`, which is never set for them. `service_role` has `BYPASSRLS`, which is why the admin client is server-only and lint-restricted.

---

## Step 7 — Verify Like CI and Ship

1. Run everything uncached:

```bash
pnpm prettier:check
pnpm turbo lint typecheck build test --force
pnpm --filter @sidekick/core test:integration
```

If `web#build` fails with `Cannot find module …/next/dist/bin/next`, `node_modules` is stale after a dependency update. Run `pnpm install` and try again.

2. Commit, push and open the PR:

```bash
git add packages/core
git commit -m "feat(core): add user_feature_entitlements table and getEnabledFeatures"
git push -u origin feature/P2L3-entitlements
gh pr create --fill
```

Wait for the `checks` job (it runs `test:integration` on PostgreSQL 17), then squash-merge.

---

## What you have now

- `user_feature_entitlements` with a composite primary key, a cascading foreign key to `profiles`, forced RLS with a read-only own-rows policy, and no write privileges for `app_runtime`.
- `getEnabledFeatures(tx)` in `packages/core/src/features/entitlements.ts`, internal to `core` until the guard uses it.
- Six integration tests, each proven to fail when the wall it guards is removed.

Next: [[task-2-2and2-3|lesson 4]], `withApiGuard`.
