---
title: Task 1.4
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
  - authentication
  - nextjs
  - react
  - typescript
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-4
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-4.md
wordCount: 241
readingMinutes: 2
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Why a separate server client exists:** Server Components and Route Handlers run on the server where there is no browser context (no `document`, no `localStorage`). Auth state lives in HTTP cookies. This client reads and writes those cookies.

**Why `cookies()` from `next/headers`:** Next.js App Router provides a `cookies()` utility for accessing the request's cookie jar from server code. The `@supabase/ssr` server client needs callbacks to read and write cookies — this is how session tokens are persisted across requests.

```typescript
// packages/core/src/supabase/server.ts
import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerClient() {
   const cookieStore = await cookies();

   return _createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
         cookies: {
            getAll() {
               return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
               try {
                  cookiesToSet.forEach(({ name, value, options }) =>
                     cookieStore.set(name, value, options),
                  );
               } catch {
                  // Server Components cannot set cookies — middleware handles the refresh
               }
            },
         },
      },
   );
}
```

> The `try/catch` in `setAll` is intentional — Server Components (not Route Handlers) can't write cookies. The middleware (task 1.11) handles the actual refresh. The `try/catch` silences the expected error in that context.

**Important:** This file imports `next/headers` which is a Next.js-specific module. This means `packages/core` will depend on Next.js. That's acceptable here because `packages/core` is exclusively used by `apps/web`. If you ever need a truly framework-agnostic package, create a separate package.

Add `next` as a peer dependency in `packages/core/package.json`:

```json
"peerDependencies": {
  "next": ">=16"
}
```

---
