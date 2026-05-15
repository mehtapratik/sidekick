---
title: Home
nav_order: 1
---

# Sidekick — Documentation

This is the internal documentation site for the Sidekick monorepo. It covers architecture decisions, implementation plans, and learning references for the technologies used.

---

## Project

| Document | Description |
|---|---|
| [Architecture Overview](learn/01-architecture-overview.md) | Why we built Sidekick the way we did — the reasoning behind key structural choices |
| [Architecture Handover](architecture-handover.md) | Canonical reference for the current architecture — package structure, conventions, invariants |
| [Implementation Plan](implementation-plan.md) | Phase-by-phase roadmap with completion status |

---

## Decisions

Concise records of non-obvious choices with rationale. Read these before changing anything they cover.

| Document | Covers |
|---|---|
| [Auth](decisions/auth.md) | Profile creation via Postgres trigger, session strategy |
| [Supabase & API](decisions/supabase-and-api-related.md) | Client separation, RLS, `withApiGuard`, deferred decisions |
| [Tooling](decisions/tooling-decisions.md) | pnpm, Turborepo, ESLint, tsup, CSS modules, `dotenv-cli` |
| [Copy](decisions/copy.md) | `packages/copy` — centralised user-visible strings |
| [Standards & Guidelines](decisions/standards-and-guidelines.md) | Naming, file structure, export conventions |
| [Error Handling & Instrumentation](decisions/error-handling-and-instrumentation.md) | `console.error` → Sentry deferral strategy |

---

## Learning References

Concept explainers for the technologies used. Aimed at someone who is building their backend and full-stack knowledge through this project.

| Document | Covers |
|---|---|
| [Supabase](learn/supabase.md) | Pooler vs direct connections, the four clients, RLS, `withRLS`, Postgres triggers, hydration mismatch |
| [Auth](learn/auth.md) | Authentication vs authorisation, JWTs, cookies, OAuth, the full Sidekick auth flow |
| [Next.js](learn/nextjs.md) | Server vs Client Components, route groups, `redirect` vs `push`, `force-dynamic`, the serialisation boundary |
| [TypeScript](learn/typescript.md) | `moduleResolution` modes, `tsc` vs `tsup`, `--noEmit`, barrel files, named vs default exports |
| [Tooling](learn/tooling.md) | pnpm flags, Turborepo task graph, `dotenv-cli`, ESLint flat config, `exports` subpaths |
| [Packages](learn/packages.md) | `exports` field, `workspace:*`, pnpm hoisting, `devDependencies` vs `peerDependencies` |
| [Vercel](learn/vercel.md) | Logging as primitive instrumentation, env var split, deployment flow |

---

## Do It Yourself — Walkthroughs

Step-by-step build guides. Each walkthrough rebuilds a phase from scratch in its correct final form — no backtracking, with a "what and why" note on every step. Use these to reinforce understanding or to rebuild after resetting a branch.

### Phase 0 — Foundation and Tooling

| Document | Covers |
|---|---|
| [Config Files Explained](learn/diy/phase-0-foundation-and-tooling/00-config-files-explained.md) | Every config file in the initial skeleton and what it does |
| [Checkpoint A](learn/diy/phase-0-foundation-and-tooling/01-checkpoint-a-walkthrough.md) | Monorepo init, pnpm workspace, Turborepo |
| [Checkpoint B](learn/diy/phase-0-foundation-and-tooling/02-checkpoint-b-walkthrough.md) | TypeScript strict mode, shared tsconfig |
| [Checkpoint C](learn/diy/phase-0-foundation-and-tooling/03-checkpoint-c-walkthrough.md) | ESLint with boundary enforcement |
| [Checkpoint D](learn/diy/phase-0-foundation-and-tooling/04-checkpoint-d-walkthrough.md) | Prettier, Stylelint, CI scripts |

### Phase 1 — Supabase & Auth Shell

| Document | Covers |
|---|---|
| [Walkthrough](learn/diy/phase-1/walkthrough.md) | 24 tasks: Supabase clients, Drizzle schema, RLS, proxy.ts, login/signup/dashboard, ESLint plugin, Vercel deployment |

---

## Implementation Plans (Archived)

Full pre-implementation plans saved for reference. These reflect the intended design at planning time — see the implementation plan for what was actually built.

| Document | Phase |
|---|---|
| [Phase 0 Plan](plans/phase-0-foundation-and-tooling.md/sidekick-phase0_plan.md) | Foundation and tooling |
| [Phase 1 Plan](plans/phase-1-supabase-and-auth-shell/sidekick-phase1_plan.md) | Supabase auth shell |
