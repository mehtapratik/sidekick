---
title: Phase 3 graph store metadata service
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: approved
version: 1.0.0
tags:
  - plan
  - living-plan
  - phase-3
  - api-guard
  - rls
  - postgresql
  - api
  - offline
  - graph
appliesTo: []
isSection: false
docId: plan.phase-3-graph-store-metadata-service
sourcePath: sources/docs/04-plans/phase-3-graph-store-metadata-service.md
wordCount: 342
readingMinutes: 2
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

> **Milestone:** The cross-feature relationship and metadata layer is live (architecture §5.3). Any entity can be linked to any other entity and tagged — the "power of synergies" substrate every module builds on. This is also the proof-of-architecture vertical: schema → migration → RLS → repository → guarded API.
> **Learning payoff:** Graph modeling in relational databases, recursive CTEs, polymorphic references, designing a core service that stays feature-agnostic.

| #   | Task                                                                                                                                      | Complexity | Learning |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 3.1 | Add `entityType` registration to `FeatureManifest` in `packages/features-registry` — the registry becomes the entity-type ledger          | 🟡         | 📦       |
| 3.2 | Define `edges` schema in `packages/core` — `id`, `userId`, `fromId`, `fromType`, `toId`, `toType`, `relation`, timestamps (syncable)      | 🔴         | 🗄️       |
| 3.3 | Define `tags` and `entity_tags` schemas in `packages/core` (syncable)                                                                     | 🟡         | 🗄️       |
| 3.4 | Migration: RLS (combined user-isolation + soft-delete pattern from Phase 1.1) + trigger bindings on all three tables                      | 🔴         | 🔐 🗄️    |
| 3.5 | Implement `GraphRepository` in `packages/core` — the ONLY access path: `link()`, `unlink()`, `neighbors()`, `tag()`, `untag()`, `byTag()` | 🔴         | 🗄️       |
| 3.6 | Implement traversal query with a recursive CTE — e.g., `related(entityId, depth)`                                                         | 🔴         | 🗄️       |
| 3.7 | API routes `/api/graph/*` and `/api/tags/*` using `withApiGuard`                                                                          | 🟡         | 🧩 🔐    |
| 3.8 | Validate `fromType`/`toType` against registered entity types at the repository boundary                                                   | 🟡         | 📦       |
| 3.9 | Manually test: create edges/tags via API, verify RLS isolation and soft-delete behavior                                                   | 🟢         |          |

**Phase 3 Exit Criteria:** Entities can be linked and tagged through guarded APIs. `GraphRepository` is the sole access path. Entity types are registered in the feature registry. All graph data is user-isolated and soft-deletable.

> [!note]
> **No graph database.** This is a graph _pattern_ on plain Postgres — sufficient at MVP scale. If Sidekick grows to hundreds/thousands of users, `GraphRepository` is the swap boundary for a dedicated graph engine. See architecture §5.3.

---
