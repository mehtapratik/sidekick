---
publish: true
id: system-design.functional-design.global-tagging-and-linking.design-constraints
created: 2026-09-19
kind: spec
updated: 2026-10-30
version: 1.0.1
tags:
   - system-design
   - global-tagging-and-linking
   - rls
   - offline
   - soft-delete
---

> **Superseded in part (2026-10-30):** points 1 and 2 are replaced by [[06-decisions/technical/platform-layer|Platform layer]]. Entity types are registered by the package that provides them, and relationships, tags and the entity index live in `packages/platform/synergy`, not `packages/core` or the registry. Points 3 and 4 still hold.

1. All feature entities use client-generated UUIDs (existing invariant) and register entity type in `packages/features-registry` — the registry doubles as the entity-type ledger.
2. The `edges` table (`fromId`, `toId` `toType`, `relation`, and timestamps) live in `packages/core`. Core still stays feature agnostic because it stores opaque type IDs, never feature schema.
3. Global `tags` and `entity_tags` table provide metadata across all entity types.
4. Edges and tags are user data: RLS by `userId`, syncable (soft-delete + trigger) rules apply.
