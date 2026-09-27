---
id: plan.phase-1.task-1-18
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-1
   - task
   - api-guard
   - rls
   - supabase
   - drizzle
   - postgresql
   - authentication
status: completed
---

Before declaring Phase 1 complete:

- [ ] `pnpm turbo build` succeeds without errors
- [ ] `pnpm turbo typecheck` passes across all packages
- [ ] `pnpm turbo lint` passes (no boundary violations)
- [ ] Navigate to `http://localhost:3000/dashboard` while logged out → redirected to `/login`
- [ ] Sign up with a new email → lands on `/dashboard`
- [ ] Check Supabase dashboard → user appears in **Authentication → Users**
- [ ] Check Supabase dashboard → row appears in **Table Editor → profiles**
- [ ] Reload `/dashboard` → session persists (not redirected to login)
- [ ] Click Sign Out → redirected to `/login`
- [ ] Navigate to `/dashboard` after sign-out → redirected to `/login`

---

## Packages to Install (Summary)

| Package                  | Target           | Purpose                                 |
| ------------------------ | ---------------- | --------------------------------------- |
| `@supabase/ssr`          | `@sidekick/core` | Supabase client for Next.js App Router  |
| `@supabase/supabase-js`  | `@sidekick/core` | Supabase base client                    |
| `drizzle-orm`            | `@sidekick/core` | TypeScript ORM for schema + queries     |
| `postgres`               | `@sidekick/core` | PostgreSQL driver for Drizzle           |
| `drizzle-kit` (dev)      | `@sidekick/core` | CLI for generating/running migrations   |
| `@mantine/core`          | `web`            | Component library                       |
| `@mantine/hooks`         | `web`            | Mantine React hooks                     |
| `@mantine/form`          | `web`            | Form state management                   |
| `@mantine/notifications` | `web`            | Toast notifications                     |
| `postcss`                | `web`            | CSS processing (required by Mantine)    |
| `postcss-preset-mantine` | `web`            | Mantine PostCSS plugin                  |
| `postcss-simple-vars`    | `web`            | CSS variables for breakpoints           |
| `@sidekick/core`         | `web`            | Workspace dep — access Supabase clients |

---

## Key Concepts Introduced in Phase 1 (Learning Reference)

| Concept                             | Where                           | Why                                                           |
| ----------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| Browser vs. server Supabase clients | `packages/core/src/supabase/`   | Different environments need different auth strategies         |
| Cookie-based sessions               | `middleware.ts` + server client | Server-rendered pages need cookies, not localStorage          |
| Drizzle schema = TypeScript types   | `packages/core/src/db/schema/`  | Write once, type-safe everywhere                              |
| Row Level Security                  | Supabase SQL Editor             | Database-enforced data isolation                              |
| `withRLS` session variable          | `packages/core/src/db/rls.ts`   | Bridge between Drizzle's postgres connection and RLS policies |
| Route groups                        | `(auth)/`, `(app)/`             | Organize pages without affecting URLs                         |
| Server vs. Client Components        | Throughout `apps/web`           | Server = data fetching; Client = interactivity                |
| Next.js middleware                  | `apps/web/src/middleware.ts`    | Runs before every request for session refresh + redirects     |

---

## What's Out of Scope for Phase 1

- `withApiGuard()` — Phase 2
- Feature entitlements — Phase 2
- Email verification flows — deliberate skip for now; can be enabled in Supabase dashboard settings later
- Forgot password / password reset — Phase 2 or later
- OAuth providers (Google, GitHub) — can be added later without rework

---

## Archival Note

Save this document to:
`docs/plans/phase-1-supabase-and-auth-shell/sidekick-phase1_plan.md`

This is the first implementation step after plan mode exits.
