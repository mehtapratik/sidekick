---
title: TypeScript hoisting
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
  - typescript
  - pnpm
appliesTo: []
isSection: false
docId: decision.technical.typescript-hoisting
sourcePath: sources/docs/06-decisions/technical/typescript-hoisting.md
wordCount: 115
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**What we chose:** TypeScript in root `devDependencies` (`pnpm add -D -w typescript`), hoisted to all packages.

**Why:** The Next.js scaffolder installs TypeScript as a local dependency of `apps/web`. Without TypeScript at the root, all other packages (`packages/core`, `packages/ui`, etc.) fall back to whatever `tsc` binary is on the system PATH — which could be an old version that doesn't support `ES2022` target or `moduleResolution: "bundler"` (both require TypeScript 5+).

Installing TypeScript at the root ensures every package in the monorepo uses the same TypeScript version, hoisted from root `node_modules`.

**What "hoisting" means:** pnpm makes root-level packages available to all workspace packages by placing them in the root `node_modules`. Individual packages don't need their own copy.
