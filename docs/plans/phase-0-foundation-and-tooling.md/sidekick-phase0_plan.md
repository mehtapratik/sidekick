---
title: Phase 0 — Foundation & Tooling
---

# Phase 0 — Foundation & Tooling: Implementation Plan

Stand up Phase 0’s monorepo skeleton so that `pnpm turbo build` succeeds and `pnpm turbo dev` starts `apps/web` from the repo root, with a correct package dependency graph.

## Constraints from the architecture handover (must hold from day 1)

- **No imports from `apps/*` inside `packages/*`** (dependency direction is `apps/*` → `packages/features/*` → `packages/core`).
- **API-first is the long-term contract**, but Phase 0 only lays tooling/folders (no API implementation yet).

## Persistence between sessions (how we’ll resume reliably)

- Create a repo-local progress log (e.g. `docs/progress/phase-0.md`) that contains:
  - the Phase 0 checklist (0.1–0.13)
  - per-task notes (commands run, links, decisions, gotchas)
  - a “next step” pointer so we can restart instantly next day
- Create a **mandatory decision log** at `docs/decisions/phase-0.md` capturing **non-obvious choices** as a historical record (e.g., ESLint preset strategy, TypeScript `tsconfig` strategy, boundary enforcement approach, Turborepo pipeline choices).

## Phase 0 work breakdown (phasewise + resumable checkpoints)

### Session checkpoint A — Repo + monorepo scaffold (0.1–0.7)

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

### Session checkpoint B — Shared TypeScript + lint/format conventions (0.8–0.9)

- Add root shared TS config (`tsconfig.base.json`) and ensure all packages extend it.
- Add ESLint + Prettier:
  - choose a monorepo-friendly setup (either root config shared by all packages, or a `packages/eslint-config-*` shared config package)
  - wire into `turbo.json` and `package.json` scripts.
- Add **automated dependency-boundary enforcement** for the critical architectural constraint: **`packages/*` MUST NEVER import from `apps/*`**.
  - Enforce via an ESLint rule (preferred) using an import boundary approach (e.g. `eslint-plugin-boundaries`, `eslint-plugin-import` with `no-restricted-paths`, or equivalent) rather than convention.
  - Define the rule so it fails CI/local lint when any file under `packages/**` imports from `apps/**`.
  - Record the chosen enforcement approach and rationale in `docs/decisions/phase-0.md`.

**Checkpoint B exit**: `pnpm turbo lint` and `pnpm turbo typecheck` run successfully across the workspace.

### Session checkpoint C — Local dev success criteria + docs (0.12–0.13)

- Ensure `pnpm turbo dev` starts the Next.js app from repo root.
- Ensure `pnpm turbo build` completes without errors.
- Add root `README.md` describing:
  - a 1–2 paragraph blurb explaining what the `sidekick` application is about (product intent / high-level scope)
  - install + dev/build commands
  - workspace conventions
  - how to add a new app/package without breaking dependency rules

**Checkpoint C exit**: Phase 0 exit criteria met locally.

### Session checkpoint D — Environment variable template + Vercel linkage (0.10–0.11)

- Add an environment template file (avoid committing secrets):
  - document **all variables listed in the architecture handover §20.1**, explicitly including:
    - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
    - AI Providers: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
    - Billing/Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
    - App: `NEXT_PUBLIC_APP_URL`
  - clarify which are needed now vs later phases
- Commit + push to GitHub **before** linking Vercel:
  - create a GitHub repo
  - make an initial commit
  - push the repository (Vercel will pull source via the Git provider)
- Set up Vercel project:
  - link repo to Vercel
  - configure environment variables in Vercel dashboard (values may be placeholders until Phase 1/6/11)
  - confirm build command / root directory / framework detection works for the monorepo.

**Checkpoint D exit**: Vercel project is linked and can build `apps/web` (even if runtime features are not configured yet).

## Verification steps (done at each checkpoint)

- `pnpm turbo build`
- `pnpm turbo dev` (web starts)
- dependency-boundary enforcement is automated (lint fails if `packages/*` imports from `apps/*`).

## Primary files we’ll create/touch in Phase 0

- Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslint*`, `.prettierrc*`, `README.md`
- Apps: `apps/web/*`, `apps/cli/*`
- Packages: `packages/core/*`, `packages/ui/*`, `packages/features-registry/*`
- Persistence: `docs/progress/phase-0.md`, `docs/decisions/phase-0.md`

### Out of scope for Phase 0 (explicitly)

- Supabase project creation, auth, RLS, Drizzle migrations orchestration (`pnpm db:migrate`) — starts Phase 1.
- Implementing `withApiGuard`, feature entitlements, or any `/api/v1/*` routes — starts Phase 2.
