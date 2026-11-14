---
publish: true
id: system-design.functional-design.synergy.overview
title: "Synergy: System Design"
created: 2026-10-30
updated: 2026-11-14
kind: spec
version: 1.5.0
tags:
   - system-design
   - synergy
applies_to:
   - "[[02-prd/03-features/01-synergy/spec]]"
   - "[[04-phases/03-synergy/00-plan]]"
---

How Synergy is built. The PRD and [[02-prd/03-features/01-synergy/spec|spec]] say what it does; this page and the decisions it links say where each piece lives and how the pieces meet. Terms follow [[03-system-design/functional-design/04-synergy/mentions-and-link-lifetime|Mentions and link lifetime]].

**D198** `decision` #synergy #database: Synergy is a graph pattern on plain PostgreSQL, not a graph database, and its own repository is the only access path and the one place to change if scale ever needs a graph engine. derived-from [[D8]]

Synergy is a graph _pattern_, not a graph _database_. At this scale, plain PostgreSQL tables with recursive queries are enough, and everything goes through Synergy's own repository, which is the one place to change if scale ever calls for a dedicated graph engine.

## Packages

![[synergy-packages.svg|700]]

An arrow means "imports". The features registry and the type packages register their linkable types with `synergy/server`; `apps/app` renders links with `synergy/react`. Only `foundation/core` talks to Postgres.

