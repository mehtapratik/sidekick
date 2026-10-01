---
publish: true
id: system-design.functional-design.global-tagging-and-llinking.design-constraints
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - global-tagging-and-llinking
   - rls
   - offline
   - soft-delete
---

1. All feature entities use client-generated UUIDs (existing invariant) and register entity type in `packages/features-registry` — the registry doubles as the entity-type ledger.
2. The `edges` table (`fromId`, `toId` `toType`, `relation`, and timestamps) live in `packages/core`. Core still stays feature agnostic because it stores opaque type IDs, never feature schema.
3. Global `tags` and `entity_tags` table provide metadata across all entity types.
4. Edges and tags are user data: RLS by `userId`, syncable (soft-delete + trigger) rules apply.
