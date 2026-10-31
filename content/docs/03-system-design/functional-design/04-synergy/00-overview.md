---
publish: true
id: system-design.functional-design.synergy.overview
title: "Synergy: system design"
created: 2026-10-30
updated: 2026-10-31
kind: spec
version: 1.1.0
tags:
   - system-design
   - synergy
applies_to:
   - "[[02-prd/03-features/01-synergy/spec]]"
   - "[[04-plans/phase-3-graph-store-metadata-service]]"
---

How Synergy is built. The PRD and [[02-prd/03-features/01-synergy/spec|spec]] say what it does; this page and the decisions it links say where each piece lives and how the pieces meet. Terms follow [[06-decisions/technical/mentions-and-link-lifetime|Mentions and link lifetime]].

## Packages

![[synergy-packages.svg|700]]

An arrow means "imports". The features registry and the type packages register their linkable types with `synergy/server`; `apps/web` renders links with `synergy/react`. Only `foundation/core` talks to Postgres.

| Package                                        | Holds                                                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core` (foundation)                   | DB client and RLS (`withRLS`), auth (`resolveApiCaller`), `withApiGuard`, entitlements, logging. Unchanged by Synergy.                                                   |
| `packages/platform/synergy` (platform)         | Synergy's tables and migrations, its repository (the only access path), the rules, the resolver and renderer contracts, the save call, and the Rich Live Link component. |
| `packages/ui` (foundation)                     | Design-system primitives the component builds on; later the editor and the Lexicon matcher.                                                                              |
| Providers (`packages/ops` now, features later) | Their own entity tables, plus one registration per linkable type.                                                                                                        |
| `packages/features-registry` or the app        | Assembles every provider's registrations into the maps Synergy receives as data.                                                                                         |
| `apps/web`                                     | Guarded API routes and the playground.                                                                                                                                   |

Synergy ships three entry points, so a browser bundle can never pull in database code:

- `@sidekick/synergy/server`: the repository, the save call and the resolvers' contract. It imports `server-only`.
- `@sidekick/synergy/react`: the Rich Live Link component and the renderers' contract. No database code, so it runs on the server and in the browser.
- `@sidekick/synergy/contracts`: zod schemas and types shared by both, the content helpers (`extractRefs`, the quote re-matcher) and the error codes.

See [[06-decisions/technical/platform-layer|Platform layer]] and [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]].

## Type registration

Each linkable type is registered by the package that provides it, never listed in Synergy. The registration comes in two halves, a server half and a React half, one per entry point:

```ts
// server half, imported from '@sidekick/synergy/server'
interface LinkableTypeServer {
   provider: string; // the registering package, e.g. 'ops', 'taxila'
   type: string; // e.g. 'note', 'datum', 'tweet'
   entitlement: string; // feature key whose entitlement gates it, e.g. 'sandbox'
   // batched: one call per provider per page; returns JSON only, so it can be cached and sent to any consumer
   resolve(
      tx: Tx,
      requests: readonly ResolveRequest[],
   ): Promise<ReadonlyMap<string, RenderData>>;
   // writes an anchor mark into the target's content when a link to a passage is made; returns the anchor id
   addAnchor(tx: Tx, entityId: string, at: PassageAddress): Promise<string>;
}

