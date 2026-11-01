---
publish: true
id: plan.phase-3.lesson-6-links
title: "Synergy Lesson 6: Links, Relation Types and Cycles"
created: 2026-11-01
updated: 2026-11-01
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-3
   - task
   - synergy
   - graph
   - postgresql
   - api
status: planned
---

> **Lesson 6 of 13 in Phase 3a.** Before this: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-5-outbox|lesson 5]]. Next: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-7-staleness|lesson 7]]. The coach follows the plan's [[04-plans/phase-3-graph-store-metadata-service/phase-3-graph-store-metadata-service#How we build|how we build]].

**What gets built:** single links ("solo" relationships) between any two entities, with an optional label and a type from a seeded vocabulary; the cycle check that refuses a reference loop; the server half of type registration, so Synergy knows which feature gates each type and can refuse or show a link as `locked`; and the links routes with idempotent creates.

**Implements:** the overview's Type registration, Tables (`relationships`, `relation_types`, `idempotency_keys`), Write path ("Link from a field, the links panel or the API", "Every link create") and API ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]); [[06-decisions/technical/mentions-and-link-lifetime|Mentions and link lifetime]] (kinds, `cited`); [[06-decisions/technical/synergy-store-choices|Synergy store choices]] (the cycle check).

**Learning payoff:** polymorphic references (a link can point at any provider's entity because both ends are `entity_index` ids); a vocabulary table keyed by `source_key` and `target_key` with labels in copy; recursive CTEs and Postgres's `CYCLE` clause; why only references are checked for cycles; idempotency keys and safe retries; dependency injection by data (the registry hands Synergy a map; Synergy imports no feature).

**Coach reads first:** the overview, the mentions decision, [[02-prd/03-features/01-synergy/02.prd.features.synergy.relationships|relationships PRD]], [[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]], [[03-system-design/non-functional/content/centralized-copy|centralized copy]], lesson 4's sandbox packages.

## Steps

**Good to write yourself:** the cycle-check query (step 4), after the coach explains recursive CTEs.

1. **Relation types.** `relation_types`: `source_key` (identity), `target_key`, kind (reference or association), status, system flag; seeded with the starter vocabulary plus the system rows `untyped` (kind reference, shows no type name) and `superseded-by` (used in lesson 8). Copy keys for their labels go in `packages/foundation/copy`. `GET /api/synergy/relation-types`.
2. **Relationships, solo only.** `relationships` with `role` (only `solo` used now), from, to, optional label, type (NOT NULL, defaulting to `untyped`), the version and revision snapshot of the target, `cited`, `mentioned`, provenance and tombstone columns. Leave room for lesson 8's list columns and lesson 10's anchor columns as the overview describes, or add them there: decided in the lesson. Indexes on `to_id` and `from_id`.
3. **Registration, server half.** `LinkableTypeServer` with `provider`, `type` and `entitlement` (`resolve` arrives in 3b, `addAnchor` in lesson 10). The sandbox packages each export one; the registry collects them into the map Synergy receives. Synergy never imports a provider.
4. **The cycle check.** A recursive CTE over live references with the `CYCLE` clause, run under the user lock on every reference create or retype. Associations may cycle.
5. **Routes.** `POST /api/synergy/links` (cited link; idempotency key; refuses `cycle`, `locked` when the caller lacks the target type's entitlement, `deprecated_vocabulary`, `not_found`), `PATCH /links/:id` (label, type, `cited`), `DELETE /links/:id` (tombstone; a link with neither `cited` nor `mentioned` is gone), `GET /entities/:id/links?direction=out|in` with each link's state (`unknown`, `locked`, `deleted`) decided from the index and the registry. Each write emits its outbox events.
6. **Prove it.** Integration tests: a note links to a task with a label and a type; a retried create with the same idempotency key returns the same link; a reference cycle is refused and an association cycle isn't; revoking `sandbox-tasks` makes the note-to-task link `locked` while the note stays readable, and refuses a new one; the locked link's response carries name, type and status but no content; backlinks (`direction=in`) page correctly; a deprecated type is refused; another user's ids are `not_found`.

**Exit check:** step 6 green in CI. Proves the exit criteria "a link can carry a label and a type", "reference cycles are rejected" and "disabling a module makes its links locked".

**Unit-test candidates:** the state decision (unknown, locked, deleted) as a pure function of index row, registry and entitlements.

**Out of scope:** dots and the roll-up (lesson 7), lists and supersede (lesson 8), links from content (lesson 9), anchors (lesson 10), restore (lesson 11), resolved render data (3b).
