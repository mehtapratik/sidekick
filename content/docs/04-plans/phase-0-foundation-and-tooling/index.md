---
id: moc.plan.phase-0
created: 2026-09-19
kind: guidance
version: 1.0.0
tags:
   - moc
   - plan
   - phase-0
   - api
   - nextjs
   - typescript
   - eslint
   - turborepo
   - pnpm
status: completed
---

# Phase 0 — Foundation and tooling

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

## Checkpoints

- [[checkpoint-a|Session checkpoint A — Repo + monorepo scaffold (0.1–0.7)]]
- [[checkpoint-b|Session checkpoint B — Shared TypeScript + lint/format conventions (0.8–0.9)]]
- [[checkpoint-c|Session checkpoint C — Local dev success criteria + docs (0.12–0.13)]]
- [[checkpoint-d|Session checkpoint D — Environment variable template + Vercel linkage (0.10–0.11)]]
