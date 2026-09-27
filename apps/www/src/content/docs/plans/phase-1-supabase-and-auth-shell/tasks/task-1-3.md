---
title: Task 1.3
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
  - supabase
  - nextjs
  - typescript
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-3
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-3.md
wordCount: 86
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Why a browser client exists:** Runs in the browser only. Uses the `anon` key. Cannot read server-side cookies — it manages its own in-memory state that is synced to localStorage.

```typescript
// packages/core/src/supabase/browser.ts
import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

export function createBrowserClient() {
   return _createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
   );
}
```

> The `!` non-null assertion is safe here because these values are build-time constants — they are baked in by Next.js at build time and will always be present when this code runs.

---
