---
publish: true
id: plan.phase-1.task-1-8
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-1
   - task
   - turborepo
   - pnpm
status: completed
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
