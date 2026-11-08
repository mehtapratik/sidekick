---
publish: true
id: plan.phase-3.lesson-8-lists-and-supersede
title: "Synergy Lesson 8: Lists and Supersede"
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
status: planned
---

> **Lesson 8 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-7-staleness/00-brief|lesson 7]]. Next: [[04-phases/03-synergy/00-lessons/lesson-9-save-mentions/00-brief|lesson 9]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** list links (one source, an ordered list of targets, each member a complete edge with its own type) and supersede (an old entity points to each replacement, and the first replacement marks it superseded after the user confirms).

**Implements:** the overview's Tables (`relationships`: role, composite FK, positions) and Write path ("Supersede") ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]); [[03-system-design/functional-design/04-synergy/mentions-and-link-lifetime|Mentions and link lifetime]] (supersede).

**Learning payoff:** a composite foreign key that makes a bad row impossible instead of checking for it in code (and why Postgres skips a composite FK when any column is null, which is why `type` is NOT NULL); CHECK constraints across columns; fractional positions (lexorank) so a move writes one row; a request that answers `confirmation_required` until it is confirmed.

**Coach reads first:** the overview's `relationships` bullet in full, the relationships PRD page, lesson 6's relationships table and cycle check.

## Steps

**Good to write yourself:** the composite foreign key and its CHECK constraints (step 1).

1. **List columns.** `role` (`solo`, `list`, `member`), `parent_id`, `parent_role` fixed to `list` by a CHECK, `position`, and the composite FK `(parent_id, from_id, type, parent_role) → (id, from_id, type, role)`. A list row has no `to`; solos and members do (CHECK). Unique `(parent_id, position)`, partial on live rows.
2. **Positions.** A small lexorank helper: a key between two keys, before the first, after the last. Creating, moving and removing a member writes one row.
3. **Routes.** `POST /links` creates a list row and members; `PATCH /links/:id` moves a member (`position`). The cycle check from lesson 6 runs for each member that is a reference.
4. **Supersede.** `superseded-by` (system relation type, kind reference) from the old entity to each replacement, any number of them. Creating the first one answers 409 `confirmation_required` with how many entities reference the old one, until the request sends `confirm`; then it sets the old entity's status to superseded. Removing the last one sets it back to active. Emits status changed with the link events.
5. **Prove it.** Integration tests: a list keeps its order through inserts and moves; a member can't point at another member or have a different `from` or `type` (the database refuses it); supersede asks for confirmation, marks the old entity, and reverses cleanly when the last successor link goes; two successors work; a supersede loop is refused by the cycle check; referencers of the old entity get the red mark from lesson 7.

**Exit check:** step 5 green in CI. With lesson 5, proves the exit criterion "deprecate and supersede work".

**Unit-test candidates:** the lexorank helper.

**Out of scope:** the supersede confirmation UI (Phase 4), deleting a replacement (blocked in lesson 11).
