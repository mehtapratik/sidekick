---
publish: true
id: plan.phase-2.task-2-2and2-3
title: "Tasks 2.2 and 2.3: withApiGuard with withRLS"
created: 2026-10-18
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - task
   - api-guard
   - rls
   - api
   - security
   - testing
status: planned
---

> **Handoff:** wave 2. Starts after [[task-2-1]] and [[task-2-8and2-9]] are merged. [[task-2-4and2-5]] and [[task-2-11and2-12]] wait for it.

**Goal:** the single wrapper every route handler goes through. It runs auth, scope, RLS context and feature entitlement, in [[contracts#Guard|the contract's order]], with the [[contracts#Error shape|error shape]].

**Read first:** [[contracts]], [[with-api-guard]], [[centralized-and-client-agnostic]], [[error-handling]], `packages/core/src/db/rls.ts`, `packages/eslint-plugin-sidekick/src/rules/require-api-guard.ts`.

## Build

1. Create `packages/core/src/api/guard.ts` (`import 'server-only'`) with `GuardOptions`, `ApiHandler`, `withApiGuard` and a small private helper that builds error responses.
2. Create `packages/core/src/api/index.ts` exporting `withApiGuard` and the types `GuardOptions`, `ApiHandler` and `ApiCaller`. Add `"./api": "./src/api/index.ts"` to `packages/core/package.json` `exports`.
3. Unit tests in `src/api/guard.test.ts`, mocking `./auth`, `../db/rls` and `../features/entitlements`. Cover each row of the error table, the check order (no transaction opens for a 401 or a scope 403), that session callers skip the scope check, that `ctx` is passed through, and that a thrown handler error becomes a 500 with no details in the body.
4. Integration test in `tests/integration/guard.test.ts`, with the real database and only `resolveApiCaller` mocked:
   - an entitled user gets 200 for `feature: 'test-feature'`,
   - a user without the entitlement gets 403 `FEATURE_DISABLED`,
   - the handler's `tx` sees only the caller's profile,
   - a handler that writes and then throws leaves no row behind (rollback).

## Done when

- Unit and integration tests pass, and each one fails when the check it covers is removed.
- `pnpm turbo lint typecheck build test --force` and `pnpm test:integration` pass.
- A route written as in the [[with-api-guard]] example type-checks against `withApiGuard`. Try it in a scratch file and don't commit it; [[task-2-11and2-12]] adds the real route.

## Out of scope

Logging ([[task-2-4and2-5]]), Zod input validation, Bearer key lookup and `lastUsedAt` (Phase 9), and changes to the lint rule.

**Learning focus:** higher-order functions (a function that returns a handler), generics (`Ctx`), why the request runs inside one transaction, and what commit and rollback mean for a handler.
