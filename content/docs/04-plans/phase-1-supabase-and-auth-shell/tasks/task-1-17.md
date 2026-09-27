---
id: plan.phase-1.task-1-17
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-1
   - task
   - supabase
   - authentication
status: completed
---

Sign-out is handled in the `AppShell` component via `supabase.auth.signOut()` followed by a push to `/login` and `router.refresh()` to clear the server-side cache.

---
