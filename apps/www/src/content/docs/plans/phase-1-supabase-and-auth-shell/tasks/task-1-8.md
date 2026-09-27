---
title: Task 1.8
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
  - turborepo
  - pnpm
appliesTo: []
isSection: false
docId: plan.phase-1.task-1-8
sourcePath: sources/docs/04-plans/phase-1-supabase-and-auth-shell/tasks/task-1-8.md
wordCount: 80
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Add to root `package.json` scripts:

```json
"db:migrate": "turbo run db:migrate"
```

And add `db:migrate` task to `turbo.json`:

```json
"db:migrate": {
  "cache": false
}
```

> `cache: false` because migrations are side effects — the result is a database state change, not an output file. Turborepo should never skip them.

**Running migrations:**

```bash
# From repo root, generates SQL from schema:
pnpm --filter @sidekick/core db:generate

# Review the generated SQL in packages/core/src/db/migrations/
# Then apply:
pnpm --filter @sidekick/core db:migrate
```

---
