---
publish: true
id: harness.agent-guide
created: 2026-09-19
updated: 2026-10-18
kind: guidance
version: 1.2.1
tags:
   - ai-coding
   - agent
   - gateway
   - agent-guidance
   - rls
   - supabase
   - drizzle
   - api
   - react
   - prettier
---

# Sidekick coding guide

`docs/` is a symlink to Arkive's canonical Sidekick vault. Edit documentation in the Arkive repository, never through a copied local source. Start with a narrow note for the task; do not load the entire vault.

## Working with Pratik

Pratik builds Sidekick to learn full-stack development. The goal is to build fast without vibe coding: Pratik must know what is in the product, how it works and why. This applies to every session, whatever the task.

- **Default: one explained piece at a time.** Hand over a small piece of implementation (one function, one migration, one config block, one test file). Below it, explain what it does and why: the concept, how it fits Sidekick, and the alternatives you rejected. Then discuss it with Pratik. It's final only when Pratik agrees, and only then do you move on to the next piece. Explain in the most depth for:
   1. Supabase and Drizzle
   2. authentication
   3. repo setup
   4. DevOps and CI/CD
   5. Next.js, Tiptap and Mantine
   6. AI, RAG and the Vercel AI SDK
   7. hosting
- **Pratik writes it** when Pratik calls a piece core functionality, an important concept or something new to them. Teach instead of writing it: explain, let Pratik design and write it, then review. When Pratik is stuck, give the smallest hint first (a question, then a pointer, then a fragment), and the full answer only when asked.
- **You code it** only when Pratik asks, for work with no learning payoff, such as a presentational React component with Mantine and CSS Modules. Say briefly what changed.
- **Never:** large unexplained changes, several pieces at once, or code landing in the repo before Pratik has agreed to it. Pratik picks the mode for each piece and can switch at any time. Plans may suggest which steps are worth writing yourself.

## Where things stand

- **Complete:** Phases 0, 1 and 1.1, and [[04-plans/pre-2-foundation-hardening-complete|Pre-2 — Foundation Hardening]] (all 13 tasks, walkthrough in [[05-builds/pre-2-walkthrough]]).
- **Next:** [[04-plans/phase-2-core-infrastructure-api-guard-feature-system|Phase 2]], as eight lessons taken one at a time (feature registry, `resolveApiCaller`, entitlements, `withApiGuard`, logging, `/api/health`, seed, write-up). Its gate is met. Lesson 1 (feature registry) is merged ([sidekick#9](https://github.com/mehtapratik/sidekick/pull/9)); lesson 2 (`resolveApiCaller`) is next.
- **Toolchain:** Node 24 (`.nvmrc` `24`, `engines.node` `24.x`, `engineStrict`), pnpm 11 through Corepack, TypeScript 6.0 (held below 6.1), ESLint 10 flat config with `eslint-plugin-import-x` and `eslint-plugin-boundaries` 7, Next.js 16, Vitest, PostgreSQL 17 in tests and CI.
- **Feature packages:** none exist yet. They go in `packages/features/*`; add that glob to `pnpm-workspace.yaml` with the first one.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm format
pnpm prettier:check
pnpm test
pnpm test:integration
pnpm db:generate
pnpm db:migrate
```

`db:generate` and `db:migrate` need the root `.env.local`. Never commit secrets. `test:integration` runs the RLS proof on a throwaway PostgreSQL 17 and needs its tools installed locally; it is never cached.

## Always true

- Do not invent product scope. Read the relevant PRD and phase note first.
- Preserve dependency direction: `apps/* → packages/features-registry → packages/features/* → foundation (core, ui, copy)`; packages never import apps. `pnpm lint` enforces it.
- Mutations stay in the API layer. Every App Router route handler is wrapped in `withApiGuard` (lint rule `require-api-guard`); Server Actions, the Pages Router and custom `pageExtensions` are banned.
- User-data queries go through `withRLS`, the only public database entry point. Raw Drizzle and admin Supabase clients are server-only and lint-restricted to the wrappers that need them.
- Syncable entities use client-generated IDs and soft deletes; APIs are idempotent.
- User-visible copy belongs in `packages/copy`.
- Prefer Server Components; use Client Components only for necessary interactivity.

## How changes land

- `main` accepts changes only through a branch and pull request. The CI `checks` job (`prettier:check`, `lint`, `typecheck`, `build`, `test`, `test:integration`) must pass; merges are squash-only.
- Husky + lint-staged run Prettier on staged files before each commit.
- Renovate opens dependency PRs every Monday: minor and patch grouped and auto-merged on green `checks`, majors one PR each for review ([Dependency Dashboard](https://github.com/mehtapratik/sidekick/issues/6)). Do not hand-bump what `renovate.json` holds back: Node is never updated by Renovate, `@types/node` stays on 24.x, TypeScript stays below 6.1.

## Verify the way it really runs

- After a toolchain or config change, bypass Turbo's cache (`pnpm turbo build --force`, likewise `lint`, `typecheck`). A cached result hid a TypeScript 6 build failure; CI has no cache.
- Probe a lint rule through `pnpm lint`, which runs ESLint from inside each package, not from the repo root. Boundaries enforced nothing until `boundaries/root-path` was set, while root-level probes passed.
- Prove a guard by watching it fail. The RLS proof caught `max_pipeline: 0` breaking every transaction; only `prepare: false` stays in the pooler config.

## At the end of a phase

Write a step-by-step walkthrough in `05-builds/`, mark the plan note complete, and record learnings in `09-notes/` (private, `publish: false`).

## Read the smallest relevant guidance

| Task                         | Read first                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product scope / feature work | [[04-plans/living-plan\|docs/04-plans/living-plan.md]]                                                                                                                                                                                 |
| API, database, or security   | [[08-ai-coding-harness/database-and-security\|docs/08-ai-coding-harness/database-and-security.md]]                                                                                                                                     |
| Tooling or package layout    | [[08-ai-coding-harness/architecture-invariants\|docs/08-ai-coding-harness/architecture-invariants.md]]                                                                                                                                 |
| Environment or commands      | [[08-ai-coding-harness/commands-and-environment\|docs/08-ai-coding-harness/commands-and-environment.md]]                                                                                                                               |
| AI, context, or RAG          | [[03-system-design/functional-design/03-ai/context-assembler\|Context Assembler]] → [[03-system-design/functional-design/01-core-drive/00-tiered-context-model\|tiered context]] → [[03-system-design/non-functional/rag/00-rag\|RAG]] |

For an unfamiliar cross-cutting task, use the [[tag-taxonomy|tag taxonomy]] to select notes before reading broadly.

When a document disagrees with code, identify and resolve the discrepancy before expanding the implementation. Update the canonical Arkive vault note with a changed `version` when its contract changes.
