---
publish: true
id: prd.synergy.ticket-12
title: "Cycles between links"
created: 2026-10-27
kind: plan
type: grilling
blocked_by: []
status: deprecated
assignee: mehtapratik
tags:
   - prd
   - synergy
   - wayfinder
---

> **Retired 2026-10-29.** The outcome lives in the [[02-prd/03-features/01-synergy/00.prd.features.synergy.overview|Synergy PRD]] and [[02-prd/03-features/01-synergy/spec|spec]]. This page stays as the record of how it was decided.

## Question

A plan references a PRD, and later the PRD references the plan. With delete blocked by incoming references, neither can ever be deleted, and the loop can run through a long chain. Which cycles are allowed, how is a cycle detected when a link is created without an expensive lookup on every read, and what does the user see when a link would close one?

## Resolution

Decided 2026-10-27; the mechanism is left to system design.

- **References may never form a cycle; associations may.** "A is built from B, and B from A" can't both be true. With no reference cycles, the delete rule never deadlocks: some entity always has no incoming references and can go first. Associations never block anything, so their loops are harmless, and traversal over them stops at nodes it has already visited.
- **The link picker steers away from cycles.** When the user starts adding a reference from entity A, the entities that would close a loop are exactly those that already reach A through references (A's transitive referencers). Computed once when the picker opens, not on every keystroke, they are shown greyed out with "would create a loop" rather than hidden, so a missing result never looks like a search bug.
- **Creating a reference checks again, on the server.** The picker is a convenience; bots, jobs and the API don't use it (see the One Interface principle). Before saving "A → B", the server checks whether B already reaches A through references, under a per-user lock so two concurrent links can't close a loop together. A refused link names the chain ("PRD → Plan → PRD") and suggests an association instead.
- **For system design to settle:** how both lookups scale. Options: a recursive query per check (simplest; per-user reference graphs are small and shallow), a depth cap, or a maintained closure table (fast reads, costlier writes). Measure before choosing anything beyond the recursive query.
