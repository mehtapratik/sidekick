---
id: moc.plan.phase-1
created: 2026-09-19
kind: guidance
version: 1.0.0
tags:
   - moc
   - plan
   - phase-1
   - rls
   - supabase
   - drizzle
   - postgresql
   - authentication
   - nextjs
status: completed
---

# Phase 1 — Supabase and auth shell

> **Context:** Phase 0 delivered a working monorepo skeleton (pnpm, Turborepo, TypeScript strict mode, ESLint with boundary enforcement). All packages contain placeholder exports only. Phase 1 wires in real authentication, a database schema, and a minimal UI shell — the security and data foundation that every subsequent phase builds on top of.
>
> **Archival copy:** Save this document to `docs/plans/phase-1-supabase-and-auth-shell/` after plan mode exits.

---

## What Phase 1 Delivers

By the end of this phase you can:

- Sign up with email + password
- Log in and land on `/dashboard`
- Log out
- Be redirected to `/login` when accessing `/dashboard` unauthenticated
- Have your user stored in a `profiles` table in Postgres with RLS enforced

---

## Architectural Constraints (from architecture-handover.md)

These must not be violated:

1. `packages/*` must **never** import from `apps/*` (ESLint boundary rule)
2. All database queries that touch user data must go through `withRLS(userId, fn)` — never raw queries against user tables
3. Three Supabase clients, strictly separated: browser, server, admin — never mix them
4. Middleware handles session refresh + redirects **only** — no business logic
5. The admin client (`service_role`) is **server-only** — never expose it to the browser bundle

---

## Critical File Paths

| Role                    | Path                                        |
| ----------------------- | ------------------------------------------- |
| Supabase browser client | `packages/core/src/supabase/browser.ts`     |
| Supabase server client  | `packages/core/src/supabase/server.ts`      |
| Supabase admin client   | `packages/core/src/supabase/admin.ts`       |
| Core package barrel     | `packages/core/src/index.ts`                |
| Core package.json       | `packages/core/package.json`                |
| DB schema               | `packages/core/src/db/schema/profiles.ts`   |
| DB index                | `packages/core/src/db/schema/index.ts`      |
| RLS helper              | `packages/core/src/db/rls.ts`               |
| DB connection           | `packages/core/src/db/index.ts`             |
| Drizzle config          | `packages/core/drizzle.config.ts`           |
| Next.js middleware      | `apps/web/src/middleware.ts`                |
| Root layout             | `apps/web/src/app/layout.tsx`               |
| Login page              | `apps/web/src/app/(auth)/login/page.tsx`    |
| Sign-up page            | `apps/web/src/app/(auth)/signup/page.tsx`   |
| Auth layout             | `apps/web/src/app/(auth)/layout.tsx`        |
| Dashboard page          | `apps/web/src/app/(app)/dashboard/page.tsx` |
| App layout              | `apps/web/src/app/(app)/layout.tsx`         |
| Root .env.local         | `.env.local` (gitignored, not committed)    |

---

## Task Breakdown

## Tasks

- [[tasks/task-1-1|Task 1.1 — Create Supabase project (manual, no code)]]
- [[tasks/task-1-2|Task 1.2 — Install Supabase client packages in `packages/core`]]
- [[tasks/task-1-3|Task 1.3 — `createBrowserClient()` in `packages/core/src/supabase/browser.ts`]]
- [[tasks/task-1-4|Task 1.4 — `createServerClient()` in `packages/core/src/supabase/server.ts`]]
- [[tasks/task-1-5|Task 1.5 — Admin client in `packages/core/src/supabase/admin.ts`]]
- [[tasks/task-1-6|Task 1.6 — `profiles` schema with Drizzle]]
- [[tasks/task-1-7|Task 1.7 — Drizzle config in `packages/core/drizzle.config.ts`]]
- [[tasks/task-1-8|Task 1.8 — Root `db]]
- [[tasks/task-1-9|Task 1.9 — Enable RLS on `profiles` + canonical policy]]
- [[tasks/task-1-10|Task 1.10 — `withRLS(userId, fn)` in `packages/core/src/db/rls.ts`]]
- [[tasks/task-1-11|Task 1.11 — Next.js middleware in `apps/web/src/middleware.ts`]]
- [[tasks/task-1-14|Task 1.14 — Add Mantine provider, Notifications, PostCSS]]
- [[tasks/task-1-12and1-13|Task 1.12 & 1.13 — Login and Sign-up pages]]
- [[tasks/task-1-15and1-16|Task 1.15 & 1.16 — Dashboard shell with sign-out]]
- [[tasks/task-1-17|Task 1.17 — Sign-out (already included in AppShell above)]]
- [[tasks/task-1-18|Task 1.18 — Verification checklist]]