// React half, imported from '@sidekick/synergy/react'
interface LinkableTypeReact {
   type: string;
   render(data: RenderData, display: "card" | "preview"): ReactNode; // pure: no fetching, no hooks, no browser APIs
}
```

`resolve` fetches and always runs on the server; `render` only turns the fetched data into React, so it runs wherever the component runs. Sidekick renders in both places: in a server component for a page's first paint, and in the browser when the editor inserts or changes a link, where the component fetches the new link's data through `POST /links/resolve` and renders it on the spot. A third party (Notion, Slack, a bot) uses the same JSON and renders it its own way. The registry or the app builds both maps and passes them to Synergy, so neither `core` nor Synergy imports a provider ([[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]], option A). Feature flags are separate and come later.

## Keys, never copy

Synergy holds no user-visible text ([[03-system-design/non-functional/content/centralized-copy|Centralized copy]]; Pratik, 2026-10-31). Everything it stores or returns is a stable key, and every label comes from `packages/copy`, so a term can be renamed or translated without a migration or an API change:

- `provider` and `type` on registrations and index rows (`ops`, `note`): the type's label ("Note") is a copy key such as `synergy.type.ops.note`.
- Relation types store a `source_key` and a `target_key`, named by the end that reads them (`explained-by` at the source, `explains` at the target); "explained by" on screen comes from copy. User-defined types (post-MVP) are the exception, because their names are the user's own content.
- Statuses, states, marks and display types are enums (`deprecated`, `no_longer_linked`, `passage_removed`), and error codes carry no message; the client looks up the message by code.
- The resolved link and every API response carry keys only. Sidekick's UI and the Rich Live Link map them through copy; a third party maps them its own way.

User content (titles, display names, labels, change notes, tag names) is stored as written.

## Tables (Synergy's migrations)

![[synergy-tables.svg|700]]

An arrow points from a table to the tables that hang off it. `relationships.from_id` and `to_id` are `entity_index` ids (left out of the drawing to keep it readable). The outbox and idempotency keys are not synced and are hard-deleted.

**Every table:** client-generated UUIDs, `user_id`, `created_at`, `updated_at`, provenance (actor kind: person, system, agent or API key; actor id; reason), and RLS comparing `user_id = nullif(current_setting('app.current_user_id', true), '')::uuid`. Syncable tables soft-delete; every unique index on them is partial (`WHERE deleted_at IS NULL`), so a tombstone never blocks re-adding the same tag or saving the same item again. How tombstones stay visible to Synergy is in [Tombstones](#tombstones).

- **`entity_index`**: id, provider, type, display name, optional title, status (`active`, `deprecated`, `superseded`), version, revision, `content_seq`, `edited_at`, `deleted_at`. "Deleted" is shown from `deleted_at`, not stored as a status, so a restore brings back whatever status the entity had. No external-reference columns ([[06-decisions/technical/capture-external-content|Capture external content]]).
- **`content_seq`** goes up on every write to an entity's content: revision saves, version saves, and anchors added for someone else's link. It is the token for the stale-write check, the ETag and the render cache key. `version` and `revision` keep their meaning and only drive the dots ([[06-decisions/technical/content-sequence|Content sequence]]).
- **`version_log`**: entity, version, optional change note, actor, time.
- **`entity_anchors`**: entity, anchor id, `removed_in_version` (empty while the passage exists). One row per passage that a link points at, written when the first link to it is made. A reference whose anchor row has `removed_in_version` set shows "passage removed".
- **`entity_mentions`**: entity, relationship id. The direct and alias mentions in the entity's content, as last reported by its provider ([Save content](#write-path)). `relationships.mentioned` is kept true while the relationship's source has a row here.
- **`relationships`**: from, to, `role` (`solo`, `list` or `member`), parent and position (members), optional label, type (never empty), version and revision snapshot, `to_anchor_id` and `to_anchor_quote` (empty for a whole-entity target), `cited`, `mentioned`, tombstone (actor, reason, `deletion_batch_id`).
   - Members copy their list row's `from`, `type` and role into a composite FK `(parent_id, from_id, type, parent_role) → (id, from_id, type, role)` with `parent_role` fixed to `list` by a CHECK, so a member can't point at another member and every member is a complete edge with its own type. A list row has no `to`; solos and members do (CHECK).
   - `type` is NOT NULL so the FK can't be skipped (Postgres ignores a composite FK when any column is null). An untyped link uses the seeded system type `untyped`, kind reference, which displays no type name.
   - Positions are fractional text keys (lexorank) with a unique index on `(parent_id, position)`, so moving one member writes one row.
   - `deletion_batch_id` groups the tombstones written by one delete, so a restore brings back exactly that batch.
- **`relation_types`**: `source_key` (the type's identity, which `relationships.type` references), `target_key`, kind (reference or association; `untyped` and `superseded-by` are system rows of kind reference, not extra kinds), status, system flag; seeded with the starter vocabulary plus `untyped`. Labels live in copy.
- **`tags`** and **`tag_applications`**: as in the spec, with the format check constraint.
- **`outbox`**: event type, subject, actor, payload, time, and `xact_id` (`pg_current_xact_id()`), which lets a reader process events in commit order. A long transaction can commit a lower `bigserial` id after a reader has moved past it; the transaction id can't be rebuilt later, so it is stored from the first row. Event types: entity created, content saved, version bumped, status changed, entity deleted, restored or erased; relationship created, updated (label or type), cited, uncited, deleted or restored; snapshot moved (the referencer confirmed the link still holds); passage removed; tag created, renamed, merged or deprecated; tag applied or removed. Read by a dedicated read-only role outside RLS, since readers work across users. 90-day retention after every reader has processed it.
- **`idempotency_keys`** for creates.

The outbox and idempotency keys are **non-syncable**: hard delete, no soft-delete triggers, so pruning works.

Each provider table has a deferrable foreign key to `entity_index(id)`, so a provider row can't exist without its index row.

### Tombstones

Synergy must see its own tombstones: a deleted target still shows its name, "No longer linked" must differ from "never existed", and undo and restore update deleted rows. Three of the existing database templates prevent that, so Synergy departs from them ([[06-decisions/technical/tombstone-visibility|Tombstone visibility]]):

- **RLS compares only `user_id`.** The repository filters `deleted_at IS NULL` in each query that needs live rows. The template in [[03-system-design/non-functional/security/row-level-security|Row-level security]] also hides deleted rows in `USING`.
- **Restore may update a deleted row.** The update trigger allows an update to a deleted row only when it restores it (`NEW.deleted_at IS NULL`). Every other update to a tombstone is still refused.
- **Hard delete only on the non-syncable tables** (outbox, idempotency keys), which carry no soft-delete triggers.

### Indexes

`to_id` (backlinks), `(to_id, to_anchor_id)` (passage check), `from_id`, the unique `(parent_id, position)`, `entity_anchors (entity_id, anchor_id)`, `entity_mentions (entity_id)` and `(relationship_id)`, tag applications by tag, index rows by owner and status, an index on outbox `xact_id`, and the search indexes. Trigram and full-text GIN indexes lead with `user_id` (`btree_gin`: `(user_id, display_name gin_trgm_ops)` and the same for the `simple` tsvector), so a search reads one user's rows instead of every user's.

## Write path

A provider saves inside one `withRLS` transaction: it writes its own row, then calls Synergy in the same transaction.

![[synergy-save.svg|360]]

**Every Synergy write takes the per-user lock first**: `pg_advisory_xact_lock(hashtextextended(user_id::text, 0))`, before it reads or writes anything. That covers the delete block and the cycle check against each other (a delete and a new reference into the same target can't both commit), and one fixed lock order means no deadlocks between a save and a link create. For one user the contention is negligible.

- **Create:** register the entity's index row (id, provider, type, display name).
- **Save content:** the provider sends the base `content_seq`, revision or version, the optional change note, and the **current sets** it extracts from the new content with `extractRefs`: every block and anchor id, and every relationship id the content mentions. It also declares the links this save creates (below). Synergy then:
   1. checks `content_seq` (409 `stale_content` on a stale one);
   2. compares the sets with `entity_anchors` and `entity_mentions` itself;
   3. refuses `passage_referenced` if a reference points at an anchor that's gone and this isn't a new version; on a new version, sets `removed_in_version` on those anchor rows;
   4. tombstones associations into gone anchors, moving only their sources' `updated_at` (actor system, with the reason);
   5. refuses a mention whose relationship has neither end at this entity;
   6. updates `entity_mentions` and `mentioned`, and tombstones links with neither `cited` nor `mentioned`;
   7. bumps `content_seq`, the revision or version, and `edited_at`, and writes the outbox events.

   Sending the current set instead of the changes makes the call self-healing (a missed or buggy save is corrected by the next one) and safe to retry, and the comparison is written once, in Synergy ([[06-decisions/technical/anchors-in-content|Anchors in content]]).

- **Link from content:** the editor generates the relationship id, writes it into the mark, and the save that carries the mark declares the new link (target, anchor, type, label). Synergy creates it in that transaction with `mentioned = true` and `cited = false`, so removing the text later removes the link.
- **Link from a field, the links panel or the API** (`POST /links`): creates a cited link (`cited = true`).
- **Every link create** snapshots the target's version and revision and runs the cycle check for a reference. A passage target calls the target provider's `addAnchor`, which writes the mark into the target and moves its `content_seq` and `updated_at`, never its version or revision. The response carries an **anchor receipt** per passage target, `{ targetId, contentSeq, anchor: { id, blockId, quote } }`, so an editor in the same page that has the target open adds the mark itself and moves its base `content_seq` (no 409). Not the whole target: version and revision don't change on an anchor write, and the request was about the source. An editor the receipt can't reach (another tab, another device) gets 409 on its next save; it fetches the latest content, copies in the anchors it lacks (by block id and quote) and saves again, with nothing shown to the user. The 409 merge is the guarantee; the receipt only saves a round trip.
- **Supersede:** a `superseded-by` link, stored from the old entity to each replacement, kind reference. An entity may have any number of successors. Creating the first one marks the source superseded, after the confirmation that reports how many entities reference it (`confirmation_required` until the request confirms). Removing the last one sets the source back to active.
- **Status, tags, cite and uncite:** metadata writes that bump no counter.
- **Delete:** refused with `delete_blocked` while a live reference points at the entity; otherwise soft-delete, which tombstones its outgoing links under one `deletion_batch_id`. Erasure overrides.
- **Restore and undo** (restore an entity, undo an unlink, relink): bring back the same rows, but only after re-running the delete block and the cycle check under the lock, because the graph may have changed since. A restored reference into a tombstone, or one that would close a cycle, is refused with `restore_conflict`, naming each edge.

## Read path

1. The guarded route reads the caller's relationships joined to the target index rows: one query per page, cursor-paged.
2. For each link it decides the state on the server, before any resolver runs: unknown (the type's provider isn't registered; shown like locked), locked (the type's `entitlement` isn't enabled for the caller), deleted, redacted (later), then the marks (edited, changed) and "passage removed" from the snapshot and `entity_anchors`.
3. Inline and minimal mentions need nothing more. Card and preview mentions are grouped by provider and resolved with one batched `resolve` call each, through the render cache keyed by (entity, `content_seq`, display type).
4. The cache holds render data only. Status, states and marks are read fresh from the index on every request, including the states of links shown inside a live preview: a preview's render data carries relationship ids, never their states.
5. The response is the resolved link (frozen as a zod schema in `/contracts`): relationship, target index fields, state, marks, and render data when asked for. An entity's read response also carries the roll-up of its outgoing references and `ETag: "<content_seq>"`.

## API

Entity content (create, save, delete, restore) goes through each provider's own routes, which call Synergy in the same transaction. Synergy's routes, all through `withApiGuard`, under `/api/synergy`:

| Method and path                         | Request                                                   | Response                                          | Errors                                                                           |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /entities/:id`                     | `If-None-Match` (optional)                                | index fields, roll-up, `ETag`; 304 when unchanged | `not_found`                                                                      |
| `PATCH /entities/:id/status`            | `{ status: 'active' \| 'deprecated' }`                    | index fields                                      | `not_found`                                                                      |
| `GET /entities/:id/versions`            | cursor                                                    | version log page                                  | `not_found`                                                                      |
| `GET /entities/:id/links`               | `direction` (`out` or `in`), cursor                       | resolved links page (`in` = backlinks)            | `not_found`                                                                      |
| `POST /links`                           | id, from, to, anchor, type, label, `confirm`; idempotency | resolved link, anchor receipt                     | `cycle`, `locked`, `deprecated_vocabulary`, `confirmation_required`, `not_found` |
| `PATCH /links/:id`                      | label, type, `cited`, list position                       | resolved link                                     | `cycle`, `deprecated_vocabulary`, `not_found`                                    |
| `DELETE /links/:id`                     | none                                                      | tombstone                                         | `not_found`                                                                      |
| `POST /links/:id/restore`               | none                                                      | resolved link                                     | `restore_conflict`, `not_found`                                                  |
| `POST /links/:id/snapshot`              | none (moves the snapshot: "still holds")                  | resolved link                                     | `not_found`                                                                      |
| `POST /links/resolve`                   | `[{ relationshipId, display }]`                           | resolved links, in request order                  | none per item: a missing one resolves as not found                               |
| `GET /search`                           | `q`, type, provider, status, tag, cursor                  | index rows page                                   | none                                                                             |
| `GET /tags`, `POST /tags`               | cursor; name, description; idempotency                    | tags page; tag                                    | `invalid_tag`                                                                    |
| `PATCH /tags/:id`                       | rename, description, deprecate, merge into                | tag                                               | `invalid_tag`, `not_found`                                                       |
| `PUT` / `DELETE /tags/:id/applications` | entity or relationship id                                 | application                                       | `deprecated_vocabulary`, `not_found`                                             |
| `GET /relation-types`                   | none                                                      | vocabulary                                        | none                                                                             |

