---
publish: true
id: plan.phase-3.lesson-7-staleness
title: "Phase 3 Lesson 7: Staleness Dots and the Roll-Up"
created: 2026-11-01
updated: 2026-11-01
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-3
   - task
   - synergy
   - api
status: planned
---

> **Lesson 7 of 13 in Phase 3a.** Before this: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-6-links|lesson 6]]. Next: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-8-lists-and-supersede|lesson 8]]. The coach follows the plan's [[04-plans/phase-3-graph-store-metadata-service#How we build|how we build]].

**What gets built:** the dots that tell a reader a link's target moved on. Each reference compares its snapshot with the target's current version and revision and status, and gets its marks (edited, changed) on every read. The referencer can confirm "still holds" to move the snapshot. An entity's read response carries the roll-up of its outgoing references that need attention.

**Implements:** the overview's Read path (steps 2 and 5) and API (`POST /links/:id/snapshot`, the roll-up on `GET /entities/:id`) ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]); [[06-decisions/technical/mentions-and-link-lifetime|Mentions and link lifetime]] (only references carry the change rules; the roll-up); [[02-prd/03-features/01-synergy/04.prd.features.synergy.keeping-links-true|keeping links true]].

**Learning payoff:** snapshots versus live joins; state derived on read instead of stored (and why stored marks would drift); version (a change the author flags, red) versus revision (any other save, standard); computing a roll-up in one indexed query; why marks are read fresh even when render data is cached later.

**Coach reads first:** the keeping-links-true PRD page, [[06-decisions/technical/content-sequence|Content sequence]] (why `content_seq` drives no dot), the overview's Read path, lesson 6's links code.

## Steps

**Good to write yourself:** the marks function (step 1); it is a small pure function and a good place for a unit test.

1. **Marks.** From a reference's snapshot and its target's index row: changed (target version is ahead, red), edited (only revision is ahead, standard), and the target states that also call for attention (deprecated, superseded, deleted). Associations never get a mark.
2. **Links read.** `GET /entities/:id/links` returns each link's marks beside its state.
3. **Snapshot.** `POST /api/synergy/links/:id/snapshot` moves the snapshot to the target's current version and revision ("the link still holds") and emits snapshot moved. Metadata only: no counter moves on either end.
4. **Roll-up.** `GET /entities/:id` carries the roll-up: whether any outgoing reference needs attention, red or standard, and which links are the reason. One query, not one per link.
5. **Prove it.** Integration tests: a version save on the task with a change note gives the note's reference a red mark and a red roll-up; a revision save gives a standard one; a status change to deprecated gives red; moving the snapshot clears it; an association to the same task never shows a mark.
6. **Decide in the lesson: what the ETag covers.** Found while planning. `GET /entities/:id` answers 304 when `content_seq` matches, but its body also carries status and now the roll-up, which change without moving `content_seq`. A client that reuses its cached body on 304 would show a stale status or roll-up. Options: keep the ETag on `content_seq` and document that a 304 means only "content unchanged" (enough for the "Page updated" check), or build the ETag from `content_seq` plus the status and the roll-up. Pratik decides; the overview and [[06-decisions/technical/content-sequence|Content sequence]] are updated to match.

**Exit check:** step 5 green in CI, and step 6 decided and tested. Proves the exit criterion "a version bump with a change note shows the red dot".

**Unit-test candidates:** the marks function.

**Out of scope:** dots inside a live preview (3b, with render data), notifications to referencers (post-MVP).
