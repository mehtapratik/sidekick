---
id: plan.post-mvp-factory-extensions-bots-agents
created: 2026-09-19
kind: plan
version: 1.0.0
status: deferred
tags:
   - plan
   - living-plan
   - backlog
   - factory
   - parrot
   - api-guard
   - rls
   - supabase
   - drizzle
---

> **Milestone:** Factory grows beyond push-button workflows: triggered and recurring automations, inbox management, IoT integrations. External agents interact with your data via the public API. Parrot (voice dictation) also lives here.
> **Learning payoff:** Agent interoperability, webhook-driven automation, workflow design patterns.

| #    | Task                                                                                             | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------ | ---------- | -------- |
| PM.1 | Extend the Factory `workflows` schema with trigger types (schedule, event) beyond manual buttons | 🔴         | 🗄️       |
| PM.2 | Implement a simple recurring workflow — e.g., weekly digest of knowledge sources emailed to self | 🟡         | 🧩       |
| PM.3 | Add webhook ingest endpoint — external services can push events to the app                       | 🔴         | 🔐 🧩    |
| PM.4 | Document the public API surface for agents — OpenAPI spec or equivalent                          | 🟡         | 🖥️       |
| PM.5 | Evaluate Inngest for durable workflows if complexity warrants it                                 | 🟡         |          |
| PM.6 | Add agent-friendly scoped API keys for automation use cases                                      | 🟡         | 🔐       |
| PM.7 | Inbox management automations (email/message triage) per the Factory PRD                          | 🔴         | 🧩       |
| PM.8 | IoT integrations (blinds, garage door) per the Factory PRD                                       | 🔴         | 🧩       |
| PM.9 | **Parrot** — voice dictation with gesture support for punctuation/formatting (own PRD first)     | 🔴         | 📱       |

---

## Recommended Learning Order

If you're new to some of the tech in this stack, here's the minimum viable reading before each phase:

| Before Phase | Read / Watch                                                                         |
| ------------ | ------------------------------------------------------------------------------------ |
| Phase 0      | Turborepo docs getting started; pnpm workspaces                                      |
| Phase 1      | Supabase Auth docs; Next.js App Router docs (routing, middleware, server components) |
| Phase 2      | Next.js Route Handlers; how middleware chains work                                   |
| Phase 3      | Recursive CTEs in PostgreSQL; modeling graphs in relational databases                |
| Phase 4      | Drizzle ORM quickstart; PostgreSQL RLS basics; command-palette UX patterns (cmdk)    |
| Phase 5      | Tiptap getting started; `@mantine/tiptap` docs                                       |
| Phase 6      | pgvector README; Vercel AI SDK docs (incl. provider registry); Anthropic API docs    |
| Phase 8      | Serwist docs; Capacitor iOS quickstart                                               |
| Phase 9      | Node.js CLI patterns (commander.js); API key security best practices                 |
| Phase 12     | Stripe docs: Checkout, webhooks, customer portal                                     |

---

## Architectural Invariants to Review After Every Phase

Before moving to the next phase, verify:

- [ ] Every new API route uses `withApiGuard()`
- [ ] No `packages/*` imports from `apps/*`
- [ ] Every new user-owned table has RLS enabled with the canonical combined policy (user isolation + soft-delete in one USING clause)
- [ ] Every new syncable table has `no_hard_delete_[table]` and `no_update_deleted_[table]` triggers applied
- [ ] Every new table with user content uses `withRLS()` via the guard, not inline
- [ ] All mutations go through the repository layer
- [ ] Syncable tables include `createdAt`, `updatedAt`, `deletedAt`
- [ ] Soft deletes only — no hard deletes on user data
- [ ] All queries on syncable tables filter `where(isNull(table.deletedAt))`
- [ ] Content tables in the embedding pipeline have `embeddingStatus`
- [ ] `DATABASE_URL` connects as `app_runtime` (not superuser) — verify if changing connection config

---

## Rough Effort Estimates (Solo, AI-assisted, Learning pace)

| Phase    | Estimated Sessions | Notes                                          |
| -------- | ------------------ | ---------------------------------------------- |
| Phase 0  | 2–3 sessions       | Mostly config, fast with AI help ✅            |
| Phase 1  | 3–5 sessions       | Auth has depth; worth going slow ✅            |
| Phase 2  | 2–4 sessions       | Conceptually dense; revisit often              |
| Phase 3  | 3–5 sessions       | Graph modeling + first full vertical           |
| Phase 4  | 5–7 sessions       | Highest learning payoff; includes the palette  |
| Phase 5  | 2–4 sessions       | Tiptap is well-documented                      |
| Phase 6  | 8–12 sessions      | Most technically complex; three sub-phases     |
| Phase 7  | 3–5 sessions       | Two smaller features on established patterns   |
| Phase 8  | 2–4 sessions       | Mostly config and testing                      |
| Phase 9  | 3–5 sessions       | CLI is fun; API key crypto needs care          |
| Phase 10 | 2–3 sessions       | Audit work; methodical                         |
| Phase 11 | 2–3 sessions       | Optional; satisfying milestone                 |
| Phase 12 | 4–6 sessions       | Optional; Stripe webhooks need careful testing |
| Post-MVP | Open-ended         | Exploratory; do when ready                     |

> Sessions are loosely defined as focused 2–3 hour working blocks. Estimates assume you're reviewing every line and asking questions — that's the point.

---
