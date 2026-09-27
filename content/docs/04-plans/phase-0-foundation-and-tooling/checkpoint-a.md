---
id: plan.phase-0.checkpoint-a
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-0
   - checkpoint
   - nextjs
   - typescript
   - turborepo
   - pnpm
   - cli
status: completed
---

- Initialize repo at `/Users/pratikgmehta/Projects/sidekick`:
   - run `git init`
   - add a standard `.gitignore` tailored for Node + Next.js + Turborepo (including things like `node_modules/`, `.next/`, `dist/`, `.turbo/`, `.env*.local`, etc.)
- Create pnpm workspace config at root (`pnpm-workspace.yaml`).
- Enforce pnpm usage for tooling/deploy detection by setting `packageManager` in the root `package.json` (e.g. `"packageManager": "pnpm@<version>"`).
- Add Turborepo root config (`turbo.json`) with pipelines: `build`, `dev`, `lint`, `typecheck`.
- Create packages (initially minimal):
   - `apps/web` (Next.js 15 App Router, TypeScript strict)
   - `apps/cli` (bare TS package)
   - `packages/core` (empty TS package)
   - `packages/ui` (empty TS package)
   - `packages/features-registry` (empty TS package)

**Checkpoint A exit**: `pnpm -w install` succeeds; `pnpm turbo lint`/`typecheck` are wired (may be no-ops initially), repo structure matches the architecture doc’s `apps/` + `packages/` layout.
