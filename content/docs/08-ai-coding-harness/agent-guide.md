---
publish: true
id: harness.agent-guide
created: 2026-09-19
kind: guidance
version: 1.0.0
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

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm format
pnpm prettier:check
pnpm db:generate
pnpm db:migrate
```

`db:generate` and `db:migrate` need the root `.env.local`. Never commit secrets.

## Always true

- Do not invent product scope. Read the relevant PRD and phase note first.
- Preserve dependency direction: `apps/* → packages/features/* → packages/core`; packages never import apps.
- Mutations stay in the API layer. User-data queries use the repository layer and RLS context.
- Drizzle and admin Supabase clients are server-only.
- Syncable entities use client-generated IDs and soft deletes; APIs are idempotent.
- User-visible copy belongs in `packages/copy`.
- Prefer Server Components; use Client Components only for necessary interactivity.

## Read the smallest relevant guidance

| Task                         | Read first                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product scope / feature work | [[04-plans/living-plan\|docs/04-plans/living-plan.md]]                                                                                                                                 |
| API, database, or security   | [[08-ai-coding-harness/database-and-security\|docs/08-ai-coding-harness/database-and-security.md]]                                                                                                                                                                                  |
| Tooling or package layout    | [[08-ai-coding-harness/architecture-invariants\|docs/08-ai-coding-harness/architecture-invariants.md]]                                                                                                                                                                              |
| Environment or commands      | [[08-ai-coding-harness/commands-and-environment\|docs/08-ai-coding-harness/commands-and-environment.md]]                                                                                                                                                                            |
| AI, context, or RAG          | [[03-system-design/functional-design/03-ai/context-assembler\|Context Assembler]] → [[03-system-design/functional-design/01-core-drive/00-tiered-context-model\|tiered context]] → [[03-system-design/non-functional/rag/00-rag\|RAG]] |

For an unfamiliar cross-cutting task, use the [[tag-taxonomy|tag taxonomy]] to select notes before reading broadly.

When a document disagrees with code, identify and resolve the discrepancy before expanding the implementation. Update the canonical Arkive vault note with a changed `version` when its contract changes.
