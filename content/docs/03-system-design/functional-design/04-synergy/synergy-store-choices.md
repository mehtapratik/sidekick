---
publish: true
id: system-design.functional-design.04-synergy.synergy-store-choices
title: Synergy Store Choices
created: 2026-10-30
updated: 2026-11-24
kind: spec
version: 1.2.0
tags:
   - system-design
   - synergy
   - postgresql
status: accepted
---

**D65** `decision` #synergy #database: Synergy's store keeps list links in the one `relationships` table and settles three other smaller choices. derived-from [[D90]]

Four smaller choices about Synergy's store (Pratik, 2026-10-30), tightened after the design review (2026-10-31).

## List links stay in the one `relationships` table

A list row has no `to`; each member has `parent_id`, its own `to`, a position and its own snapshot, and repeats the list row's `from` and `type`. A `role` column (`solo`, `list`, `member`; Pratik, 2026-10-31) joins them in the composite foreign key `(parent_id, from_id, type, parent_role) → (id, from_id, type, role)`, with `parent_role` fixed to `list`, so a member can only hang off a list row, never another member. `type` is NOT NULL (a composite key with a null column is skipped under Postgres's default `MATCH SIMPLE`), with a seeded system type `untyped`, kind reference, for untyped links. CHECKs keep list rows without a `to` and solos and members with one. Positions are fractional text keys (lexorank) with a unique `(parent_id, position)`, so a reorder writes one row. Every member is therefore a complete source-to-target edge with its own type, so backlinks, staleness, the delete block and the cycle check are one query each with no list-specific branch or join to the header. A mention of a list points at its list row. **Revisit** if more than one or two queries need a list-specific branch.

## Cycle check: a recursive query under a per-user lock

**Every Synergy write takes the per-user lock first**, before reading anything: `pg_advisory_xact_lock(hashtextextended(user_id::text, 0))` inside the write's transaction. That includes the save call, link create, delete, restore, undo, relink, "point to the new entry" and changing a link's type from association to reference, so the delete block and the cycle check can never race each other, and one lock order rules out deadlocks. For one user the contention is negligible.

Creating a reference runs one recursive query over reference links from the new target, looking for the source. There is no depth cap, because a cap would let longer loops through. The query uses Postgres's `CYCLE` clause, so it still ends if a loop ever slipped in. The link picker runs the same query in reverse to grey out targets that would close a loop. A closure table only if a test on a large synthetic graph (a Phase 3 task) shows the query is too slow.

## Search: one central index until body search

MVP search covers titles and metadata, which all live in the entity index, so a per-provider search model adds nothing yet. Full-text search with the `simple` configuration plus `pg_trgm` on the display name (typos and partial words), and exact tag matches through the tag tables ([[02-prd/03-features/01-synergy/research/07-search-across-modules|research 07]]). Both GIN indexes lead with `user_id` (`btree_gin`), so a search reads only the caller's rows instead of every user's. Lexicon aliases and abbreviations ("WR") could join through an optional `search_aliases` column in Phase 4. Revisit when body-text search or the Phase 6 embeddings arrive.

## Outbox: 90-day retention, no cold storage

The outbox carries change events for later readers (notifications, Factory automations, cache warming, reindexing). Lasting history lives in the version log and the actor and reason fields, so the outbox is a delivery queue, not a log. Each reader keeps a bookmark of the last event it processed; an event is deleted once it is behind every reader's bookmark and older than 90 days, so a reader fixed after a bug can move its bookmark back and process events again. A reader that stops holds every later event (on purpose: no event is lost), so its lag needs an alert, and a retired reader's bookmark is removed by a migration or an `ops` script. Nothing reads the outbox in Phase 3 and one user's rows are small, so bookmarks and the pruning job arrive with the first reader.

Each row stores `pg_current_xact_id()`, and this can't be rebuilt for rows written without it. On its own it is not commit order: a transaction gets its id at its first write, so transaction 100 can commit after 101, the same gap a `bigserial` id has (corrected in Synergy lesson 5). A reader therefore reads in `(xact_id, id)` order and only below `pg_snapshot_xmin(pg_current_snapshot())`, the oldest transaction still running, so no event can commit behind its bookmark. The [[03-system-design/functional-design/04-synergy/00-overview|overview]] lists every event kind. Readers connect as the read-only role `outbox_reader`, which a `SELECT` policy lets see every row of the outbox and nothing else, because readers work across users. The outbox and idempotency keys are non-syncable and hard-deleted ([[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]]).

## Decision History

- 2026-10-30 · accepted · Synergy Store Choices
- 2026-11-24 · accepted · Outbox: `xact_id` alone isn't commit order, readers stop at the snapshot's xmin; retention by reader bookmarks; the reader role is `outbox_reader` (Synergy lesson 5)
