---
publish: true
id: plan.phase-2.task-2-4and2-5
title: "Lesson 5 (tasks 2.4, 2.5): request and auth-failure logging"
created: 2026-10-18
updated: 2026-10-23
kind: plan
version: 2.1.1
tags:
   - plan
   - phase-2
   - task
   - api-guard
   - observability
   - eslint
status: complete
---

> **Lesson 5 of 8.** Before this: [[task-2-2and2-3|lesson 4]]. Next: [[task-2-11and2-12|lesson 6]]. The coach follows [[contracts#How we build|how we build]]. The target design is [[contracts#Logging|Logging]].

**What gets built:** a tiny structured logger, and log lines from `withApiGuard` for every request, every 401 and 403, and every 500.

**Concepts:** structured logs vs. free-text logs, what must never be logged (PII, tokens, cookies), measuring latency, ESLint per-file overrides in flat config, and spying in tests.

**Coach reads first:** [[contracts]], [[03-system-design/non-functional/observability/centralized|centralized observability]], [[error-handling]], Pratik's `guard.ts` from lesson 4.

## Steps

By default the coach hands over each step's code as one small piece, with an explanation below it, and the two of you discuss it before it's final ([[contracts#How we build|how we build]]). **Good to write yourself:** the event fields (step 2). Pratik decides, and can switch any step either way.

1. **Why structured.** Show the same event as a free-text line and as a JSON line. Ask which one a machine can search.
2. **Design the events.** Ask: "Which fields would you want when debugging a 403 at 2am? Which fields must never appear?" Pratik lists them, then compares with the contract.
3. **The logger.** Build `src/observability/log.ts`. Pratik runs `pnpm lint` inside `packages/core` and hits `no-console`. Teach the per-file override in `eslint.config.js`, and why it applies to this one file only.
4. **Wire it in.** Add the logger calls in `withApiGuard`, measuring latency with `performance.now()`.
5. **Test it.** Spy on the logger in `guard.test.ts`. The tests check the fields per event, that `path` has no query string, and that no cookie or token is logged. Pratik adds a `console.log` elsewhere and watches lint fail.
6. **Verify and ship.**

## Check understanding

- Why log the pathname and not the full URL?
- What's the risk of logging `req.headers`?

**Done when:** Pratik's PR is green, and they can answer the questions above.

**Out of scope:** log shipping and dashboards (Phase 10).
