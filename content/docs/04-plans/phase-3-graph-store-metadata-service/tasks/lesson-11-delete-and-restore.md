---
publish: true
id: plan.phase-3.lesson-11-delete-and-restore
title: "Phase 3 Lesson 11: Delete and Restore"
created: 2026-11-01
updated: 2026-11-01
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-3
   - task
   - synergy
   - database
status: planned
---

> **Lesson 11 of 13 in Phase 3a.** Before this: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-10-save-anchors|lesson 10]]. Next: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-12-tags|lesson 12]]. The coach follows the plan's [[04-plans/phase-3-graph-store-metadata-service#How we build|how we build]].

**What gets built:** deleting an entity, with the rule that keeps links true: a delete is refused while a live reference points at the entity. A delete that goes through tombstones the entity and its outgoing links as one batch. Restore, undo of an unlink, and relink bring back exactly what was removed, but only after re-running the delete block and the cycle check, because the graph may have changed since.

**Implements:** the overview's Write path ("Delete", "Restore and undo") and Tombstones ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]), [[06-decisions/technical/tombstone-visibility|Tombstone visibility]], [[06-decisions/technical/mentions-and-link-lifetime|Mentions and link lifetime]] (only references block a delete).

**Learning payoff:** a delete as a guarded state change, not a row removal; grouping tombstones with a batch id; why a restore must re-check rules that held when the row was deleted (time-of-check versus time-of-use); naming every conflicting edge in an error so a client can explain it; erasure as the override.

**Coach reads first:** the overview sections above, lesson 3's restore-aware trigger and tests, lesson 6's cycle check, lesson 8's supersede (a replacement can't be deleted while an old entry points at it).

## Steps

**Good to write yourself:** the restore re-check (step 3).

1. **Delete.** The provider's delete route (sandbox notes and tasks) soft-deletes its row and calls Synergy in the same transaction. Synergy refuses with `delete_blocked` (naming the referencing links) while a live reference points at the entity; otherwise it sets `deleted_at` on the index row and tombstones the outgoing links under one `deletion_batch_id`. Associations never block.
2. **Restore an entity.** The provider's restore route and Synergy bring back the index row and exactly that batch of links.
3. **Re-check.** Before any restore, undo (`POST /links/:id/restore`) or relink, under the user lock: a restored reference into a deleted entity, or one that would close a cycle, is refused with `restore_conflict`, naming each edge.
4. **Erasure.** Permanent erasure overrides the delete block and leaves referencers a "permanently removed" placeholder (spec story 48). Emits entity erased.
5. **Prove it.** Integration tests: deleting a referenced task is refused, and deleting the note that references it is allowed; the deleted target still shows its name and the `deleted` state on the note's links read; restoring the note brings back its links; a restore that would close a cycle (because a new reference was added meanwhile) is refused and names the edge; undoing an unlink brings back the same relationship id, and undoing one into a now-deleted target is refused; erasing a referenced task leaves the note's link a placeholder; outbox events for each step.

**Exit check:** step 5 green in CI. Proves the exit criterion "deleting a referenced target is blocked", and with lesson 6, "reference cycles are rejected".

**Out of scope:** a Trash UI, the race version of these tests (lesson 13).
