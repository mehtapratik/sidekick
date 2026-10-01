---
id: plan.living
created: 2026-09-19
kind: plan
version: 1.0.0
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
| _(infrastructure)_ | 0, 1, 1.1, 2, 3                            | Product-agnostic: monorepo, auth, RLS, API guard, graph/metadata service     |
| Taxila             | 4                                          | Absorbs "Notes" and "Bookmarks" (bookmark = knowledge source of type `link`) |
| Zinsser            | 5 (editor), post-6 (AI coach)              | Editor first; coach depends on AI layer                                      |
| Core Drive         | 6                                          | Separate feature for now; may fold into Taxila later (see architecture §5.2) |
| Alter Ego          | 6                                          | Grounded in Core Drive + Taxila RAG                                          |
| War Room           | 7                                          | Tasks / planning entity                                                      |
| Factory            | 7 (push-button workflows), post-MVP (rest) | MVP scope per PRD: push-button workflows + input defaults                    |
| Parrot             | —                                          | Post-MVP, backlogged                                                         |

**Changelog**

- **2026-08-24** — Core Drive redesigned as a system-wide **tiered context model** (kernel / applicability-loaded / situational state) with a centralized **Context Assembler** and first-class **Effort Level** in the AI request contract (architecture §5.2). Domain knowledge assigned to Taxila; state/values boundary between Core Drive and War Room/Factory made explicit. Phase 6A/6B/7A tasks updated.
- **2026-07-27** — Realigned the entire plan to the bird's-eye-view essay (high-level PRD). Adopted module names; rejected Bookmarks/Recipes/Budget as standalone features; added graph store & metadata service, Core Drive, command-palette shell, and provider-agnostic AI router; moved dogfooding/billing to optional tail. Phases 0–2 unchanged.

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

- [[phase-0-foundation-tooling-complete|Phase 0 — Foundation & Tooling ✅ COMPLETE]]
- [[phase-1-supabase-auth-shell-complete|Phase 1 — Supabase & Auth Shell ✅ COMPLETE]]
- [[phase-1-1-db-level-rls-soft-delete-enforcement-complete|Phase 1.1 — DB-Level RLS & Soft-Delete Enforcement ✅ COMPLETE]]
- [[pre-2-foundation-hardening|Pre-2 — Foundation Hardening]]
- [[phase-2-core-infrastructure-api-guard-feature-system|Phase 2 — Core Infrastructure (API Guard, Feature System)]]
- [[phase-3-graph-store-metadata-service|Phase 3 — Graph Store & Metadata Service]]
- [[phase-4-taxila-v1-knowledge-management|Phase 4 — Taxila v1 (Knowledge Management)]]
- [[phase-5-zinsser-v1-writing-editor-first|Phase 5 — Zinsser v1 (Writing — Editor First)]]
- [[phase-6-core-drive-ai-layer-alter-ego|Phase 6 — Core Drive + AI Layer + Alter Ego]]
- [[phase-7-war-room-factory-v1|Phase 7 — War Room & Factory v1]]
- [[phase-8-pwa-ios-shell|Phase 8 — PWA & iOS Shell]]
- [[phase-9-api-keys-cli|Phase 9 — API Keys & CLI]]
- [[phase-10-observability-hardening|Phase 10 — Observability & Hardening]]
- [[phase-11-dogfooding-friends-family-access-optional|Phase 11 — Dogfooding (Friends & Family Access) — Optional]]
- [[phase-12-billing-saas-readiness-optional-path|Phase 12 — Billing & SaaS Readiness (Optional Path)]]
- [[post-mvp-factory-extensions-bots-agents|Post-MVP — Factory Extensions, Bots & Agents]]
- [[backlogged-unplanned|Backlogged / Unplanned]]
