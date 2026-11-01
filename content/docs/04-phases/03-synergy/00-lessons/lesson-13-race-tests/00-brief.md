---
publish: true
id: plan.phase-3.lesson-13-race-tests
title: "Synergy Lesson 13: Race Tests"
created: 2026-11-01
updated: 2026-11-01
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-3
   - task
   - synergy
   - testing
   - postgresql
status: planned
---

> **Lesson 13 of 13 in Phase 3a.** Before this: [[04-phases/03-synergy/00-lessons/lesson-12-tags/00-brief|lesson 12]]. Next: [[04-phases/03-synergy/01-checkpoint-3a/00-brief|Checkpoint 3a]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** tests that prove the lock-first rule and the stale-write check under real concurrency, with two database connections interleaved on purpose, and a measurement of the cycle check on a large synthetic graph.

**Implements:** the overview's Testing section ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]), [[06-decisions/technical/synergy-store-choices|Synergy store choices]] (measure the cycle check before choosing a closure table).

**Learning payoff:** why sequential tests can't catch a race; forcing an interleaving with two connections and an explicit wait (one transaction holds the lock while the other starts); what `pg_advisory_xact_lock` serialises and what the `content_seq` check catches without it; measuring a query (`EXPLAIN ANALYZE`, timing at realistic and extreme sizes) before optimising it.

**Coach reads first:** the overview's Write path (the lock and the anchor receipt), lessons 3, 10 and 11's code and tests, `packages/foundation/core/tests/helpers/db.ts` (or wherever lesson 2 put the helpers).

## Steps

**Good to write yourself:** the second race (step 3), after the coach's version of the first.

1. **A two-connection harness.** A test helper that opens two transactions for the same user and lets a test step them in a chosen order.
2. **Anchor while the target is open.** Connection A reads a note (its `content_seq`); connection B links to a passage of it (`addAnchor` moves `content_seq`); A saves on its old base and gets 409 `stale_content`.
3. **Delete racing a new reference.** A starts deleting a task; B creates a reference into it; exactly one of them commits, and the other fails with `delete_blocked` or `not_found`, never both succeeding.
4. **Restore after the graph changed.** A note is deleted; meanwhile a reference that would close a cycle is created; restoring the note fails with `restore_conflict`, naming the edge.
5. **Cycle-check timing.** Generate a large synthetic graph for one user (sizes decided in the lesson, from realistic to far beyond MVP), time the cycle check on create, and record the numbers in the walkthrough and in the store-choices decision. They decide whether a closure table is ever needed.
6. **Break it.** Remove the lock call from one write and watch the delete race let both commit; put it back.

**Exit check:** steps 2 to 4 green in CI, step 5's numbers recorded, step 6 seen to fail.

**Out of scope:** load testing the API, the story 71 search test (3b).
