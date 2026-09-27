---
title: Task 1.10
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: built
version: 1.0.0
tags:
  - plan
  - phase-1
  - task
  - rls
  - supabase
  - drizzle
  - postgresql
  - authentication
  - typescript
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-10
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-10.md
wordCount: 216
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**The problem:** Drizzle connects to Postgres via `DATABASE_URL` as the `postgres` superuser — it bypasses Supabase's auth layer entirely. RLS policies use `auth.uid()`, which is a Supabase function that reads the current session. When Drizzle runs a query, there's no Supabase session — `auth.uid()` returns null and RLS blocks everything.

**The solution:** Before running any query, set a Postgres session variable `app.current_user_id` that your RLS policies read instead of `auth.uid()`.

```typescript
// packages/core/src/db/rls.ts
import { db } from "./index";
import { sql } from "drizzle-orm";

export async function withRLS<T>(
   userId: string,
   fn: (db: typeof import("./index").db) => Promise<T>,
): Promise<T> {
   // Set the session variable that RLS policies will read
   await db.execute(
      sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
   );
   return fn(db);
}
```

**Update the RLS policy** to use this session variable (update the SQL from task 1.9):

```sql
-- Drop the previous policy
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;

-- New policy using session variable instead of auth.uid()
CREATE POLICY "Users can manage their own profile"
  ON profiles
  FOR ALL
  USING (id::text = current_setting('app.current_user_id', true))
  WITH CHECK (id::text = current_setting('app.current_user_id', true));
```

> `true` as the second argument to `current_setting` means "return null if not set" rather than throwing an error — this prevents crashes on unauthenticated queries.

---
