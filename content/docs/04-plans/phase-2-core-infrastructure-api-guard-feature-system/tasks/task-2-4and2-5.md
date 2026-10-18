---
publish: true
id: plan.phase-2.task-2-4and2-5
title: "Tasks 2.4 and 2.5: request and auth-failure logging"
created: 2026-10-18
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - task
   - api-guard
   - observability
   - eslint
status: planned
---

> **Handoff:** wave 3, runs alongside [[task-2-11and2-12]]. Starts after [[task-2-2and2-3]] is merged.

**Goal:** every request the guard handles leaves one line of structured log, and every 401, 403 and 500 says why ([[contracts#Logging|contract]]).

**Read first:** [[contracts]], [[03-system-design/non-functional/observability/centralized|centralized observability]], [[error-handling]], `packages/core/src/api/guard.ts`.

## Build

1. Create `packages/core/src/observability/log.ts` with a tiny logger: `logInfo(event, fields)` and `logError(event, fields)`, each writing `JSON.stringify({ event, ...fields })` as one line. Use `console.info` for info and `console.error` for errors.
2. The repo's `no-console` rule allows only `warn` and `error`. Add a per-file exception for `log.ts` in `eslint.config.js`, with a comment saying it's the one logging sink. Don't loosen the rule anywhere else.
3. Call the logger from `withApiGuard`: `api.request` once per request, after the response is known (measure latency with `performance.now()`), `api.denied` on each 401 and 403, and `api.error` on a 500.
4. Extend `src/api/guard.test.ts` by spying on the logger. Assert the fields for each event, that `path` has no query string, and that nothing logged contains a cookie or an `Authorization` value.

## Done when

- Tests pass, and `pnpm turbo lint typecheck build test --force` passes.
- `pnpm lint` from inside `packages/core` still reports `console.log` anywhere other than `log.ts`. Show it failing once.

## Out of scope

Log shipping, levels, sampling and dashboards (Phase 10).

**Learning focus:** structured logs vs. free-text logs, what must never be logged, and ESLint per-file overrides in flat config.
