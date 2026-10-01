---
publish: true
id: plan.phase-0.checkpoint-b
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-0
   - checkpoint
   - eslint
   - prettier
   - turborepo
   - pnpm
status: completed
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
