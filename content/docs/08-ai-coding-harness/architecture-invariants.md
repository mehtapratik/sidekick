---
publish: true
id: harness.architecture-invariants
title: Architecture Invariants
created: 2026-09-19
updated: 2026-11-24
kind: guidance
version: 1.1.0
tags:
   - ai-coding
   - architecture
   - invariant
   - agent-guidance
   - api
   - nextjs
---

Before changing code, use the relevant system-design note as the source of truth. Always preserve the package dependency direction, public-API boundary, centralized copy policy, and server/client runtime separation.

- [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]]
- [[03-system-design/non-functional/api/api-first|API-first]]
- [[03-system-design/non-functional/content/centralized-copy|Centralized copy]]
- [[03-system-design/non-functional/nextjs/server-actions|Server actions]]
- [[best-practices|Implementation checklist]]

## File names inside a package

A file is named for what it holds (Pratik, 2026-11-24, Synergy lesson 5):

- **Plural for operations over many rows:** one table's queries, such as `repository/entities.ts` and `repository/versions.ts`.
- **Singular for one concept or shape:** `repository/actor.ts` (the `Actor` type), `contracts/entity.ts` (the `Entity` schema), `api/entity.ts` (how an entity is answered).
- **The table's name for a schema file:** `db/schema/entity-index.ts`, `version-log.ts`, `outbox.ts`.
- **The action for a route handler:** `api/read-entity.ts`, `api/change-entity-status.ts`, one handler per file. Pieces two handlers share go in the concept's file (`api/entity.ts`), never in another handler's file.
- **A test file mirrors the file it tests:** `entity.ts` and `entity.test.ts`.