| Package                                    | Holds                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/foundation/core`                 | DB client and RLS (`withRLS`), auth (`resolveApiCaller`), `withApiGuard`, entitlements, logging. Unchanged by Synergy.                                                    |
| `packages/platform/synergy`                | Synergy's tables and migrations, its repository (the only access path), the rules, the resolver and renderer contracts, the save call, and the Sneak Peek Link component. |
| `packages/foundation/ui`                   | Design-system primitives the component builds on; later the editor and the Lexicon matcher.                                                                               |
| Providers (`_sandbox` now, features later) | Their own entity tables, plus one registration per linkable type.                                                                                                         |
| `packages/features-registry` or the app    | Assembles every provider's registrations into the maps Synergy receives as data.                                                                                          |
| `apps/app`                                 | Guarded API routes and the playground; fetches and translates links for the Sneak Peek Link.                                                                              |

**D199** `decision` #synergy #monorepo: Synergy ships three entry points, `/server`, `/react` and `/contracts`, so a browser bundle can never pull in database code. derived-from [[D57]] derived-from [[D17]]

Synergy ships three entry points, so a browser bundle can never pull in database code:

- `@sidekick/synergy/server`: the repository, the save call and the resolvers' contract. It imports `server-only`.
- `@sidekick/synergy/react`: the Sneak Peek Link component and the renderers' contract. No database code, so it runs on the server and in the browser.
- `@sidekick/synergy/contracts`: zod schemas and types shared by both, the content helpers (`extractRefs`, the quote re-matcher) and the error codes.

See [[03-system-design/non-functional/monorepo/dependency-flow|Platform layer]] and [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]].

## Type registration

**D200** `decision` #synergy #registry: Each linkable type is registered by its provider in two halves, a server half that resolves and a pure React half that renders, and the registry hands Synergy the maps as data, so Synergy never imports a provider. derived-from [[D187]] derived-from [[D182]]

Each linkable type is registered by the package that provides it, never listed in Synergy. The registration comes in two halves, a server half and a React half, one per entry point:

```ts
// server half, imported from '@sidekick/synergy/server'
interface LinkableTypeServer {
   provider: string; // the registering package, e.g. 'sandbox-notes', 'taxila'
   type: string; // e.g. 'note', 'datum', 'tweet'
   entitlement: string; // feature key whose entitlement gates it, e.g. 'sandbox-notes'
   // the words Synergy draws itself, as keys in the provider's own catalog (D250)
   messages: {
      label: MessageRef;
      count?: MessageRef;
      description?: MessageRef;
   };
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
   // pure: no fetching, no hooks, no browser APIs; `word` looks a MessageRef up in the host's `words` (D251)
   render(
      data: RenderData,
      display: "card" | "preview",
      word: (ref: MessageRef) => string,
   ): ReactNode;
}
```

`resolve` fetches and always runs on the server; `render` only turns the fetched data into React, so it runs wherever the component runs. Sidekick renders in both places: in a server component for a page's first paint, and in the browser when the editor inserts or changes a link, where the App's client wrapper fetches the new link's data through `POST /links/resolve` and the component renders it on the spot ([[D251]]). A third party (Notion, Slack, a bot) uses the same JSON and renders it its own way. The registry or the app builds both maps and passes them to Synergy, so neither `core` nor Synergy imports a provider ([[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]], option A). Feature flags are separate and come later.

## Keys, never copy

**D201** `decision` #synergy #copy: Synergy stores and returns keys only (types, statuses, states, error codes, message references); every word comes from a catalog, the provider's for its words and Synergy's for its own, and only user content is stored as written. derived-from [[D243]]

Synergy holds no user-visible text (Pratik, 2026-10-31; catalogs since [[03-system-design/non-functional/content/internationalization|Internationalization]], 2026-11-06). Everything it stores or returns is a stable key, so a term can be renamed or translated without a migration or an API change:

- `provider` and `type` on registrations and index rows (`sandbox-notes`, `note`). The type's label ("Note") lives in the **provider's** catalog, and the registration names its key ([[D250]]); deleting a provider deletes its words.
- Relation types store a `source_key` and a `target_key`, named by the end that reads them (`explained-by` at the source, `explains` at the target); "explained by" on screen comes from Synergy's own catalog, as do link states and marks. Synergy may build keys only in its own `synergy` namespace. User-defined types (post-MVP) are the exception, because their names are the user's own content.
- Statuses, states, marks and display types are enums (`deprecated`, `no_longer_linked`, `passage_removed`), and error codes carry no message; the client looks up the message by code.
- The resolved link and every API response carry keys only. The host turns them into words ([[D251]]); a third party maps them its own way, with Synergy's exported catalog and the providers'.

**D250** `decision` #synergy #i18n: Every word a provider hands to Synergy is a message reference, `{ key, values? }`, with a fully qualified key the provider names: in its registration for the words Synergy draws itself, and anywhere in its render data for the rest; Synergy never builds, parses or stores a provider's key. derived-from [[D201]] derived-from [[D243]]

```ts
// /contracts
type MessageRef = { key: string; values?: Record<string, string | number> };
```

A naming convention (`<provider>.type.<type>`) only covers words Synergy can predict (Pratik, 2026-11-06). With references:

- **Synergy keeps no provider words** and **assumes no provider keys**: the provider names each key.
- **Any word can travel**: a status, a field label, a plural count. `values` fills the ICU message's blanks (`{count}`, `{folder}`), never translations; a reference holds no words in any language.
- **The registration's `messages` slots** cover what Synergy draws without calling the resolver (inline and minimal mentions, search rows): `label`, `count`, `description`. More slots are added when Synergy needs them; nothing else changes.
- **TypeScript checks the keys**: a provider types its refs against its own `en.json` with use-intl's `MessageKeys`, and a registry test checks every registration ref against the merged catalogs, as Atlassian Forge and Shopify check manifest keys at deploy time.
- Precedent: hosts that draw a plugin's words have the manifest name the key (VS Code's `%key%`, Chrome's `__MSG_key__`, Forge, Shopify). Research: the project's `i18n-ui/provider-copy-options.md`.
- Keep a provider's word as a standalone label: dropping a noun into one of Synergy's sentences breaks [[D244]] in languages where nouns change form.
- The same shape carries validation errors ([[D252]]).

User content (titles, display names, labels, change notes, tag names) is stored as written.

## Tables (Synergy's migrations)

![[synergy-tables.svg|700]]

An arrow points from a table to the tables that hang off it. `relationships.from_id` and `to_id` are `entity_index` ids (left out of the drawing to keep it readable). The outbox and idempotency keys are not synced and are hard-deleted.

**Every table:** client-generated UUIDs, `user_id`, `created_at`, `updated_at`, provenance (actor kind: `human`, `system`, `agent` or `api_key`; actor id, empty only for `system`; reason), recording the row's last write, and RLS comparing `user_id = nullif(current_setting('app.current_user_id', true), '')::uuid`. Syncable tables soft-delete; every unique index on them is partial (`WHERE deleted_at IS NULL`), so a tombstone never blocks re-adding the same tag or saving the same item again. How tombstones stay visible to Synergy is in [Tombstones](#tombstones).

- **`entity_index`**: id, provider, type, display name, optional title, status (`active`, `deprecated`, `superseded`), version, revision, `content_seq`, `edited_at`, `deleted_at`. "Deleted" is shown from `deleted_at`, not stored as a status, so a restore brings back whatever status the entity had. No external-reference columns ([[03-system-design/functional-design/04-synergy/capture-external-content|Capture external content]]).
- **`content_seq`** goes up on every write to an entity's content: revision saves, version saves, and anchors added for someone else's link. It is the token for the stale-write check, the ETag and the render cache key. `version` and `revision` keep their meaning and only drive the dots ([[03-system-design/functional-design/04-synergy/content-sequence|Content sequence]]).
- **`version_log`**: entity, version, optional change note, actor, time.
- **`entity_anchors`**: entity, anchor id, `removed_in_version` (empty while the passage exists). One row per passage that a link points at, written when the first link to it is made. A reference whose anchor row has `removed_in_version` set shows "passage removed".
- **`entity_mentions`**: entity, relationship id. The direct and alias mentions in the entity's content, as last reported by its provider ([Save content](#write-path)). `relationships.mentioned` is kept true while the relationship's source has a row here.
- **`relationships`**: from, to, `role` (`solo`, `list` or `member`), parent and position (members), optional label, type (never empty), version and revision snapshot, `to_anchor_id` and `to_anchor_quote` (empty for a whole-entity target), `cited`, `mentioned`, tombstone (actor, reason, `deletion_batch_id`).
   - Members copy their list row's `from`, `type` and role into a composite FK `(parent_id, from_id, type, parent_role) → (id, from_id, type, role)` with `parent_role` fixed to `list` by a CHECK, so a member can't point at another member and every member is a complete edge with its own type. A list row has no `to`; solos and members do (CHECK).
   - `type` is NOT NULL so the FK can't be skipped (Postgres ignores a composite FK when any column is null). An untyped link uses the seeded system type `untyped`, kind reference, which displays no type name.
   - Positions are fractional text keys (lexorank) with a unique index on `(parent_id, position)`, so moving one member writes one row.
   - `deletion_batch_id` groups the tombstones written by one delete, so a restore brings back exactly that batch.
- **`relation_types`**: `source_key` (the type's identity, which `relationships.type` references), `target_key`, kind (reference or association; `untyped` and `superseded-by` are system rows of kind reference, not extra kinds), status, system flag; seeded with the starter vocabulary plus `untyped`, including `violates` (association) and `exception-to` (reference) ([[03-system-design/functional-design/04-synergy/violations-and-exceptions|Violations and exceptions]]). Labels live in Synergy's own catalog.
- **`tags`** and **`tag_applications`**: as in the spec, with the format check constraint.
- **`outbox`**: event type, subject, actor, payload, time, and `xact_id` (`pg_current_xact_id()`), which lets a reader process events in commit order. A long transaction can commit a lower `bigserial` id after a reader has moved past it; the transaction id can't be rebuilt later, so it is stored from the first row. Event types: entity created, content saved, version bumped, status changed, entity deleted, restored or erased; relationship created, updated (label or type), cited, uncited, deleted or restored; snapshot moved (the referencer confirmed the link still holds); passage removed; tag created, renamed, merged or deprecated; tag applied or removed. Read by a dedicated read-only role outside RLS, since readers work across users. 90-day retention after every reader has processed it.
- **`idempotency_keys`** for creates.

The outbox and idempotency keys are **non-syncable**: hard delete, no soft-delete triggers, so pruning works.

Each provider table has a deferrable foreign key to `entity_index(id)`, so a provider row can't exist without its index row.

### Tombstones

Synergy must see its own tombstones: a deleted target still shows its name, "No longer linked" must differ from "never existed", and undo and restore update deleted rows. Three of the existing database templates prevent that, so Synergy departs from them ([[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]]):

- **RLS compares only `user_id`.** The repository filters `deleted_at IS NULL` in each query that needs live rows. The template in [[03-system-design/non-functional/security/row-level-security|Row-level security]] also hides deleted rows in `USING`.
- **Restore may update a deleted row.** The update trigger allows an update to a deleted row only when it restores it (`NEW.deleted_at IS NULL`) and changes nothing but `deleted_at` and the provenance columns ([[D263]]). Every other update to a tombstone is still refused.
- **Hard delete only on the non-syncable tables** (outbox, idempotency keys), which carry no soft-delete triggers.

### Indexes

`to_id` (backlinks), `(to_id, to_anchor_id)` (passage check), `from_id`, the unique `(parent_id, position)`, `entity_anchors (entity_id, anchor_id)`, `entity_mentions (entity_id)` and `(relationship_id)`, tag applications by tag, `relationships (user_id, type)` (links by type across the graph), index rows by owner and status, an index on outbox `xact_id`, and the search indexes. Trigram and full-text GIN indexes lead with `user_id` (`btree_gin`: `(user_id, display_name gin_trgm_ops)` and the same for the `simple` tsvector), so a search reads one user's rows instead of every user's.

## Write path

A provider saves inside one `withRLS` transaction: it writes its own row, then calls Synergy in the same transaction.

![[synergy-save.svg|360]]

**D202** `decision` #synergy #concurrency: Every Synergy write takes the per-user advisory lock before it reads anything, so the delete block and the cycle check can't race and there is one lock order. derived-from [[D117]] derived-from [[D95]]

**Every Synergy write takes the per-user lock first**: `pg_advisory_xact_lock(hashtextextended(current_setting('app.current_user_id'), 0))`, keyed on the user `withRLS` set, before it reads or writes anything. That covers the delete block and the cycle check against each other (a delete and a new reference into the same target can't both commit), and one fixed lock order means no deadlocks between a save and a link create. For one user the contention is negligible.

**D265** `rule` #synergy #concurrency #lint: Every write in Synergy's repository runs inside `withUserLock(...)`, which takes the user lock before the write function runs; the lint rule `sidekick/require-user-lock` fails any insert, update or delete in `src/repository/` outside it. derived-from [[D202]]

The bare lock function isn't exported, so the wrapper is the only way to take it. The rule checks every write call, so a helper that writes must be wrapped too; taking the lock twice in one transaction is free. It can't see raw SQL through `tx.execute`. A provider writes its own row before calling Synergy, which in lesson 10 (`addAnchor` writing a provider row under the lock) could deadlock two tabs; lesson 4 makes provider write transactions take the user lock at their start.

- **Create:** register the entity's index row (id, provider, type, display name).
- **Save content:** the provider sends the base `content_seq`, revision or version, the optional change note, and the **current sets** it extracts from the new content with `extractRefs`: every block and anchor id, and every relationship id the content mentions. It also declares the links this save creates (below). Synergy then:
   1. checks `content_seq` (409 `stale_content` on a stale one);
   2. compares the sets with `entity_anchors` and `entity_mentions` itself;
   3. refuses `passage_referenced` if a reference points at an anchor that's gone and this isn't a new version; on a new version, sets `removed_in_version` on those anchor rows;
   4. tombstones associations into gone anchors, moving only their sources' `updated_at` (actor system, with the reason);
   5. refuses a mention whose relationship has neither end at this entity;
   6. updates `entity_mentions` and `mentioned`, and tombstones links with neither `cited` nor `mentioned`;
   7. bumps `content_seq`, the revision or version, and `edited_at`, and writes the outbox events.

   Sending the current set instead of the changes makes the call self-healing (a missed or buggy save is corrected by the next one) and safe to retry, and the comparison is written once, in Synergy ([[03-system-design/functional-design/04-synergy/anchors-in-content|Anchors in content]]).

- **Link from content:** the editor generates the relationship id, writes it into the mark, and the save that carries the mark declares the new link (target, anchor, type, label). Synergy creates it in that transaction with `mentioned = true` and `cited = false`, so removing the text later removes the link.
- **Link from a field, the links panel or the API** (`POST /links`): creates a cited link (`cited = true`).
- **Every link create** snapshots the target's version and revision and runs the cycle check for a reference. A passage target calls the target provider's `addAnchor`, which writes the mark into the target and moves its `content_seq` and `updated_at`, never its version or revision. The response carries an **anchor receipt** per passage target, `{ targetId, contentSeq, anchor: { id, blockId, quote } }`, so an editor in the same page that has the target open adds the mark itself and moves its base `content_seq` (no 409). Not the whole target: version and revision don't change on an anchor write, and the request was about the source. An editor the receipt can't reach (another tab, another device) gets 409 on its next save; it fetches the latest content, copies in the anchors it lacks (by block id and quote) and saves again, with nothing shown to the user. The 409 merge is the guarantee; the receipt only saves a round trip.
- **Change a link's type** (`PATCH /links/:id`): runs the cycle check when the new type is a reference. A change from an association to a reference also moves the snapshot to the target's current version and revision, so a waived violation (`violates` retyped to `exception-to`) starts without a dot. An open violation is a live `violates` link; resolving it is `DELETE /links/:id`. There is no violation status ([[03-system-design/functional-design/04-synergy/violations-and-exceptions|Violations and exceptions]]).
- **Supersede:** a `superseded-by` link, stored from the old entity to each replacement, kind reference. An entity may have any number of successors. Creating the first one marks the source superseded, after the confirmation that reports how many entities reference it (`confirmation_required` until the request confirms). Removing the last one sets the source back to active.
- **Status, tags, cite and uncite:** metadata writes that bump no counter.
- **Delete:** refused with `delete_blocked` while a live reference points at the entity; otherwise soft-delete, which tombstones its outgoing links under one `deletion_batch_id`. Erasure overrides.
- **Restore and undo** (restore an entity, undo an unlink, relink): bring back the same rows, but only after re-running the delete block and the cycle check under the lock, because the graph may have changed since. A restored reference into a tombstone, or one that would close a cycle, is refused with `restore_conflict`, naming each edge.

**D203** `decision` #synergy #save: A save reports the current sets of block, anchor and mentioned relationship ids, and Synergy works out what changed, so the call heals itself after a missed save and is safe to retry. derived-from [[D61]] derived-from [[D67]]

**D204** `decision` #synergy #staleness: Every link create snapshots the target's version and revision, and a reference create runs the cycle check. derived-from [[D109]] derived-from [[D94]]

**D205** `decision` #synergy #anchors: A link into a passage returns an anchor receipt, so an editor that has the target open adds the mark itself; the 409 merge on the next save is the guarantee. derived-from [[D63]] derived-from [[D61]]

**D206** `decision` #synergy #supersede: `superseded-by` is a reference stored from the old entity to each of any number of replacements; the first one marks the source superseded after a confirmation, and removing the last sets it back to active. derived-from [[D80]] derived-from [[D81]]

**D207** `decision` #synergy #restore: Restore and undo re-run the delete block and the cycle check under the lock, and are refused with `restore_conflict` naming each edge. derived-from [[D119]] derived-from [[D98]]

## Read path

1. The guarded route reads the caller's relationships joined to the target index rows: one query per page, cursor-paged.
2. For each link it decides the state on the server, before any resolver runs: unknown (the type's provider isn't registered; shown like locked), locked (the type's `entitlement` isn't enabled for the caller), deleted, redacted (later), then the marks (edited, changed) and "passage removed" from the snapshot and `entity_anchors`.
3. Inline and minimal mentions need nothing more. Card and preview mentions are grouped by provider and resolved with one batched `resolve` call each, through the render cache keyed by (entity, `content_seq`, display type).
4. The cache holds render data only. Status, states and marks are read fresh from the index on every request, including the states of links shown inside a live preview: a preview's render data carries relationship ids, never their states.
5. The response is the resolved link (frozen as a zod schema in `/contracts`): relationship, target index fields, state, marks, and render data when asked for. An entity's read response also carries the roll-up of its outgoing references and `ETag: "<content_seq>"`.

**D208** `decision` #synergy #cache: The render cache holds render data only; status, states and marks are read fresh on every request, including for links inside a live preview. derived-from [[D177]] derived-from [[D175]]

## API

Entity content (create, save, delete, restore) goes through each provider's own routes, which call Synergy in the same transaction. Synergy's routes, all through `withApiGuard`, under `/api/synergy`:

| Method and path                         | Request                                                   | Response                                          | Errors                                                                           |
| --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /entities/:id`                     | `If-None-Match` (optional)                                | index fields, roll-up, `ETag`; 304 when unchanged | `not_found`                                                                      |
| `PATCH /entities/:id/status`            | `{ status: 'active' \| 'deprecated' }`                    | index fields                                      | `not_found`                                                                      |
| `GET /entities/:id/versions`            | cursor                                                    | version log page                                  | `not_found`                                                                      |
| `GET /entities/:id/links`               | `direction` (`out` or `in`), `type` (optional), cursor    | resolved links page (`in` = backlinks)            | `not_found`                                                                      |
| `POST /links`                           | id, from, to, anchor, type, label, `confirm`; idempotency | resolved link, anchor receipt                     | `cycle`, `locked`, `deprecated_vocabulary`, `confirmation_required`, `not_found` |
| `PATCH /links/:id`                      | label, type, `cited`, list position                       | resolved link                                     | `cycle`, `deprecated_vocabulary`, `not_found`                                    |
| `DELETE /links/:id`                     | none                                                      | tombstone                                         | `not_found`                                                                      |
| `POST /links/:id/restore`               | none                                                      | resolved link                                     | `restore_conflict`, `not_found`                                                  |
| `POST /links/:id/snapshot`              | none (moves the snapshot: "still holds")                  | resolved link                                     | `not_found`                                                                      |
| `POST /links/resolve`                   | `[{ relationshipId, display }]`                           | resolved links, in request order                  | none per item: a missing one resolves as not found                               |
| `GET /links`                            | `type`, cursor                                            | resolved links page, across every provider        | none                                                                             |
| `GET /search`                           | `q`, type, provider, status, tag, cursor                  | index rows page                                   | none                                                                             |
| `GET /tags`, `POST /tags`               | cursor; name, description; idempotency                    | tags page; tag                                    | `invalid_tag`                                                                    |
| `PATCH /tags/:id`                       | rename, description, deprecate, merge into                | tag                                               | `invalid_tag`, `not_found`                                                       |
| `PUT` / `DELETE /tags/:id/applications` | entity or relationship id                                 | application                                       | `deprecated_vocabulary`, `not_found`                                             |
| `GET /relation-types`                   | none                                                      | vocabulary                                        | none                                                                             |

