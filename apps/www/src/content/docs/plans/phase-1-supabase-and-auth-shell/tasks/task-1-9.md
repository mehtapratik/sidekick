---
title: Task 1.9
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
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-9
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-9.md
wordCount: 152
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

This is done via SQL in the Supabase dashboard (SQL Editor). After running the Drizzle migration to create the `profiles` table:

```sql
-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Canonical user-owns-rows policy:
-- Users can only SELECT, INSERT, UPDATE their own row
CREATE POLICY "Users can manage their own profile"
  ON profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

**What RLS does:** Without this, any authenticated user could query `SELECT * FROM profiles` and see every user's data. With RLS enabled and this policy, Postgres automatically appends a `WHERE id = auth.uid()` filter to every query — at the database level, regardless of what the application sends.

**Why this still isn't enough by itself:** When using the service-role client or Drizzle with the `DATABASE_URL` connection (which bypasses Supabase auth), RLS doesn't kick in automatically. That's what `withRLS` (task 1.10) solves.

---
