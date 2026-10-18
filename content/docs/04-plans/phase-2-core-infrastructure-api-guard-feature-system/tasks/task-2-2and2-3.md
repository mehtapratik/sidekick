---
publish: true
id: plan.phase-2.task-2-2and2-3
title: "Lesson 4 (tasks 2.2, 2.3): withApiGuard with withRLS"
created: 2026-10-18
updated: 2026-10-18
kind: plan
version: 2.1.0
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

> **Lesson 4 of 8.** Before this: [[task-2-8and2-9|lesson 3]]. Next: [[task-2-4and2-5|lesson 5]]. The coach follows [[contracts#How we build|how we build]]. The target design is [[contracts#Guard|Guard]] and [[contracts#Error shape|Error shape]].

**What gets built:** `withApiGuard(handler, opts)`, the one wrapper every API route goes through. It ties together lessons 2 and 3 and `withRLS`.

**Concepts:** higher-order functions, generics, centralized security ([[centralized-and-client-agnostic]]), ordering checks so the cheap ones run first, one transaction per request, commit vs. rollback, and a consistent error shape.

**Coach reads first:** [[contracts]], [[with-api-guard]], [[error-handling]], `packages/core/src/db/rls.ts`, `packages/eslint-plugin-sidekick/src/rules/require-api-guard.ts`.

## Steps

By default the coach hands over each step's code as one small piece, with an explanation below it, and the two of you discuss it before it's final ([[contracts#How we build|how we build]]). **Good to write yourself:** the order of checks inside `withApiGuard` (steps 2 and 4). Pratik decides, and can switch any step either way.

1. **Why a wrapper.** Pratik reads the `require-api-guard` lint rule and explains in their own words what it forces. The coach explains higher-order functions with a tiny, unrelated example, such as a `withTiming(fn)` wrapper.
2. **Design the order.** Ask: "Auth, scope, feature, RLS. In what order, and which of these need the database?" Pratik writes the order down before any code. Compare it with the contract and discuss any difference.
3. **Types.** Build `GuardOptions` and `ApiHandler<Ctx>`. Teach generics through `Ctx`, which is Next.js's second route-handler argument.
4. **The guard.** Build `withApiGuard` in `src/api/guard.ts`, with a small helper for error responses that follows the error-shape table.
5. **Errors.** Ask: "If the handler throws halfway through a write, what should happen to the write and to the response?" Add the catch: roll back, log, and send a generic 500.
6. **Export it.** Add `src/api/index.ts` and the `./api` entry in `exports`.
7. **Unit tests.** Write `src/api/guard.test.ts` with `./auth`, `../db/rls` and `../features/entitlements` mocked. It covers each error row, that no transaction opens for a 401, that session callers skip the scope check, that `ctx` is passed through, and that a throw becomes a 500.
8. **Integration test.** Write `tests/integration/guard.test.ts` against the real database, mocking only `resolveApiCaller`. It covers entitled vs. not entitled, the handler seeing only its own profile, and a rollback on throw. Pratik removes the feature check once and watches the test fail.
9. **Verify and ship.**

## Check understanding

- Why does the scope check run before the transaction opens, while the feature check runs inside it?
- What does the client see when the handler throws, and why nothing more?
- If a handler returns a 400 after writing a row, is the row kept? Should it be?

**Done when:** Pratik's PR is green, and they can answer the questions above.

**Out of scope:** logging (lesson 5), Zod validation, and API keys (Phase 9).
