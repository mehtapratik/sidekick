---
title: Task 1.6
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
  - authentication
  - typescript
  - offline
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-6
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-6.md
wordCount: 166
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Why Drizzle over Prisma:** Drizzle is SQL-first — you write TypeScript that maps directly to SQL. There's no magic schema sync or shadow database. The SQL you write is the SQL that runs. It's also significantly lighter weight, which matters for a monorepo with many feature packages each having their own schema.

Create the file structure:

```
packages/core/src/db/
├── schema/
│   ├── profiles.ts    ← define the profiles table
│   └── index.ts       ← re-export all schemas
├── index.ts           ← create and export db connection
└── rls.ts             ← withRLS helper (task 1.10)
```

**`packages/core/src/db/schema/profiles.ts`:**

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
   id: uuid("id").primaryKey(), // matches auth.users.id from Supabase
   email: text("email").notNull(),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
});
```

> `id` is a UUID that matches `auth.users.id` — Supabase creates the auth user first, then we create the matching profile row with the same ID. This is the standard pattern.

**`packages/core/src/db/schema/index.ts`:**

```typescript
export * from "./profiles";
```

---
