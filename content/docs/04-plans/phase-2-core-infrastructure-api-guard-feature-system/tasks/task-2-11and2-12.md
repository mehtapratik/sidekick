---
publish: true
id: plan.phase-2.task-2-11and2-12
title: "Lesson 6 (tasks 2.11, 2.12): /api/health and guard verification"
created: 2026-10-18
updated: 2026-10-18
kind: plan
version: 2.1.0
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

> **Lesson 6 of 8.** Before this: [[task-2-4and2-5|lesson 5]]. Next: [[task-2-10|lesson 7]]. The coach follows [[contracts#How we build|how we build]]. The target design is [[contracts#Guard|Guard]].

**What gets built:** the first real API route, `GET /api/health`, wrapped in `withApiGuard`. Then Pratik proves the 401, 200 and 403 behaviour end to end.

**Concepts:** App Router route handlers, why the proxy skips `/api`, the two layers that keep routes guarded (lint plus the build manifest check), and testing HTTP by hand with `curl -i`.

**Coach reads first:** [[contracts]], [[with-api-guard]], `apps/web/scripts/verify-endpoints.mjs`, `apps/web/src/proxy.ts`.

## Steps

By default the coach hands over each step's code as one small piece, with an explanation below it, and the two of you discuss it before it's final ([[contracts#How we build|how we build]]). **Good to write yourself:** the route itself (step 2); it's a few lines and you'll write many more. Pratik decides, and can switch any step either way.

1. **Route handlers.** Explain App Router `route.ts` files. Create `apps/web/src/app/api/health/route.ts`.
2. **Break it first.** Start with an unguarded `export async function GET()`, Pratik runs `pnpm lint` inside `apps/web` and reads the error. Then wrap it with `withApiGuard` and returns `{ status: 'ok' }`. Ask: "Should health require a feature?"
3. **Build check.** Pratik runs `pnpm --filter web build` and finds `/api/health` in the endpoint check's output. Explain what `verify-endpoints.mjs` catches that lint can't.
4. **Try it.** Pratik runs `pnpm dev`. Then:
   - `curl -i localhost:3000/api/health` returns 401 with the error shape,
   - the same URL in a signed-in browser returns 200,
   - `curl -i -H 'Authorization: Bearer x' …` returns 401.

   Pratik reads the guard's log lines from lesson 5 in the terminal.

5. **403.** With no features registered yet, Pratik shows the 403 path by re-running lesson 4's integration test. Ask why health doesn't cover it.
6. **Verify and ship.** The PR description records the curl results.

## Check understanding

- Why would a public health check for hosting need a deliberate exception, and who should decide?
- What does `curl -i` show that the browser hides?

**Done when:** Pratik's PR is green, the curl results are in the PR, and they can answer the questions above.

**Out of scope:** public liveness probes and end-to-end test tooling.
