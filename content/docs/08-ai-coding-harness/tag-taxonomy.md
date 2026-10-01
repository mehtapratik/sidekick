---
publish: true
id: harness.tag-taxonomy
created: 2026-09-19
kind: guidance
version: 1.0.0
tags:
   - ai-coding
   - agent-guidance
   - taxonomy
   - discovery
---

# Tag taxonomy

Use frontmatter tags to find the smallest authoritative set of notes for a task. Tags are lower-kebab-case, additive, and limited to high-signal concepts.

## Tag groups

- **Domain:** `api`, `database`, `security`, `authentication`, `monorepo`, `nextjs`, `ai`, `rag`, `observability`, `cli`, `pwa`.
- **Technology:** `supabase`, `drizzle`, `postgresql`, `typescript`, `eslint`, `prettier`, `pnpm`, `turborepo`, `vercel`, `mantine`.
- **Cross-cutting constraint:** `rls`, `api-guard`, `soft-delete`, `idempotency`, `repository-pattern`, `embeddings`, `graph`.
- **Product module:** `taxila`, `zinsser`, `core-drive`, `alter-ego`, `war-room`, `factory`, `parrot`.
- **Document role:** `prd`, `plan`, `architecture-decision`, `guidance`, `glossary`, `opportunity`, `moc`.

`private` marks principles and motivations that must never be selected for Arkive publication.

## Retrieval rules

1. Filter by a domain and a document role first, such as `api` + `architecture-decision`.
2. Read the matching MOC before detailed notes if the task crosses a system boundary.
3. Follow `applies_to`, `depends_on`, `supersedes`, and `aliases` when present.
4. Prefer a current canonical note over a similarly named historical note.
5. Add a tag only when it makes a future task query materially narrower; do not add generic tags such as `implementation`.
