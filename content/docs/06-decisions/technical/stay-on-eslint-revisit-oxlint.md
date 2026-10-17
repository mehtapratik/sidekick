---
publish: true
id: decision.technical.stay-on-eslint-revisit-oxlint
created: 2026-10-16
updated: 2026-10-16
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - eslint
   - typescript
status: accepted
---

**What we chose:** stay on ESLint. Do not migrate to Oxlint — fully or as a hybrid — yet.

**Why — measured, October 2026:** a full `pnpm lint` takes about 7 s, but running every rule costs only 0.26–0.35 s per package. The rest is fixed startup: about 0.6 s of Node and plugin loading, and 1.1–1.6 s per package building the TypeScript program that type-aware rules (`no-floating-promises`, `no-misused-promises`, …) need. Adding rules is nearly free; the cost grows with codebase size, like `tsc`. Turborepo's cache replays unchanged packages, so day-to-day linting pays only for edited packages.

**Why not Oxlint now:**

- Oxlint's core is stable (v1.0, June 2025), and type-aware linting via tsgolint became stable in July 2026 — but tsgolint is built on TypeScript 7, and Sidekick is on TypeScript 5.9.
- Sidekick's most important lint protections are custom: the five `sidekick/*` rules (including `require-api-guard`) and `eslint-plugin-boundaries`. Running them in Oxlint requires its ESLint-compatible JS plugins, which are still alpha and cannot run type-aware rules.
- A hybrid (Oxlint for native rules, `eslint-plugin-oxlint` disabling them in ESLint) saves only the ~0.3 s of rule time, because the expensive TypeScript program stays in ESLint — two linters to maintain for little gain.

**Revisit when any of these happens:**

1. Oxlint's JS plugins reach stable, so custom rules and `eslint-plugin-boundaries` can move safely.
2. Sidekick moves to TypeScript 7, so type-aware rules can run on tsgolint — where the real time is.
3. ESLint becomes a real bottleneck: more than about 30 s locally on changed packages, or lint visibly slowing CI.

**Sources:** [Oxc: type-aware linting stable](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable), [Oxc: JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins), [Oxc: built-in plugins](https://oxc.rs/docs/guide/usage/linter/plugins).
