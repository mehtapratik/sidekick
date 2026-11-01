---
publish: true
id: plan.phase-3.lesson-10-save-anchors
title: "Phase 3 Lesson 10: Save Call, Anchors"
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

> **Lesson 10 of 13 in Phase 3a.** Before this: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-9-save-mentions|lesson 9]]. Next: [[04-plans/phase-3-graph-store-metadata-service/tasks/lesson-11-delete-and-restore|lesson 11]]. The coach follows the plan's [[04-plans/phase-3-graph-store-metadata-service#How we build|how we build]].

**What gets built:** links to a passage of a note, not the whole note. Linking to a passage asks the note's provider to write an anchor mark into the note (`addAnchor`), records the passage in `entity_anchors`, and answers with an anchor receipt. Every later save of the note reports its block and anchor ids, so Synergy can refuse a save that drops a referenced passage, or mark the passage removed when the save is a new version.

**Implements:** [[06-decisions/technical/anchors-in-content|Anchors in content]], [[06-decisions/technical/content-sequence|Content sequence]] (an anchor write moves `content_seq`, never the version or revision), the overview's Write path ("Save content" steps 2 to 4, "Every link create", the anchor receipt) ([[03-system-design/functional-design/04-synergy/00-overview|Synergy]]), [[03-system-design/functional-design/04-synergy/anchors-survey|the anchors survey]].

**Learning payoff:** anchors stored in the target's own content, with a quote as the safety net; why the anchor write moves `content_seq` but not the revision (no false "edited" dot for every other referencer); passage protection that costs the size of the change, not the document; a provider callback (`addAnchor`) that Synergy calls without importing the provider; returning just enough (the receipt) to save a client a round trip.

**Coach reads first:** the anchors decision and survey, the content-sequence decision, lesson 9's save call and `extractRefs`.

## Steps

**Good to write yourself:** the passage check (step 4).

1. **Block ids.** Every block in a sandbox note's body carries a stable `id` attribute (as Tiptap's UniqueID extension does). `extractRefs` now returns block and anchor ids too.
2. **Link columns and anchors table.** `relationships.to_anchor_id` and `to_anchor_quote` (`exact`, `prefix`, `suffix`; empty for a whole-entity target), an index on `(to_id, to_anchor_id)`, and `entity_anchors` (entity, anchor id, `removed_in_version`).
3. **`addAnchor`.** Added to `LinkableTypeServer`. The sandbox note implements it: given a passage address (block id plus quoted text), it writes an anchor mark into the note's body and bumps the note's `content_seq` and `updated_at`, never its version or revision. Later links to the same passage reuse the anchor.
4. **Passage checks on save.** Synergy compares the reported ids with `entity_anchors`: a reference into a gone anchor refuses the save with `passage_referenced` (with the quotes) unless the save is a new version, which sets `removed_in_version` instead; associations into gone anchors are tombstoned, moving only their sources' `updated_at` (actor system, with the reason).
5. **The receipt.** `POST /links` to a passage answers with `{ targetId, contentSeq, anchor: { id, blockId, quote } }`, and a save that creates links returns one per passage target. Links read shows `passage_removed` from `entity_anchors`.
6. **Prove it.** Integration tests: linking to a passage writes the anchor and returns the receipt, and the note's `content_seq` moves while its revision doesn't; an editor save based on the old `content_seq` gets 409 `stale_content`, and one based on the receipt's `contentSeq` succeeds; a revision save that drops a referenced anchor gets `passage_referenced`; a version save that drops it marks the link `passage_removed`; an association into a dropped passage is tombstoned and its source's revision doesn't move.

**Exit check:** step 6 green in CI.

**Unit-test candidates:** `extractRefs` with block and anchor ids.

**Out of scope:** the editor's automatic merge on 409 and word-level anchors in an editor (the shared editor, decided at Checkpoint 3a), the quote re-matcher (Markdown import and Refresh, later), the race version of this test (lesson 13).
