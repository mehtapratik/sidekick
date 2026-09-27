---
id: system-design.non-functional.security.row-level-security
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - security
   - rls
   - drizzle
   - offline
---

1. Enforce RLS on all non-superuser roles, including table owners.
2. Always use `drizzle-orm` for all regular user queries
3. RLS policy on syncable tables

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_own_rows"
ON table_name
FOR ALL
USING (
  user_id::text = current_setting('app.current_user_id', true)
  AND deleted_at IS NULL
)
WITH CHECK (
  user_id::text = current_setting('app.current_user_id', true)
);
```

> **Why no `deletedAt` exclusion in `WITH CHECK` clause?**
> Because we want to support reversal of soft-deletion (undo delete) process — excluding `deletedAt IS NULL` in `WITH CHECK` clause will let `INSERT` and `UPDATE` permissions set `deletedAt` value to `NULL`.

3. RLS policy on non-syncable tables

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile"
ON profiles
FOR ALL
USING  (id::text = current_setting('app.current_user_id', true))
WITH CHECK (id::text = current_setting('app.current_user_id', true));
```

> The `deletedAt` check is excluded in non-syncable table’s RLS policy because it only support hard-deletion.

## RLS context injection helper

```tsx
export async function withRLS<T>(
   userId: string,
   fn: (tx: Tx) => Promise<T>,
): Promise<T> {
   return db.transaction(async (tx) => {
      await tx.execute(
         sql`select set_config('app.current_user_id', ${userId}, true)`,
      );
      return fn(tx);
   });
}
```

1. Always use RLS context helper, `withRLS`, to inject RLS context centrally across all handlers. Never do this inline or any other way.
2. **Caution**: Do not forget to add `db.transaction` wrapper around`set_config` with `is_local = true`. This will ensure that user id is reset once query is executed. Forgetting this will result in user id setting leaking across entire pooled connection.
