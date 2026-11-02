---
publish: true
title: Living Implementation Plan
id: plan.living
created: 2026-09-19
updated: 2026-11-01
kind: plan
version: 1.0.3
tags:
   - plan
   - living-plan
   - taxila
   - zinsser
   - alter-ego
   - war-room
   - factory
   - parrot
   - core-drive
---

# Living implementation plan

> Document Type: Master and Living Implementation Plan
> Context: Solo developer, hobby-to-business trajectory, AI-assisted with full code review
> Based on: System design and the high-level PRD (product requirements)

---

## Plan ↔ PRD Traceability

Product truth lives in `02-prd/` (the high-level PRD plus per-feature PRDs written before each feature's phase starts). This table maps PRD modules to plan phases; when a PRD changes, this table and the affected phases are revised — never the completed foundation phases.

| PRD Module         | Phase(s)                                   | Notes                                                                        |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| _(infrastructure)_ | 0, 1, 1.1, 2, 3                            | Product-agnostic: monorepo, auth, RLS, API guard, Synergy                    |
| Taxila             | 4                                          | Absorbs "Notes" and "Bookmarks" (bookmark = knowledge source of type `link`) |
| Zinsser            | 5 (editor), post-6 (AI coach)              | Editor first; coach depends on AI layer                                      |
| Core Drive         | 6                                          | Separate feature for now; may fold into Taxila later (see architecture §5.2) |
| Alter Ego          | 6                                          | Grounded in Core Drive + Taxila RAG                                          |
| War Room           | 7                                          | Tasks / planning entity                                                      |
| Factory            | 7 (push-button workflows), post-MVP (rest) | MVP scope per PRD: push-button workflows + input defaults                    |
| Parrot             | —                                          | Post-MVP, backlogged                                                         |

**Changelog**

- **2026-11-01** — Phases renamed by brand, shown as the doc title: 0 Groundwork, 1 Front Door (with 1.1 Row-Level Security and Pre-2 Hardening), 2 Gatekeeper, 3 Synergy, 4 Taxila, 5 Zinsser, 6 Alter Ego, 7 War Room, 8 Pocket, 9 Terminal, 10 Watchtower, 11 Open House, 12 Storefront. File names and phase numbers are unchanged.
- **2026-08-24** — Core Drive redesigned as a system-wide **tiered context model** (kernel / applicability-loaded / situational state) with a centralized **Context Assembler** and first-class **Effort Level** in the AI request contract (architecture §5.2). Domain knowledge assigned to Taxila; state/values boundary between Core Drive and War Room/Factory made explicit. Phase 6A/6B/7A tasks updated.
- **2026-07-27** — Realigned the entire plan to the bird's-eye-view essay (high-level PRD). Adopted module names; rejected Bookmarks/Recipes/Budget as standalone features; added the graph store and metadata service (now Synergy), Core Drive, command-palette shell, and provider-agnostic AI router; moved dogfooding/billing to optional tail. Phases 0–2 unchanged.

---

## Reading This Document

Tasks are grouped into **phases**. Each phase is a shippable milestone — by the end of it, something real and working exists that you can use, demo, or build on top of. Phases are sequenced to minimize re-work and to teach progressively harder concepts.

**Complexity tags:**
🟢 Beginner-friendly — follow-the-docs territory
🟡 Intermediate — requires understanding the "why"
🔴 Advanced — architectural weight-bearing, get it right first time

**Learning tags:**
📦 Monorepo / toolchain
🔐 Auth / Security
🗄️ Database / Drizzle
🧩 Next.js patterns
🎨 UI / Mantine
✍️ Editor / Tiptap
🤖 AI / Embeddings
📱 Mobile / PWA
🖥️ CLI / API
💳 Billing / SaaS

---

## Phase notes

- [[04-phases/00-groundwork/00-plan|Phase 0 — Groundwork ✅ COMPLETE]]
- [[04-phases/01-front-door/00-plan|Phase 1 — Front Door ✅ COMPLETE]]
- [[04-phases/01-front-door/01-row-level-security/00-plan|Phase 1.1 — Front Door ✅ COMPLETE]]
- [[04-phases/01-front-door/02-hardening/00-plan|Pre-2 — Front Door ✅ COMPLETE]]
- [[04-phases/02-gatekeeper/00-plan|Phase 2 — Gatekeeper ✅ COMPLETE]]
- [[04-phases/03-synergy/00-plan|Phase 3 — Synergy]]
- [[04-phases/04-taxila/00-plan|Phase 4 — Taxila]]
- [[04-phases/05-zinsser/00-plan|Phase 5 — Zinsser]]
- [[04-phases/06-alter-ego/00-plan|Phase 6 — Alter Ego]]
- [[04-phases/07-war-room/00-plan|Phase 7 — War Room]]
- [[04-phases/08-pocket/00-plan|Phase 8 — Pocket]]
- [[04-phases/09-terminal/00-plan|Phase 9 — Terminal]]
- [[04-phases/10-watchtower/00-plan|Phase 10 — Watchtower]]
- [[04-phases/11-open-house/00-plan|Phase 11 — Open House (optional)]]
- [[04-phases/12-storefront/00-plan|Phase 12 — Storefront (optional)]]
- [[backlogged-unplanned|Backlogged / Unplanned]]

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
| Phase 2  | 2–4 sessions       | Conceptually dense; revisit often ✅           |
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
