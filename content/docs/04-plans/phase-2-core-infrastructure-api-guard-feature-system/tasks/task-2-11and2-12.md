---
publish: true
id: plan.phase-2.task-2-11and2-12
title: "Tasks 2.11 and 2.12: /api/health and guard verification"
created: 2026-10-18
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - task
   - api-guard
   - api
   - nextjs
   - testing
status: planned
---

> **Handoff:** wave 3, runs alongside [[task-2-4and2-5]]. Starts after [[task-2-2and2-3]] is merged.

**Goal:** the first real API route. It proves the guard chain works end to end inside Next.js, and that the lint rule and endpoint check accept it.

**Read first:** [[contracts]], [[with-api-guard]], `apps/web/scripts/verify-endpoints.mjs`, `apps/web/src/proxy.ts`.

## Build

1. Create `apps/web/src/app/api/health/route.ts` with `export const GET = withApiGuard(handler)`, importing `withApiGuard` from `@sidekick/core/api`. No `feature` option: health must not depend on an entitlement. Respond `{ status: 'ok' }`.
2. Confirm the guard rule bites. Change the export to `export async function GET()`, watch `pnpm lint` (run inside `apps/web`) fail, then put it back.
3. `pnpm --filter web build` must pass, including `verify-endpoints.mjs`, and must list `/api/health` as a route handler.
4. Task 2.12 (401/403): the 403 `FEATURE_DISABLED` path is proven by [[task-2-2and2-3]]'s integration test, since no feature exists yet. Here, add a manual check to the PR for Pratik to run with `pnpm dev`:
   - `curl -i localhost:3000/api/health` returns 401 with `{"error":"Unauthorized","code":"UNAUTHENTICATED"}`,
   - with a signed-in browser session, the same URL returns 200,
   - `curl -i -H 'Authorization: Bearer x' …` returns 401.

## Done when

- Lint, typecheck and build pass, with the endpoint check listing the route.
- Pratik has run the manual check and its result is noted in the PR.

## Out of scope

Unauthenticated health or liveness probes for hosting, which would need a deliberate exception to the guard rule (ask first). Also out of scope: Playwright or end-to-end tests.

**Learning focus:** App Router route handlers, why the proxy skips `/api`, and the two layers that keep routes guarded (lint plus the build manifest check).
