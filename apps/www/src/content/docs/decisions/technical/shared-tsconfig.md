---
title: Shared tsconfig
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
  - cli
appliesTo:
  - >-
    03-system-design/non-functional/code-quality-checks/typescript/shared-tsconfig
isSection: false
docId: decision.technical.shared-tsconfig
sourcePath: sources/docs/06-decisions/technical/shared-tsconfig.md
wordCount: 84
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**What we chose:** A single `tsconfig.base.json` at the repo root that all packages extend.

**Why:** Without a shared base, every package repeats the same 6-7 `compilerOptions`. When you need to change a setting (e.g. upgrading `target` from `ES2022` to `ES2024`), you'd have to update every package's `tsconfig.json` individually. With a shared base, one change propagates everywhere.

Each package's `tsconfig.json` only declares what's unique to it:

- `packages/*` and `apps/cli` — just `outDir` and `include`
- `apps/web` — Next.js-specific options (`noEmit`, `jsx`, `plugins`, `paths`, etc.)
