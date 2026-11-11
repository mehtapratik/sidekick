---
publish: true
id: harness.agent-guide
title: Agent Guide
created: 2026-09-19
updated: 2026-11-11
kind: guidance
version: 1.6.0
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

The vault is `content/docs/`, in this repo. A change and the docs it makes false land in the same PR. Start with a narrow note for the task; do not load the entire vault.

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
- **You code it** only when Pratik asks, for work with no learning payoff, such as a presentational React component with CSS Modules. Say briefly what changed. Standing choice (Pratik, 2026-11-06): **you write the `@sidekick/ui` components** and Pratik reviews them ([[03-system-design/non-functional/css/native-ui|Native UI]]).
- **Never:** large unexplained changes, several pieces at once, or code landing in the repo before Pratik has agreed to it. Pratik picks the mode for each piece and can switch at any time. Plans may suggest which steps are worth writing yourself.

## Where things stand

- **Complete:** Phases 0, 1 and 1.1, [[04-phases/01-front-door/02-hardening/00-plan|Front Door]] (walkthrough in [[04-phases/01-front-door/02-hardening/01-walkthrough]]) and [[04-phases/02-gatekeeper/00-plan|Phase 2 — Gatekeeper]] (walkthrough in [[04-phases/02-gatekeeper/02-walkthrough]]). Every API route goes through `withApiGuard` (`@sidekick/core/api`); `ALL_FEATURES` is still empty, so no feature is granted yet.
- **Next:** [[04-phases/03-synergy/00-plan|Phase 3 — Synergy]], planned as lessons for part 3a (the store and its API), next [[04-phases/03-synergy/00-lessons/lesson-1-layer-folders/00-brief|lesson 1]]. [[04-phases/03-synergy/00-lessons/lesson-0-one-repo/01-walkthrough|Lesson 0]] (one repo) is complete: the vault, the writings and the public site live in this repo, and arkive.blog is served by the Cloudflare Worker `sidekick-www`. Part 3b is planned at Checkpoint 3a. Deferred follow-ups are in [[backlogged-unplanned]] (B6–B8 from Phase 2, B10–B14 from lesson 0).
- **Toolchain:** Node 24 (`.nvmrc` `24`, `engines.node` `24.x`, `engineStrict`), pnpm 12 through Corepack, TypeScript 6.0 (held below 6.1), ESLint 10 flat config with `eslint-plugin-import-x` and `eslint-plugin-boundaries` 7, Next.js 16, Vitest, PostgreSQL 17 in tests and CI. The public site (`apps/www`) is Astro 7, deployed with Wrangler 4 as a Cloudflare Worker.
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
pnpm ops:entitlements:grant --email <email> --all [--apply]
```

`db:generate`, `db:migrate` and `ops:*` need the root `.env.local`; `ops:*` scripts print a plan and write only with `--apply`. Never commit secrets. `test:integration` runs the RLS proof on a throwaway PostgreSQL 17 and needs its tools installed locally; it is never cached.

## Always true

- Do not invent product scope. Read the relevant PRD and phase note first.
- Preserve dependency direction ([[03-system-design/non-functional/monorepo/dependency-flow|dependency flow]]): apps, the registry, features, platform and foundation, top to bottom; a layer may import any layer below it, never one above it or a sibling in its own layer, and packages never import apps. `packages/ops` (privileged scripts) may import the registry, platform and foundation, and nothing may import it. `pnpm lint` enforces it.
- Mutations stay in the API layer. Every App Router route handler is wrapped in `withApiGuard` (lint rule `require-api-guard`); Server Actions, the Pages Router and custom `pageExtensions` are banned.
- User-data queries go through `withRLS`, the only public database entry point. Raw Drizzle and admin Supabase clients are server-only and lint-restricted to the wrappers that need them. The one privileged path is `packages/ops`'s `withPrivilegedDb` (`DATABASE_DIRECT_URL`, bypasses RLS), for dev seeds, provisioning and break-glass scripts only.
- Syncable entities use client-generated IDs and soft deletes; APIs are idempotent.
- User-visible copy belongs in `packages/copy` until lesson I1, then in each package's catalog ([[03-system-design/non-functional/content/internationalization|Internationalization]]). `@sidekick/ui` holds no words: labels are props.
- Project vocabulary lives in `content/docs/07-glossary/`, one page per term (D226). When a skill asks for `CONTEXT.md`, write or update the glossary page instead; never create a `CONTEXT.md`.
- **`apps/www` is temporary** ([[03-system-design/functional-design/05-public-site/00-overview|Public site]], D256): favour speed there. No CSS modules, no i18n, no extra strictness, and don't propose App-grade structure or tests for it. What still binds: the privacy and datum gates, `publish: true`, no URL changes, the `site` boundaries element, Prettier and green CI. Its replacement follows every rule.
- **UI is native first** (D255): use the platform (`dialog`, `popover`, `details`, native inputs and validation) before any library; Mantine leaves the App in lesson M1, so add no new Mantine component.
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

Everything about a phase lives in its folder under `04-phases/`, named by number and nickname (`03-synergy/`): `00-plan.md`, `02-walkthrough.md`, `03-notes.md`, and one `lessons/lesson-N-slug/` folder per lesson holding `00-brief.md`, `01-walkthrough.md` and `02-notes.md`. The number prefixes set the order in the site's folder view and don't appear in URLs. Write the step-by-step walkthrough, mark the plan note complete, and record learnings in `notes.md` (private, `publish: false`).

## Read the smallest relevant guidance

| Task                                   | Read first                                                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product scope / feature work           | [[04-phases/living-plan\|content/docs/04-phases/living-plan.md]]                                                                                                                                                                               |
| API, database, or security             | [[08-ai-coding-harness/database-and-security\|content/docs/08-ai-coding-harness/database-and-security.md]]                                                                                                                                     |
| Tooling or package layout              | [[08-ai-coding-harness/architecture-invariants\|content/docs/08-ai-coding-harness/architecture-invariants.md]]                                                                                                                                 |
| Environment or commands                | [[08-ai-coding-harness/commands-and-environment\|content/docs/08-ai-coding-harness/commands-and-environment.md]]                                                                                                                               |
| Why a rule exists, or what was decided | [[06-decisions/log\|content/docs/06-decisions/log.md]]                                                                                                                                                                                         |
| AI, context, or RAG                    | [[03-system-design/functional-design/03-ai/context-assembler\|Context Assembler]] → [[03-system-design/functional-design/01-core-drive/00-tiered-context-model\|tiered context]] → [[03-system-design/non-functional/rag/00-rag\|RAG]] |

For an unfamiliar cross-cutting task, use the [[tag-taxonomy|tag taxonomy]] to select notes before reading broadly.

When a document disagrees with code, identify and resolve the discrepancy before expanding the implementation. Update the vault note with a changed `version` when its contract changes.
