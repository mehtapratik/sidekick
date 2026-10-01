---
publish: true
id: decision.technical.eslint-rules-to-use-tsup
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - nextjs
   - eslint
status: accepted
---

**What we chose:** `tsup` to compile `packages/eslint-plugin-sidekick` instead of running `tsc` directly.

**Why:** ESLint plugins must be loaded by Node.js at lint time. Node.js cannot load `.ts` files — it needs compiled `.js` (specifically CommonJS format). `tsc` with `moduleResolution: bundler` produces ESM output by default. `tsup` handles the CJS/ESM output format correctly, handles the compilation in one command, and doesn't require a separate tsconfig for the emit target. It is simpler and produces the right output format.

**Note:** This is the only place in the repo that uses `tsup`. All other packages are compiled by their consumers (Next.js, or the test runner).
