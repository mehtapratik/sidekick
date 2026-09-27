---
title: Task 1.2
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
  - drizzle
  - postgresql
  - authentication
  - nextjs
  - pnpm
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-2
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-2.md
wordCount: 73
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Why `@supabase/ssr` and not `@supabase/auth-helpers-nextjs`:**
`@supabase/ssr` is the current official package for server-rendered apps (Next.js App Router). The older helpers package is deprecated.

**Run from repo root:**

```bash
pnpm add --filter @sidekick/core @supabase/ssr @supabase/supabase-js
```

Also install Drizzle dependencies (needed for tasks 1.6–1.8):

```bash
pnpm add --filter @sidekick/core drizzle-orm postgres
pnpm add --filter @sidekick/core -D drizzle-kit
```

> `--filter @sidekick/core` targets the package by its name in `package.json`, not its folder name.

---
