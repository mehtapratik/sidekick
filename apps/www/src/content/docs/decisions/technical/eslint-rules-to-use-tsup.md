---
title: ESLint rules to use tsup
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: decision
status: approved
version: 1.0.0
tags:
  - decisions
  - technical
  - architecture-decision
  - nextjs
  - eslint
appliesTo: []
isSection: false
docId: decision.technical.eslint-rules-to-use-tsup
sourcePath: sources/docs/06-decisions/technical/eslint-rules-to-use-tsup.md
wordCount: 102
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**What we chose:** `tsup` to compile `packages/eslint-plugin-sidekick` instead of running `tsc` directly.

**Why:** ESLint plugins must be loaded by Node.js at lint time. Node.js cannot load `.ts` files — it needs compiled `.js` (specifically CommonJS format). `tsc` with `moduleResolution: bundler` produces ESM output by default. `tsup` handles the CJS/ESM output format correctly, handles the compilation in one command, and doesn't require a separate tsconfig for the emit target. It is simpler and produces the right output format.

**Note:** This is the only place in the repo that uses `tsup`. All other packages are compiled by their consumers (Next.js, or the test runner).
