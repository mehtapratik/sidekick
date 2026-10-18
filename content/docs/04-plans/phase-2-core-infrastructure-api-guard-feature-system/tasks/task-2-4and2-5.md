---
publish: true
id: plan.phase-2.task-2-4and2-5
title: "Lesson 5 (tasks 2.4, 2.5): request and auth-failure logging"
created: 2026-10-18
updated: 2026-10-18
kind: plan
version: 2.0.0
tags:
   - plan
   - phase-2
   - task
   - api-guard
   - observability
   - eslint
status: planned
---

> **Lesson 5 of 8.** Before this: [[task-2-2and2-3|lesson 4]]. Next: [[task-2-11and2-12|lesson 6]]. The coach follows [[contracts#Coaching rules|the coaching rules]]. The answer key is [[contracts#Logging|Logging]].

**What Pratik builds:** a tiny structured logger, and log lines from `withApiGuard` for every request, every 401 and 403, and every 500.

**Concepts:** structured logs vs. free-text logs, what must never be logged (PII, tokens, cookies), measuring latency, ESLint per-file overrides in flat config, and spying in tests.

**Coach reads first:** [[contracts]], [[03-system-design/non-functional/observability/centralized|centralized observability]], [[error-handling]], Pratik's `guard.ts` from lesson 4.

## Steps

1. **Why structured.** Show the same event as a free-text line and as a JSON line. Ask which one a machine can search.
2. **Design the events.** Ask: "Which fields would you want when debugging a 403 at 2am? Which fields must never appear?" Pratik lists them, then compares with the contract.
3. **The logger.** Pratik writes `src/observability/log.ts`, runs `pnpm lint` inside `packages/core`, and hits `no-console`. Teach the per-file override in `eslint.config.js`, and why it applies to this one file only.
4. **Wire it in.** Pratik adds the logger calls in `withApiGuard` and measures latency with `performance.now()`.
5. **Test it.** Pratik spies on the logger in `guard.test.ts`. The tests check the fields per event, that `path` has no query string, and that no cookie or token is logged. Pratik adds a `console.log` elsewhere and watches lint fail.
6. **Verify and ship.**

## Check understanding

- Why log the pathname and not the full URL?
- What's the risk of logging `req.headers`?

**Done when:** Pratik's PR is green, and they can answer the questions above.

**Out of scope:** log shipping and dashboards (Phase 10).