`POST /links/resolve` is how a client asks for card and preview data: the server never parses content, so only the client knows each mention's display type.

### "Page updated"

**D210** `decision` #synergy #concurrency: A page learns that its entity changed elsewhere by asking `GET /entities/:id` with `If-None-Match`, which answers 304 while nothing changed; pushing changes waits for post-MVP. derived-from [[D63]]

A page someone is viewing or editing can learn that the entity changed elsewhere (another device, an agent, a bot) and offer "Page updated, reload". The foundation is already in the API: `GET /entities/:id` with `If-None-Match: "<content_seq>"` answers 304 with no body while nothing changed, so a check is one indexed read. Any module's page can use it, because the check is per entity in Synergy, not per module.

- **MVP client strategy** (built with the shared editor, not in Phase 3): check when the tab regains focus or becomes visible, and every 30 seconds while it is visible; tabs of one browser tell each other through `BroadcastChannel`. While editing, the banner warns early; the 409 merge still protects the save.
- **Post-MVP: push** instead of polling, fed by the outbox (server-sent events or Supabase Realtime broadcast from the server). It changes how the client hears about a change, not the API.

**D209** `decision` #synergy #api #security: Another user's ids answer `not_found`, the same as ids that never existed, so a response never reveals whether an id exists. derived-from [[D172]]

