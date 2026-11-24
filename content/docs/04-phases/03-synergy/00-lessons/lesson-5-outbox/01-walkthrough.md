---
publish: true
id: build.phase-3.lesson-5
title: "Synergy Lesson 5 Walkthrough: Outbox, Status and Versions"
created: 2026-11-24
updated: 2026-11-24
kind: guidance
version: 1.0.0
tags:
   - build
   - walkthrough
   - phase-3
   - synergy
   - database
   - postgresql
   - rls
   - api
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-5-outbox/00-brief]]"
---

# Synergy Lesson 5 Walkthrough — Outbox, Status and Versions

Lesson 5 gave Synergy an outbox: every write now records its change events in the same transaction, for readers that will come later (notifications, search, push). It added a read-only role for those readers, two routes (`PATCH /api/synergy/entities/:id/status` and `GET /api/synergy/entities/:id/versions`), and on the way it changed the ETag to a hash of the response (D271) and made the version log start at version 1. Pratik typed the code; the steps below are the order it landed in ([sidekick#69](https://github.com/mehtapratik/sidekick/pull/69)).

The notes behind it (questions, design calls, surprises) are in [[04-phases/03-synergy/00-lessons/lesson-5-outbox/02-notes|the lesson notes]].

## What an outbox is

A **delivery queue**, like an email app's outbox: a list of changes that programs must react to, kept until every reader has handled them. Not a notification table (people read that) and not an audit log (that lives in `version_log` and the provenance columns).

1. A request makes its change and writes an event ("entity `abc` content saved") in the same transaction.
2. Both commit, or neither does. D268 rolls a failed request back, events included.
3. Later, a reader (a server program, not a device) reads the events after its bookmark and does its job.
4. Pruning deletes an event behind every reader's bookmark and older than 90 days.

Without the outbox, "save, then call the search service" loses the event whenever the call fails or the server stops between the two. The tables stay the truth; the outbox is only a to-do list, so a device that was away catches up from the tables, never from events.

## Where the build differs from the brief

- **The reader role was designed by Pratik** in a new rhythm, from step 2 on: Pratik states the plan, the coach corrects it, Pratik writes it, the coach checks it.
- **Event kinds, not types.** A fixed set in code with a CHECK is a [[07-glossary/kind|kind]], so the column is `kind` and the list `OUTBOX_EVENT_KINDS`.
- **The ETag is a hash of the response (D271)**, the decision lesson 4 handed over. Lesson 7's open question about what the ETag covers is settled with it.
- **Version 1 is logged at creation**, with a backfill migration for existing entities. Not in the brief: Pratik asked how a history UI would show the creation.
- **Unplanned refactors:** `Actor` moved to `repository/actor.ts`, `toActorColumns` builds every write's actor columns, and the pieces handlers share moved to `api/entity.ts`.
- **A correction to the design docs:** storing `pg_current_xact_id()` alone isn't commit order. A reader must also stop at `pg_snapshot_xmin` (see step 1).

## Step 0 — The branch

`feat/synergy/outbox` from `main`, then `pnpm install` for the new lockfile from Renovate's #67.

## Step 1 — The outbox table

### 1a — The schema

`packages/platform/synergy/src/db/schema/outbox.ts`, with `ownRow(self)` taken out of `policies.ts` so the outbox's policy can use the same ownership check:

```ts
export const outbox = pgTable(
   'outbox',
   {
      // Orders the events inside one transaction; xact_id orders transactions.
      id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
      // The transaction that wrote the event. Can't be rebuilt later.
      xactId: xid8('xact_id').notNull().default(sql`pg_current_xact_id()`),
      userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
      kind: text('kind', { enum: OUTBOX_EVENT_KINDS }).notNull(),
      // No foreign key: an event must outlive its subject (an entity erased).
      subjectId: uuid('subject_id').notNull(),
      payload: jsonb('payload').notNull().default({}),
      createdAt: utcTimestamp('created_at').notNull().defaultNow(),
      ...provenance,
   },
   (self) => [
      index('outbox_xact_id_id_idx').on(self.xactId, self.id),
      check('outbox_kind_check', sql`${self.kind} IN (${sqlList(OUTBOX_EVENT_KINDS)})`),
      ...provenanceChecks('outbox', self),
      // Insert only: app_runtime writes its own user's events and reads none.
      pgPolicy('outbox_insert_own_rows', { for: 'insert', withCheck: ownRow(self) }),
   ],
);
```

- **Two ids for order.** The identity `id` orders the events inside one transaction (a version save writes two); `xact_id` says which transaction wrote them. `xid8` is a custom Drizzle type that reads as a string, because it can exceed JavaScript's safe integer range.
- **Commit order needs more than `xact_id`.** A transaction gets its id at its first write, not when it commits, so transaction 100 can commit after 101: the same gap a `bigserial` has. A reader reads in `(xact_id, id)` order and only below `pg_snapshot_xmin(pg_current_snapshot())`, the oldest transaction still running. The id still has to be stored now, because it can't be rebuilt later.
- **Hard delete:** no `updated_at`, no `deleted_at`, no soft-delete triggers ([[03-system-design/non-functional/database/delete-models|Delete models]]).

### 1b — Generate

```bash
pnpm db:generate --filter=@sidekick/synergy -- --name=outbox
```

`0008_outbox.sql`, its snapshot and its journal entry, which go together. The `policies.ts` change generated nothing, because the SQL it builds didn't change.

### 1c — Insert-only: FORCE and a REVOKE

```bash
pnpm db:generate --filter=@sidekick/synergy -- --custom --name=outbox_insert_only
```

```sql
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;
REVOKE SELECT, UPDATE, DELETE ON outbox FROM app_runtime;
```

The brief's open choice, "RLS, a `REVOKE`, or both": both. Postgres checks the privilege first (may this role run this command on this table?), then the policy (which rows?). With only the policy, a `SELECT` by `app_runtime` would return nothing and look like it works; with the `REVOKE` it fails with `permission denied`. Because of that, the helper in step 3 inserts without `RETURNING`, which needs `SELECT`.

### 1d — The catalog test

`outbox: 'hard delete'` in core's catalog test. It then crashed: `Cannot read properties of null (reading 'includes')`. `pg_policies.qual` is a policy's `USING` term, and an insert-only policy has none, so the query now skips policies with `qual IS NULL`.

Committed as `feat(synergy): add the insert-only outbox table`.

## Step 2 — The reader role

Pratik's plan: a role named after the mail theme, built from core's `0001_app_runtime_grants.sql`, with RLS bypassed at table level rather than role level. The coach's corrections: the name `outbox_reader` (`<what>_<access>`, the docs' word "reader"); `SELECT`, not `INSERT`; nothing to revoke, because a new role starts with no privileges and core's default privileges go to `app_runtime` only, so the `ALL TABLES` and `DEFAULT PRIVILEGES` lines must not be copied.

### 2a — The role

`0010_outbox_reader_role.sql` (custom): a `DO` block that creates `outbox_reader` if it doesn't exist (`NOLOGIN`, `NOBYPASSRLS`, the same attributes as `app_runtime`), then `GRANT USAGE ON SCHEMA public` and `GRANT SELECT ON outbox`. Pratik's first version checked `rolname = 'app_runtime'`, so the role was never created, and used `GRANT … ON outbox IN SCHEMA public`, which is a syntax error.

### 2b — The policy

A missing policy doesn't bypass RLS; it denies. So the reader needs a `SELECT` policy, in Drizzle like every other:

```ts
export const outboxReader = pgRole('outbox_reader').existing();

// in the table's third argument
pgPolicy('outbox_reader_reads_every_row', { for: 'select', to: outboxReader, using: sql`true` }),
```

`.existing()` tells drizzle-kit not to create the role. The generated `0011` must come after `0010`, or `db:migrate` fails with `role "outbox_reader" does not exist`. `BYPASSRLS` was rejected: it skips RLS on every table the role is ever granted.

### 2c — A test login

The test database gives the role a password the way it does `app_runtime`: one more `-c "ALTER ROLE outbox_reader WITH LOGIN PASSWORD 'test-only'"` in `scripts/test-db/with-test-db.sh`, `export TEST_OUTBOX_READER_DATABASE_URL=…`, the variable added to `test:integration`'s `passThroughEnv` in `turbo.json` (Turbo passes only listed variables), and `createTestOutboxReaderDb()` in `@sidekick/test-utils`. The first edit lost the line-ending `\`, which would have run the second `-c` as a command and stopped every integration run.

### 2d — Prove it

`tests/integration/outbox-reader.test.ts`: the role reads two users' events, can't insert, update or delete one, and can't read `entity_index`. With `0011` emptied, the first test fails with `expected [] to deeply equal [ …(2) ]`: the silent empty read the policy prevents.

Committed as `feat(synergy): add the read-only outbox_reader role`.

## Step 3 — Write events

### 3a — `Actor` gets its own file

`Actor`, its two variants and `currentUserId` moved from `repository/entities.ts` to `repository/actor.ts`. The outbox helper needs them and `entities.ts` needs the helper; in one file they would import each other, which `import-x/no-cycle` refuses.

### 3b — `recordEvent`

`packages/platform/synergy/src/repository/outbox.ts`:

```ts
interface OutboxPayloads {
   'entity.created': { provider: string; type: string };
   'entity.content_saved': { contentSeq: number };
   'entity.version_bumped': { version: number };
   'entity.status_changed': { from: EntityStatus; to: EntityStatus };
}

interface OutboxEventOf<Kind extends OutboxEventKind> extends OutboxEventBase {
   kind: Kind;
   payload: OutboxPayloads[Kind];
}

/** One event: its kind decides the shape of its payload */
export type OutboxEvent = {
   [Kind in OutboxEventKind]: OutboxEventOf<Kind>;
}[OutboxEventKind];

export const recordEvent = withUserLock(async function recordEventWrite(tx, event: OutboxEvent): Promise<void> {
   await tx.insert(outbox).values({
      userId: currentUserId,
      kind: event.kind,
      subjectId: event.subjectId,
      payload: event.payload,
      ...toActorColumns(event.actor),
   });
});
```

Pratik restructured the coach's mapped type into a base interface and a generic one, with a hand-written union. The coach tested it: a kind added to the list and to `OutboxPayloads` but not to the union typechecked and could never be recorded. Deriving the union from the kinds closed that. `recordEvent` sits inside `withUserLock` because lint requires it for every repository write; the calling write already holds the lock, and taking it again in one transaction returns at once.

### 3c — The entity writes record their events

`registerEntity` records `entity.created` with the provider and type; `saveEntityContent` records `entity.content_saved`, then `entity.version_bumped` after the version log row on a version save. A stale save throws before it records anything.

Committed as `feat(synergy): record entity events in the outbox`.

## Step 4 — Status

### 4a — The ETag is a hash of the response (D271)

Three options were weighed: `"<content_seq>.<updated_at>"` (two writes in one millisecond can share it), a hash of the response, and a new metadata counter. Pratik chose the hash:

```ts
export function entityETag(entity: Entity): string {
   const hash = createHash('sha256').update(JSON.stringify(entity)).digest('base64url');
   return `"${hash}"`;
}
```

`readEntity` builds the body once with `toEntity`, hashes it, and sends that same object. `content_seq` keeps its job as the stale-write token; a hash would give false 409s whenever an entry was renamed or deprecated. The tests now read the ETag the server gives instead of expecting `"0"`, plus two unit tests (same entity, same ETag; status alone changes it). Committed as `fix(synergy): hash the entity response for its ETag`.

### 4b — `setEntityStatus`

`EXPLICIT_ENTITY_STATUSES` (`active`, `deprecated`) in the contract, spread into `ENTITY_STATUSES` so there is one list. `superseded` is a side effect of "this entry replaces that one" (lesson 8), never asked for directly. The repository function, under the lock: read the live entity (`not_found` if none); the same status again returns it unchanged with no event; otherwise update status, `updated_at` and the actor, and record `entity.status_changed` with `{ from, to }`. No counter moves, so an open editor's next save isn't refused.

Alongside it, `toActorColumns(actor)` in `repository/actor.ts` builds `{ actorKind, actorId: actor.id ?? null }` for every write (Pratik's idea; the coach converted the remaining sites). In Drizzle's `.set()`, `undefined` leaves a column as it was, so the `?? null` matters; `registerEntity` had been missing it. Committed as `feat(synergy): set an entity's status, with one actor-columns helper`.

### 4c — The route

`entityETag` and `EntityRouteContext` moved from `read-entity.ts` to `api/entity.ts` after Pratik asked why a new handler file was needed: shared pieces had been living in one handler's file. Then `api/change-entity-status.ts` (a non-uuid id answers 404, `parseRequestBody`, `setEntityStatus`, the entity and its new ETag back) and the route:

```ts
// apps/app/src/app/api/synergy/entities/[id]/status/route.ts
export const PATCH = withApiGuard(changeEntityStatus, { lockUser: true });
```

The first copy landed in `entities/status/` without `[id]`, and Next.js's generated types failed the build: the folder path is the URL, and with no `[id]` segment `params` is `{}`. Committed as `feat(synergy): deprecate and reactivate entities through PATCH status`.

## Step 5 — Versions

### 5a — The cursor

`api/version-cursor.ts`: `encodeVersionCursor(before)` makes base64url JSON; `decodeVersionCursor` returns the version or `undefined` for anything it didn't make. Unit tests cover the round trip and five bad cursors. A cursor beats `?page=2`: a version added between two requests can't make a page repeat or skip a row, and the database starts from the index instead of counting past skipped rows. It's opaque so clients only pass it back, and its contents can change without breaking them.

### 5b — The query

`repository/versions.ts`: `listVersions(tx, { entityId, before, limit })`, newest first, `version < before` after the first page. The unique `(entity_id, version)` index serves it. A read, so no lock.

### 5c — Version 1, the contract and the route

- **Version 1 at creation.** Pratik asked how a history UI would show the creation if the log has no row for it. Worse: `entity_index` keeps only the last writer, so the creator was lost after the first save. `registerEntity` now logs version 1 with the creator, and `0012_version_one_backfill.sql` (custom) adds version 1 for existing entities as `system`, with a reason, using `NOT EXISTS` so it never adds a second row. Pratik asked whether to run it by hand in Supabase instead; it stays a migration, recorded, reviewed and run once per database. A stray alias (`v.version` for `vl`) failed the test migrate with no message: drizzle-kit hides Postgres's error.
- **The contract:** `versionSchema`, `versionsPageSchema` (`nextCursor: null` on the last page) and `invalid_cursor` (400) in `SYNERGY_ERROR_CODE`.
- **The handler**, `api/list-versions.ts`: a bad cursor answers 400; a missing, deleted or other user's entity 404 (checked with `getEntity` first, because a deleted entity keeps its version rows); then 21 rows for a page of 20, where the 21st means there's a next page. The route is `GET` at `entities/[id]/versions/route.ts`, with no lock and no feature.

Committed as `feat(synergy): list an entity's versions, starting at version 1`, then `pnpm db:migrate` on dev ran `0008`–`0012`.

## Step 6 — Prove it

- `tests/integration/outbox.test.ts` reads the outbox as `postgres`, in reader order (`ORDER BY xact_id, id`): creation records one event with the actor; a version save records two in one transaction, after the creation's; a revision save one; a status change one, and the same status again none; a stale save none; a transaction that fails after Synergy wrote loses its event with the write; `app_runtime` gets `permission denied for table outbox`.
- `tests/integration/entity-status.test.ts`, through the guard with the route's options: deprecate and reactivate move no counter (Pratik added the check on the reactivation too); a client holding the old ETag gets 200 with the new status, and the PATCH's ETag is the one a GET gives; `superseded` answers 400; another user's entity, a deleted one and a non-uuid id answer 404, and the stranger's request changes nothing. With the old `"<content_seq>"` ETag, the second test fails.
- `tests/integration/list-versions.test.ts`: a new entity lists `[1]`; 25 saves page as 20 and 6 with no gap or repeat; a made-up cursor answers 400; deleted and other users' entities 404.

Committed as `test(synergy): prove the outbox, the status route and the version list`.

## Step 7 — The PR

The coach merged lesson 4's shared docs (#66) first, rebased the branch on it, added the live docs (overview, content sequence with D271, store choices, delete models, RLS, decisions log, glossary pages for user, actor and caller, the file-naming rule), ran the full uncached check and opened [sidekick#69](https://github.com/mehtapratik/sidekick/pull/69), which merged on green.

## Exit check

- `pnpm prettier:check`, `lint`, `typecheck`, `build` and `test` green uncached (35 tasks); `pnpm test:integration` green: core 35, Synergy 39, notes 6, tasks 6. The CI `checks` job green on #69.
- Dev migrated through `0012`.
