---
id: plan.phase-1.task-1-1
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-1
   - task
   - supabase
   - postgresql
   - api
   - authentication
   - nextjs
status: completed
---

**Steps:**

1. Go to supabase.com → New Project → name: `sidekick`
2. Set a strong DB password (save it — needed for `DATABASE_URL`)
3. Authentication → Providers → confirm Email is enabled
4. Project Settings → API → collect:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon public` key
   - `SUPABASE_SERVICE_ROLE_KEY` = `service_role` key
5. Project Settings → Database → Connection string → URI → collect `DATABASE_URL` (replace `[YOUR-PASSWORD]`)

**Create `.env.local` at repo root:**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ `.env.local` is already gitignored by Next.js. Never commit it.

---
