---
publish: true
id: plan.phase-2.task-2-1
title: "Task 2.1: resolveApiCaller"
created: 2026-10-18
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - task
   - api-guard
   - authentication
   - supabase
   - nextjs
status: planned
---

> **Handoff:** wave 1, runs alongside [[task-2-6and2-7]] and [[task-2-8and2-9]]. Depends on nothing. [[task-2-2and2-3]] waits for it.

**Goal:** answer "who is calling?" for any API request. Implement `resolveApiCaller(req)` exactly as [[contracts#Caller|the contract]] defines it.

**Read first:** [[contracts]], [[authentication]], `packages/core/src/supabase/server.ts`, `apps/web/src/proxy.ts`.

## Build

1. Create `packages/core/src/api/auth.ts` with `import 'server-only'` at the top, the `ApiCaller` type and `resolveApiCaller`.
2. If `req` has an `Authorization` header that starts with `Bearer ` (case-insensitive scheme), return `null`. Add a comment pointing at Phase 9 task 9.4.
3. Otherwise call `createServerClient()` from `../supabase/server` and `supabase.auth.getUser()`. It validates the session with Supabase Auth, the same way the proxy does. Return `{ kind: 'session', userId: user.id }` when there is a user. Return `null` when there is no user or Auth returns an error.
4. Don't catch errors thrown by `createServerClient()` (for example, missing env vars). They are loud failures ([[error-handling]]).
5. Add `packages/core/src/api/auth.test.ts` (Vitest, `vi.mock('../supabase/server')`). Cover: a session user resolves; no user gives `null`; an Auth error gives `null`; a Bearer header gives `null` without calling Supabase; a Bearer header plus a valid session still gives `null`.

## Done when

- `pnpm --filter @sidekick/core test` passes, and each test fails when you break the branch it covers.
- `pnpm turbo lint typecheck build --force` passes.
- No `exports` entry is added. The guard imports this file relatively.

## Out of scope

The `api_keys` table, any Bearer key lookup, `getClaims()`, and changes to the proxy.

**Learning focus:** discriminated unions (`kind`), why "unknown" must fail closed, and mocking a module in Vitest.