| Error code                                                                                                    | HTTP |
| ------------------------------------------------------------------------------------------------------------- | ---- |
| validation failure                                                                                            | 400  |
| not signed in (from the guard)                                                                                | 401  |
| `locked` (link into a provider the account doesn't have)                                                      | 403  |
| `not_found`: also for another user's ids, so a response never reveals whether an id exists                    | 404  |
| `stale_content`, `delete_blocked`, `passage_referenced`, `cycle`, `restore_conflict`, `confirmation_required` | 409  |
| `invalid_tag`, `deprecated_vocabulary`                                                                        | 422  |

## Sneak Peek Link

**D251** `decision` #synergy #react: The Sneak Peek Link takes plain data only, the resolved link and a `words` dictionary; the host fetches the link and translates its references, so no function and no i18n provider crosses into the component. derived-from [[D186]] derived-from [[D249]] derived-from [[D250]]

Lives in Synergy (`/react`) and builds on `ui` primitives. It renders on the server and in the browser, owns the frame and every state, and calls the registered renderers with the resolved render data. The display type belongs to each mention.

```tsx
// a server component in apps/app
const t = await getTranslations();
const link = await synergy.resolve(request); // MessageRefs, keys only
<SneakPeekLink link={link} words={translateRefs(link, t)} />;
// words: { "sandbox-notes.type.note": "Note", "synergy.state.no_longer_linked": "No longer linked", … }
```

- **`translateRefs(link, t)`** (Synergy, `/react`) walks the link, collects every `MessageRef` (the provider's and Synergy's own state and relation words) and returns plain key-to-text pairs. When one key appears with different `values`, the dictionary key includes the values.
- **Plain data only.** A server component can't pass a function to a client component, so the earlier transport prop (`resolveLinks(requests) => Promise<ResolvedLink[]>`) is gone (Pratik, 2026-11-06). The host makes the request: Sidekick's server component calls the resolve handler directly for first paint; when the editor inserts a link, a client wrapper in the App, whose fetch code lives in a client module, calls `POST /links/resolve` with the session cookie and translates with next-intl's client `useTranslations`; a third party calls the API with its own credentials and translates with Synergy's exported catalog and the providers'.
- **Overrides the PRD and spec** ([[D186]]): the component stays host-agnostic with no app-wide context; only the transport moves out of it, into the host.
- **No i18n library inside the component**, the same rule as `ui` ([[D249]]). It works in any host, and it is "data in, HTML out", the easiest thing to test.

## Content helpers

**D211** `decision` #synergy #save: Every provider builds the save call's sets with the shared `extractRefs`, and the quote re-matcher asks the user when a match is weak instead of guessing. derived-from [[D203]] derived-from [[D1]]

- **`extractRefs(content)`** walks Tiptap JSON and returns the block and anchor ids and the mentioned relationship ids. Every provider uses it to build the sets for the save call.
- **The quote re-matcher** finds a quote in new content: Markdown import and Refresh of captured external content use it to re-attach anchors. When the best match is weak, the user is asked instead of the match being guessed.
- **Post-MVP candidate:** a block-level patch endpoint for bots and agents, which handle whole Tiptap documents with marks they don't understand poorly.

## Testing

Integration tests through the guarded API are the main seam; the component is tested in Vitest browser mode with MSW ([[03-system-design/non-functional/testing/testing-layers|Testing layers]]). Synergy adds:

- **Race tests with two database connections:** an anchor added while the target is open (stale save gets 409), a delete and a new reference into the same target (one fails), and a restore after the graph changed (`restore_conflict`).
- A test pinning spec story 71 ("dep wor" finds "deep work"), tuning trigram `word_similarity` until it passes.

## Design Decisions

Each decision lives in its own page here; the [[06-decisions/log|decisions log]] lists them with dates.

- [[03-system-design/functional-design/04-synergy/anchors-in-content|Anchors in content]]
- [[03-system-design/functional-design/04-synergy/capture-external-content|Capture external content]]
- [[03-system-design/functional-design/04-synergy/content-sequence|Content sequence]]
- [[03-system-design/functional-design/04-synergy/lexicon-highlighting|Lexicon highlighting]]
- [[03-system-design/functional-design/04-synergy/mentions-and-link-lifetime|Mentions and link lifetime]]
- [[03-system-design/functional-design/04-synergy/synergy-store-choices|Synergy store choices]]
- [[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]]
- [[03-system-design/functional-design/04-synergy/violations-and-exceptions|Violations and exceptions]]

## Decision History

- 2026-11-14 · accepted · Every repository write inside `withUserLock`, enforced by lint ([[D265]]); actor kind `human`; the lock keyed on the session's user (Synergy lesson 3)
- 2026-11-06 · accepted · Words from catalogs ([[D201]] revised), message references ([[D250]]), the Sneak Peek Link takes plain data ([[D251]]); `apps/web` is now `apps/app`
