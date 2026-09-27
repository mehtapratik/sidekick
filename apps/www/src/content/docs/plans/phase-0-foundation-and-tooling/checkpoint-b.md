---
title: Checkpoint b
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: built
version: 1.0.0
tags:
  - plan
  - phase-0
  - checkpoint
  - eslint
  - prettier
  - turborepo
  - pnpm
appliesTo: []
isSection: false
docId: plan.phase-0.checkpoint-b
sourcePath: sources/docs/04-plans/phase-0-foundation-and-tooling/checkpoint-b.md
wordCount: 123
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Add root shared TS config (`tsconfig.base.json`) and ensure all packages extend it.
- Add ESLint + Prettier:
   - choose a monorepo-friendly setup (either root config shared by all packages, or a `packages/eslint-config-*` shared config package)
   - wire into `turbo.json` and `package.json` scripts.
- Add **automated dependency-boundary enforcement** for the critical architectural constraint: **`packages/*` MUST NEVER import from `apps/*`**.
   - Enforce via an ESLint rule (preferred) using an import boundary approach (e.g. `eslint-plugin-boundaries`, `eslint-plugin-import` with `no-restricted-paths`, or equivalent) rather than convention.
   - Define the rule so it fails CI/local lint when any file under `packages/**` imports from `apps/**`.
   - Record the chosen enforcement approach and rationale in `docs/decisions/phase-0.md`.

**Checkpoint B exit**: `pnpm turbo lint` and `pnpm turbo typecheck` run successfully across the workspace.
