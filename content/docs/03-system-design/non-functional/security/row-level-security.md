---
publish: true
id: system-design.non-functional.security.row-level-security
title: Row-Level Security
created: 2026-09-19
updated: 2026-11-17
kind: spec
version: 2.1.0
tags:
   - system-design
   - security
   - rls
   - drizzle
   - offline
---

1. Enforce RLS on all non-superuser roles, including table owners (`FORCE ROW LEVEL SECURITY`).
2. Always use `drizzle-orm` through `withRLS` for regular user queries.
3. Choose the policy by the table's [[03-system-design/non-functional/database/delete-models|delete model]].

Compare `user_id` as a `uuid`: `nullif(current_setting('app.current_user_id', true), '')::uuid`. The `true` returns NULL on a connection that never set the user; `nullif` turns the `''` a pooled connection reads back after an earlier `withRLS` transaction into NULL, where `''::uuid` would raise an error. Either way the comparison is never true, so the query sees no rows. Comparing `uuid` to `uuid` (not `user_id::text = …`, as core's first policies do) lets an index on `user_id` serve the filter.

## Hard delete and tombstones visible

Own rows, with no `deleted_at` term: a hard-delete table has no tombstones, and a tombstones-visible table lets its repository read them (D66).

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;

CREATE POLICY "table_name_own_rows"
ON table_name
FOR ALL
USING (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
WITH CHECK (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
```

Synergy writes this policy through a Drizzle helper (`ownRowsPolicy` in `packages/platform/synergy/src/db/schema/policies.ts`), so drizzle-kit generates it for every table and regenerates every copy when the helper changes. `FORCE` has no Drizzle equivalent and goes in a custom migration.

## Tombstones hidden

Own live rows: `USING` also hides tombstones, so no query can see a deleted row.

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;

CREATE POLICY "table_name_own_live_rows"
ON table_name
FOR ALL
USING (
  user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
  AND deleted_at IS NULL
)
WITH CHECK (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
```

`WITH CHECK` leaves out `deleted_at` so an update may set it: that update is the soft delete. Nothing can clear it again, because the row is invisible to `USING` from then on and `block_update_on_deleted` refuses any update to it. Tables in this model don't restore (see [[03-system-design/non-functional/database/delete-models|Delete models]]).

## Each table writes its own ownership check

**D267** `decision` #database #rls: Each table's policy spells out its own ownership check (`user_id = nullif(current_setting(…))::uuid`); a central SQL function that every policy calls is deferred until an ownership rule must change across most tables at once. related-to [[D264]]

A policy could call one shared function, `USING (app_owns_row(user_id) AND deleted_at IS NULL)`, and a single `CREATE OR REPLACE` would then change ownership for every table at once. Postgres runs the function at query time, so a rebuilt database still matches production, and a one-line `LANGUAGE sql STABLE` function is inlined at no measurable cost. It is deferred anyway (Pratik, 2026-11-17, Synergy lesson 4):

1. The check it would centralize has not changed since Phase 1, and nothing planned before Phase 3b changes it.
2. The likely changes (sharing a note, workspaces, an agent acting for a user) change some tables in different ways, not every table the same way, so each would still be a per-table policy migration.
3. Switching later costs the same as switching now: one migration per package that owns tables.
4. A policy written out in its migration says exactly what protects the table, which matters while Pratik learns and reviews alone.

A procedure that writes each table's policy from parameters was rejected outright: a migration calling it runs whatever version exists when it runs, so a database rebuilt from scratch would replay old migrations against the newest function and drift from production.

**Revisit when** an ownership rule must change across most tables at once, or when the same change is about to be made to three or more tables' policies. Until then, the catalog test (lesson 4) is what catches a table that forgot its policy, FORCE or triggers.

## RLS context injection helper

```tsx
export async function withRLS<T>(
   userId: string,
   fn: (tx: RlsTx) => Promise<T>,
): Promise<T> {
   return getUnsafeDb().transaction(async (tx) => {
      await tx.execute(
         sql`select set_config('app.current_user_id', ${userId}, true)`,
      );
      return fn(tx);
   });
}
```

1. Always use `withRLS` (`@sidekick/core/db`) to set the RLS context. Never set it inline or any other way.
2. **Caution:** `set_config` must run inside the transaction with `is_local = true`, so the user id ends with the transaction. Without it, the user id would leak to every later request on the pooled connection.

## Decision History

- 2026-11-17 · deferred · A central ownership function for every policy ([[D267]]), Synergy lesson 4
