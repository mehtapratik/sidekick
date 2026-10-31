---
publish: true
id: decision.technical.content-sequence
created: 2026-10-31
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - synergy
status: accepted
applies_to:
   - "[[02-prd/03-features/01-synergy/07.prd.features.synergy.foundations]]"
   - "[[03-system-design/functional-design/04-synergy/00-overview]]"
---

## What

The entity index gets a third counter, **`content_seq`**, that goes up on every write to an entity's content: a revision save, a version save, and an anchor mark added to the content for someone else's link (Pratik, 2026-10-31).

- **The stale-write check uses it.** A save carries the `content_seq` it started from; the update runs `SET content_seq = content_seq + 1 … WHERE content_seq = $base`, and a stale one gets 409 `stale_content`.
- **The ETag and the render cache key use it.** Entity responses carry `ETag: "<content_seq>"`, and render data is cached under (entity, `content_seq`, display type).
- **`version` and `revision` keep their meaning** and only drive the staleness dots: version for a change the author flags, revision for every other author save. An anchor write moves neither.
- **It is an integer, not a timestamp.** A JavaScript `Date` holds milliseconds while Postgres stores microseconds, so a timestamp sent back by the editor would never match the stored one; `now()` is the transaction's start time, so two saves can share a value. A counter is exact and easy to assert on in tests.
- **Status isn't content**, so status changes don't move it. The cache holds only data derived from content; status, states and marks are read fresh on every request.

## Why

- A version save leaves `revision` alone (PRD page 01), so with revision as the token two tabs at the same revision could both save, and the second would overwrite the new version without a warning. The cache key wouldn't move either, so links kept showing the old card.
- Adding an anchor writes the target's content but must not bump its revision, or every other referencer would get a false "edited" dot. With no token that moves, an open editor's next save would silently drop the anchor, or be refused as removing a referenced passage the user never touched.
- One counter can't mean both "the author changed this" and "the stored content changed".

## Options not taken

- **Revision goes up on version saves too.** Fixes the version case, not the anchor case.
- **Anchors stored outside the content** (standoff), which would leave content untouched by anchor writes. Offsets inside a block would shift with every edit and need updating on each save; whole-document saves from bots would fall back to guessing by quote, in a rule that refuses saves; undo can't bring back a position stored outside the text; collaboration would need relative positions. See [[06-decisions/technical/anchors-in-content|Anchors in content]].

## Consequences

- When an anchor lands in a document that is open in an editor, that editor's next save gets 409. The editor fetches the latest content, copies in the anchor marks it lacks (by block id and quote) and saves again, without showing anything. A planned task for the editor lesson.
- Overrides PRD page 07 items 5 and 11, and the spec's Contracts, which keyed concurrency, the ETag and the cache on revision.