`POST /links/resolve` is how a client asks for card and preview data: the server never parses content, so only the client knows each mention's display type.

### "Page updated"

A page someone is viewing or editing can learn that the entity changed elsewhere (another device, an agent, a bot) and offer "Page updated, reload". The foundation is already in the API: `GET /entities/:id` with `If-None-Match: "<content_seq>"` answers 304 with no body while nothing changed, so a check is one indexed read. Any module's page can use it, because the check is per entity in Synergy, not per module.

- **MVP client strategy** (built with the shared editor, not in Phase 3): check when the tab regains focus or becomes visible, and every 30 seconds while it is visible; tabs of one browser tell each other through `BroadcastChannel`. While editing, the banner warns early; the 409 merge still protects the save.
- **Post-MVP: push** instead of polling, fed by the outbox (server-sent events or Supabase Realtime broadcast from the server). It changes how the client hears about a change, not the API.

| Error code                                                                                                    | HTTP |
| ------------------------------------------------------------------------------------------------------------- | ---- |
| validation failure                                                                                            | 400  |
| not signed in (from the guard)                                                                                | 401  |
| `locked` (link into a provider the account doesn't have)                                                      | 403  |
| `not_found`: also for another user's ids, so a response never reveals whether an id exists                    | 404  |
| `stale_content`, `delete_blocked`, `passage_referenced`, `cycle`, `restore_conflict`, `confirmation_required` | 409  |
| `invalid_tag`, `deprecated_vocabulary`                                                                        | 422  |

## Rich Live Link

Lives in Synergy (`/react`) and builds on `ui` primitives. It renders on the server and in the browser. It takes the mentions to show and a **transport**, `resolveLinks(requests) => Promise<ResolvedLink[]>`, so the host decides how the request travels: a Sidekick server component calls the same handler as `POST /links/resolve`, Sidekick's browser code (the editor inserting a link) calls the route with the session cookie, and a third party calls it with its own credentials. It owns the frame and every state, and calls the registered renderers with the resolved render data. The display type belongs to each mention.

## Content helpers

- **`extractRefs(content)`** walks Tiptap JSON and returns the block and anchor ids and the mentioned relationship ids. Every provider uses it to build the sets for the save call.
- **The quote re-matcher** finds a quote in new content: Markdown import and Refresh of captured external content use it to re-attach anchors. When the best match is weak, the user is asked instead of the match being guessed.
- **Post-MVP candidate:** a block-level patch endpoint for bots and agents, which handle whole Tiptap documents with marks they don't understand poorly.

## Testing

Integration tests through the guarded API are the main seam; the component is tested in Vitest browser mode with MSW ([[03-system-design/non-functional/testing/testing-layers|Testing layers]]). Synergy adds:

- **Race tests with two database connections:** an anchor added while the target is open (stale save gets 409), a delete and a new reference into the same target (one fails), and a restore after the graph changed (`restore_conflict`).
- A test pinning spec story 71 ("dep wor" finds "deep work"), tuning trigram `word_similarity` until it passes.
