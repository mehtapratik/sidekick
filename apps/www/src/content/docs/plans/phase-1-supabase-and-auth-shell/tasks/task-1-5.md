---
title: Task 1.5
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
  - authentication
  - typescript
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-5
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-5.md
wordCount: 118
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Why the admin client exists:** The `service_role` key bypasses RLS entirely. It's used for server-side operations that need elevated access (e.g., creating the `profiles` row after signup, where RLS hasn't yet been applied to the new user). This client **must never be imported by any browser-side code**.

```typescript
// packages/core/src/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";

// This client uses the service_role key which bypasses RLS.
// It is server-only — never import this in a browser context.
export function createAdminClient() {
   return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
         auth: {
            autoRefreshToken: false,
            persistSession: false,
         },
      },
   );
}
```

> `autoRefreshToken: false` and `persistSession: false` because this is a short-lived server-side client — not a session-based user client.

---
