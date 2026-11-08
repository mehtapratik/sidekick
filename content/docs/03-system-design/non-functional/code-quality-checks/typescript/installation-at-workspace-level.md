---
publish: true
id: system-design.non-functional.code-quality-checks.typescript.installation-at-workspace-level
title: Installation at Workspace Level
created: 2026-09-19
updated: 2026-11-08
kind: spec
version: 1.1.1
tags:
   - system-design
   - code-quality-check
   - typescript
   - pnpm
---

**D51** `decision` #typescript #monorepo: TypeScript is a root `devDependency`, so every package uses the same version.

**What we chose:** TypeScript in root `devDependencies` (`pnpm add -D -w typescript`), hoisted to all packages.

**Why:** The Next.js scaffolder installs TypeScript as a local dependency of `apps/app`. Without TypeScript at the root, all other packages (`packages/core`, `packages/ui`, etc.) fall back to whatever `tsc` binary is on the system PATH — which could be an old version that doesn't support `ES2022` target or `moduleResolution: "bundler"` (both require TypeScript 5+).

Installing TypeScript at the root ensures every package in the monorepo uses the same TypeScript version, hoisted from root `node_modules`.

**What "hoisting" means:** pnpm makes root-level packages available to all workspace packages by placing them in the root `node_modules`. Individual packages don't need their own copy.

## Decision History

- 2026-09-19 · accepted · TypeScript Hoisting
