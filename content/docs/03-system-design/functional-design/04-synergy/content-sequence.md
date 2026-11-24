---
publish: true
id: system-design.functional-design.04-synergy.content-sequence
title: Content Sequence
created: 2026-10-31
updated: 2026-11-24
kind: spec
version: 1.1.0
tags:
   - system-design
   - synergy
status: accepted
---

**D63** `decision` #synergy #concurrency: The entity index keeps a `content_seq` counter that goes up on every write to an entity's content. derived-from [[D151]] derived-from [[D171]]

## What

The entity index gets a third counter, **`content_seq`**, that goes up on every write to an entity's content: a revision save, a version save, and an anchor mark added to the content for someone else's link (Pratik, 2026-10-31).

- **The stale-write check uses it.** A save carries the `content_seq` it started from; the update runs `SET content_seq = content_seq + 1 … WHERE content_seq = $base`, and a stale one gets 409 `stale_content`.
- **The render cache key uses it**: render data is cached under (entity, `content_seq`, display type). **The ETag doesn't** since Synergy lesson 5: an entity response also carries status (and, from lesson 7, the roll-up), which change without moving `content_seq`, so the ETag is a hash of the whole response ([The ETag](#the-etag), [[D271]]).
- **`version` and `revision` keep their meaning** and only drive the staleness dots: version for a change the author flags, revision for every other author save. An anchor write moves neither.
- **It is an integer, not a timestamp.** A JavaScript `Date` holds milliseconds while Postgres stores microseconds, so a timestamp sent back by the editor would never match the stored one; `now()` is the transaction's start time, so two saves can share a value. A counter is exact and easy to assert on in tests.
- **Status isn't content**, so status changes don't move it. The cache holds only data derived from content; status, states and marks are read fresh on every request.

## The ETag

**D271** `decision` #synergy #api #cache: An entity response's ETag is a hash of the exact JSON it sends (SHA-256, base64url), so it changes whenever any field does and never otherwise. related-to [[D63]] related-to [[D210]]

HTTP requires an ETag to stand for the whole response (RFC 9110). Lesson 4's `ETag: "<content_seq>"` didn't: after a status change, a client's `If-None-Match` got 304 and kept a stale status (Pratik, 2026-11-24, Synergy lesson 5).

- `entityETag(entity)` in Synergy's `api/entity.ts` hashes the response body `toEntity` builds, and the handler sends that same object, so the ETag and the body can't disagree. `GET /entities/:id` and `PATCH /entities/:id/status` both send it.
- `content_seq` keeps its own job, the stale-write token: a hash moves on metadata changes too (a rename, a status change, a tag), so a save checked against it would get false 409s.
- **Rejected:** `"<content_seq>.<updated_at>"`, because JavaScript's `Date` keeps milliseconds and `now()` is the transaction's start, so two writes in one millisecond that leave `content_seq` alone (deprecate, then reactivate) share an ETag; a `meta_seq` counter, correct but one more column every metadata write must remember.
- Overrides the ETag part of the PRD's [[D177]] and of the spec's Contracts, which put `content_seq` in the ETag.

## Why

- A version save leaves `revision` alone (PRD page 01), so with revision as the token two tabs at the same revision could both save, and the second would overwrite the new version without a warning. The cache key wouldn't move either, so links kept showing the old card.
- Adding an anchor writes the target's content but must not bump its revision, or every other referencer would get a false "edited" dot. With no token that moves, an open editor's next save would silently drop the anchor, or be refused as removing a referenced passage the user never touched.
- One counter can't mean both "the author changed this" and "the stored content changed".

## Options not taken

- **Revision goes up on version saves too.** Fixes the version case, not the anchor case.
- **Anchors stored outside the content** (standoff), which would leave content untouched by anchor writes. Offsets inside a block would shift with every edit and need updating on each save; whole-document saves from bots would fall back to guessing by quote, in a rule that refuses saves; undo can't bring back a position stored outside the text; collaboration would need relative positions. See [[03-system-design/functional-design/04-synergy/anchors-in-content|Anchors in content]].

## Consequences

- When an anchor lands in a document that is open in an editor, that editor's next save gets 409. The editor fetches the latest content, copies in the anchor marks it lacks (by block id and quote) and saves again, without showing anything. A planned task for the editor lesson.
- Overrides PRD page 07 items 5 and 11, and the spec's Contracts, which keyed concurrency, the ETag and the cache on revision.

## Decision History

- 2026-10-31 · accepted · Content Sequence
- 2026-11-22 · accepted · The ETag built in lesson 4; the status gap handed to lesson 5
- 2026-11-24 · accepted · The ETag is a hash of the response, not `content_seq` ([[D271]], Synergy lesson 5)
