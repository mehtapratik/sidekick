---
publish: true
id: system-design.non-functional.code-quality-checks.eslint.tsup
title: tsup
created: 2026-09-19
updated: 2026-11-14
kind: spec
version: 1.2.0
tags:
   - system-design
   - code-quality-check
   - eslint
---

**D41** `decision` #eslint #tooling: The ESLint plugin package compiles with `tsup`, because Node must load compiled CommonJS at lint time.

**What we chose:** `tsup` to compile `packages/eslint-plugin-sidekick` instead of running `tsc` directly.

**Why:** ESLint plugins must be loaded by Node.js at lint time. Node.js cannot load `.ts` files — it needs compiled `.js` (specifically CommonJS format). `tsc` with `moduleResolution: bundler` produces ESM output by default. `tsup` handles the CJS/ESM output format correctly, handles the compilation in one command, and doesn't require a separate tsconfig for the emit target. It is simpler and produces the right output format.

**Note:** This is the only place in the repo that uses `tsup`. All other packages are compiled by their consumers (Next.js, or the test runner).

**Consequence:** the root `eslint.config.js` loads the plugin from `dist/`, so a rule change reaches nothing until the plugin is rebuilt. `pnpm lint` builds it first through Turbo. An editor's ESLint server loads it once and keeps it: after a rebuild, restart the server (**ESLint: Restart ESLint Server**), or a newly configured rule makes it stop linting the files that rule covers, silently ([[08-ai-coding-harness/commands-and-environment|Commands and environment]]).

## Decision History

- 2026-09-19 · accepted · ESLint Rules to Use tsup
