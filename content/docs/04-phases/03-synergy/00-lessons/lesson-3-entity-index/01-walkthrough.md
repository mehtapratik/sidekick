---
publish: true
id: build.phase-3.lesson-3
title: "Synergy Lesson 3 Walkthrough: Entity Index and Version Log"
created: 2026-11-14
updated: 2026-11-14
kind: guidance
version: 1.1.0
tags:
   - build
   - walkthrough
   - phase-3
   - synergy
   - database
   - rls
   - postgresql
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-3-entity-index/00-brief]]"
---

# Synergy Lesson 3 Walkthrough — Entity Index and Version Log

This guide reproduces [[04-phases/03-synergy/00-lessons/lesson-3-entity-index/00-brief|lesson 3]] of [[04-phases/03-synergy/00-plan|Phase 3]] step by step. Synergy gets its first tables, `entity_index` and `version_log`, locked down with row-level security that compares only `user_id`, the soft-delete triggers and a strict restore. Every Synergy write takes a per-user advisory lock, enforced by a lint rule, and the first repository functions register, save and read an entity. It implements the [[03-system-design/functional-design/04-synergy/00-overview|Synergy overview]] (Tables, Tombstones, Write path), [[03-system-design/functional-design/04-synergy/content-sequence|Content sequence]] and [[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]], and writes the guide to [[03-system-design/non-functional/database/delete-models|delete models]].

It shipped as [sidekick#58](https://github.com/mehtapratik/sidekick/pull/58), one squash-merged PR, after an unplanned step that shipped as [sidekick#55](https://github.com/mehtapratik/sidekick/pull/55). What was learned along the way is in [[04-phases/03-synergy/00-lessons/lesson-3-entity-index/02-notes|the notes]].

Run everything from the Sidekick repo root unless a step says otherwise.

## Where the build differs from the brief

- **A step before the lesson: `package.json` files are sorted by Prettier** (step 0, [sidekick#55](https://github.com/mehtapratik/sidekick/pull/55)). Pratik's editor kept reordering core's `package.json` on save; a Prettier plugin now owns the order.
- **The actor kind is `human`, not `person`.** It reads as the opposite of `agent`, and `user` already means the owner (`user_id`).
- **Strict restore.** The lesson 2 handover left open whether a restore may also edit. It may not: the trigger refuses a restore that changes anything but `deleted_at` and the provenance columns ([[D263]], step 6b).
- **The lock is a wrapper with a lint rule.** The brief asked for a helper every write calls first. Pratik made it structural: `withUserLock(write)` returns the locked function, the bare lock function isn't exported, and the new rule `sidekick/require-user-lock` fails any insert, update or delete in Synergy's repository that isn't inside the wrapper ([[D265]], step 5).
- **The lock key comes from the session, not a parameter.** `hashtextextended(current_setting('app.current_user_id'), 0)`, the user `withRLS` set, so no caller can lock one user and write as another, and a write outside `withRLS` fails loudly.
- **Keys are text with a CHECK, not Postgres enums** ([[D266]], step 1).
- **Two unapplied migrations were regenerated.** A typo in the policy SQL (step 3a) and a core migration generated into the wrong package (step 7) were removed and regenerated before anything was applied. Step 3's gotcha explains how.

---

## Step 0 — Sort `package.json` with Prettier (before the lesson)

> **What and why:** an editor's sort-on-save reordered core's `package.json` keys on every save, so diffs carried noise. `prettier-plugin-packagejson` gives every `package.json` one canonical order, applied by the same Prettier that pre-commit and CI already run.

```bash
pnpm add -D -w prettier-plugin-packagejson@^3.1.0
```

In `.prettierrc.json`, add it to `plugins`, last:

```json
"plugins": [
   "prettier-plugin-astro",
   "@ianvs/prettier-plugin-sort-imports",
   "prettier-plugin-packagejson"
],
```

```bash
pnpm format
```

Every `package.json` is rewritten once, in the plugin's order. Shipped as [sidekick#55](https://github.com/mehtapratik/sidekick/pull/55).

## Step 1 — Design the tables

```bash
pnpm add drizzle-orm@^0.45.4 --filter @sidekick/synergy
```

### 1a — Columns every Synergy table shares

> **What and why:** the overview gives every Synergy table the same timestamps, provenance and soft-delete columns. Written once and spread into each `pgTable`, they can't drift between the ten tables to come.

`packages/platform/synergy/src/db/schema/columns.ts`:

```ts
import { sql, type SQL } from 'drizzle-orm';
import {
   check,
   text,
   timestamp,
   uuid,
   type AnyPgColumn,
   type CheckBuilder,
} from 'drizzle-orm/pg-core';

// Columns every Synergy table carries (Synergy overview, "Every table").
// Spread them into each pgTable: Drizzle builds a fresh column per table.

export function utcTimestamp(name: string): ReturnType<typeof timestamp> {
   return timestamp(name, { withTimezone: true });
}

// Renders our own constants as a SQL list: 'a', 'b'. sql.raw pastes text
// unescaped, so never pass it anything a user typed.
export function sqlList(values: readonly string[]): SQL {
   return sql.raw(values.map((value) => `'${value}'`).join(', '));
}

export const timestamps = {
   createdAt: utcTimestamp('created_at').notNull().defaultNow(),
   updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
};

// NULL while the row is live. A soft-deleted row (a tombstone) keeps its data.
export const tombstone = {
   deletedAt: utcTimestamp('deleted_at'),
};

// Who made the row's last write, and why. Keys only (D201).
export const ACTOR_KINDS = ['human', 'system', 'agent', 'api_key'] as const;

export const provenance = {
   actorKind: text('actor_kind', { enum: ACTOR_KINDS }).notNull(),
   actorId: uuid('actor_id'),
   reason: text('reason'),
};

// The database's half of the provenance contract. Call it in each table's
// third pgTable argument: ...provenanceChecks('entity_index', self)
export function provenanceChecks(
   table: string,
   self: { actorKind: AnyPgColumn; actorId: AnyPgColumn },
): [CheckBuilder, CheckBuilder] {
   return [
      check(
         `${table}_actor_kind_check`,
         sql`${self.actorKind} IN (${sqlList(ACTOR_KINDS)})`,
      ),
      check(
         `${table}_actor_id_check`,
         sql`(${self.actorKind} = 'system') = (${self.actorId} IS NULL)`,
      ),
   ];
}
```

- **Text and a CHECK, not a Postgres enum** ([[D266]]). An enum value can be added but never removed or renamed without rebuilding the type, and `ALTER TYPE … ADD VALUE` can't be used in the transaction that adds it, which is every drizzle-kit migration batch. The `{ enum }` option types the column in TypeScript; the CHECK guards the data from every other writer.
- **`sqlList` keeps one source of truth.** Interpolating a value in Drizzle's `sql` makes it a bound parameter, and a CHECK is stored schema that can't take one. `ACTOR_KINDS.join(',')` would also have been one string, `'human,system,agent,api_key'`, so every insert would have failed.
- **Provenance records the last write.** History lives in `version_log` and, from lesson 5, the outbox. `(actor_kind = 'system') = (actor_id IS NULL)` compares two booleans: only the system acts without an id.
- **`updated_at` has no trigger.** The repository sets it with the database's `now()` on every write.

### 1b — `entity_index`

`packages/platform/synergy/src/db/schema/entity-index.ts` (as merged, with step 3a's policy line):

```ts
import { sql } from 'drizzle-orm';
import {
   check,
   index,
   integer,
   pgTable,
   text,
   uuid,
} from 'drizzle-orm/pg-core';

import { profiles } from '@sidekick/core/db/schema';

import {
   provenance,
   provenanceChecks,
   sqlList,
   timestamps,
   tombstone,
   utcTimestamp,
} from './columns';
import { ownRowsPolicy } from './policies';

// Delete model: soft delete, tombstones visible (D66). RLS compares only
// user_id; the repository filters deleted_at in each query that wants live rows.

export const ENTITY_STATUSES = ['active', 'deprecated', 'superseded'] as const;

export const entityIndex = pgTable(
   'entity_index',
   {
      // Client-generated, so the editor knows the id before the first save.
      id: uuid('id').primaryKey(),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      // Keys, never labels (D201): 'sandbox-notes', 'note'.
      provider: text('provider').notNull(),
      type: text('type').notNull(),
      // User content, stored as written.
      displayName: text('display_name').notNull(),
      title: text('title'),
      status: text('status', { enum: ENTITY_STATUSES })
         .notNull()
         .default('active'),
      version: integer('version').notNull().default(1),
      revision: integer('revision').notNull().default(0),
      // Moves on every content write, anchors included: the stale-write token.
      contentSeq: integer('content_seq').notNull().default(0),
      editedAt: utcTimestamp('edited_at').notNull().defaultNow(),
      ...timestamps,
      ...provenance,
      ...tombstone,
   },
   (self) => [
      index('entity_index_user_id_status_idx').on(self.userId, self.status),
      check(
         'entity_index_status_check',
         sql`${self.status} IN (${sqlList(ENTITY_STATUSES)})`,
      ),
      check(
         'entity_index_counters_check',
         sql`${self.version} > 0 AND ${self.revision} >= 0 AND ${self.contentSeq} >= 0`,
      ),
      ...provenanceChecks('entity_index', self),
      ownRowsPolicy('entity_index', self),
   ],
);
```

- **`provider` and `type` have no CHECK.** Statuses and actor kinds are a small fixed set Synergy's code acts on; providers and types are an open set other packages register. Lesson 4's registry validates them in the repository, so Synergy never names a provider.
- **"Deleted" is not a status.** It's `deleted_at`, so a restore brings back whatever status the entity had.
- **`edited_at` moves only with author content** (title, body, blurb, with the version or revision); `updated_at` moves on every write, status changes and anchors included.
- **Counters start at version 1, revision 0, `content_seq` 0**, and are integers: `bigint` comes back from the driver as a string.

### 1c — `version_log` and the schema index

`packages/platform/synergy/src/db/schema/version-log.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
   check,
   integer,
   pgTable,
   text,
   uniqueIndex,
   uuid,
} from 'drizzle-orm/pg-core';

import { profiles } from '@sidekick/core/db/schema';

import { provenance, provenanceChecks, timestamps, tombstone } from './columns';
import { entityIndex } from './entity-index';
import { ownRowsPolicy } from './policies';

// Delete model: soft delete, tombstones visible (D66), like entity_index.
// One row per version bump, written by saveEntityContent in the same transaction.

export const versionLog = pgTable(
   'version_log',
   {
      // Written by Synergy on the server, never by an offline client.
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      entityId: uuid('entity_id')
         .notNull()
         .references(() => entityIndex.id, { onDelete: 'cascade' }),
      version: integer('version').notNull(),
      // Optional and stored as written: user content.
      changeNote: text('change_note'),
      ...timestamps,
      ...provenance,
      ...tombstone,
   },
   (self) => [
      // Partial: a tombstoned row never blocks logging the same version again.
      uniqueIndex('version_log_entity_id_version_key')
         .on(self.entityId, self.version)
         .where(sql`${self.deletedAt} IS NULL`),
      check('version_log_version_check', sql`${self.version} > 0`),
      ...provenanceChecks('version_log', self),
      ownRowsPolicy('version_log', self),
   ],
);
```

`src/db/schema/index.ts`:

```ts
// Synergy's Drizzle tables. drizzle-kit reads this file to generate
// migrations, so every table must be exported from here.
export * from './entity-index';
export * from './version-log';
```

- **The log records bumps, not creation.** Version 1 has no note and nothing reads a row for it; creation is in `created_at` and, from lesson 5, the outbox.
- **A surrogate `id`, not the composite key `(entity_id, version)`.** A primary key can't be partial, so a tombstoned version 3 would block logging version 3 again, and every Synergy table names its rows by one `id`. The natural key is still enforced, by the partial unique index.
- **`defaultRandom()`** because only Synergy writes these rows, inside the save; client-generated ids are for rows a client creates and refers to before the server sees them.
- **Its own `user_id`** so the policy reads the row's own column instead of joining `entity_index`.

## Step 2 — Generate and read the SQL

```bash
pnpm db:generate --filter=@sidekick/synergy -- --name=entity_index_and_version_log
```

`0001_entity_index_and_version_log.sql` creates both tables with their CHECKs inline, then adds the foreign keys as separate `ALTER TABLE` statements (drizzle-kit creates every table first), then the indexes. Columns inside CHECKs and the index predicate appear as `"entity_index"."status"`; Postgres accepts that and strips the table name when it stores them. The `profiles` foreign key works because core's migrations run before Synergy's (lesson 2). Nothing is migrated yet: until step 3, these tables have no RLS.

## Step 3 — Lock it down

### 3a — The own-rows policy

> **What and why:** a policy is a condition Postgres adds to every query on the table. `USING` decides which rows a query can see (a failing row is invisible); `WITH CHECK` decides which rows it may write (a failing row is an error). Synergy's compares only `user_id` (D66); the repository filters `deleted_at` itself. Written as a Drizzle `pgPolicy` helper, drizzle-kit tracks the policy in its snapshot, so a later change to the helper regenerates every table's policy.

`packages/platform/synergy/src/db/schema/policies.ts`:

```ts
import { sql } from 'drizzle-orm';
import { pgPolicy, type AnyPgColumn, type PgPolicy } from 'drizzle-orm/pg-core';

// Synergy's row-level security: a user reads and writes only their own rows.
// It compares only user_id, never deleted_at: tombstones stay visible to the
// repository, which filters deleted rows itself (D66).
export function ownRowsPolicy(
   tableName: string,
   self: { userId: AnyPgColumn },
): PgPolicy {
   // nullif: once a withRLS transaction ends, its pooled connection reads the
   // setting back as '' (not NULL), and ''::uuid would throw.
   const ownRow = sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid`;

   return pgPolicy(`${tableName}_own_rows`, {
      for: 'all',
      using: ownRow,
      withCheck: ownRow,
   });
}
```

Add `ownRowsPolicy('entity_index', self)` and `ownRowsPolicy('version_log', self)` to the tables (shown in step 1), then:

```bash
pnpm db:generate --filter=@sidekick/synergy -- --name=own_rows_policies
```

`0002_own_rows_policies.sql` enables RLS and creates one policy per table. Comparing `uuid` to `uuid`, not core's `id::text = …`, lets the `(user_id, status)` index serve the filter.

> **Gotcha — a migration is three files.** The first version of this step lost the quotes around `'app.current_user_id'`; Postgres would have read it as a column of a table named `app` and refused the migration (and, in the same transaction, `0001`). Deleting only the `.sql` left its `meta/0002_snapshot.json` and its journal entry: drizzle-kit generates from the newest snapshot, so the regenerate wrote an `ALTER POLICY` fix on top of a policy that no longer existed, and `db:migrate` would have looked for the missing file. To remove an unapplied migration, delete the `.sql`, its snapshot and its `_journal.json` entry together. Never remove an applied one.

### 3b — FORCE and the triggers

```bash
pnpm db:generate --filter=@sidekick/synergy -- --custom --name=force_rls_and_soft_delete_triggers
```

`0003_force_rls_and_soft_delete_triggers.sql`:

```sql
-- Synergy's tables keep their tombstones visible (D66): 0002's policies compare
-- only user_id, and these triggers hold the soft-delete rules for every writer.

-- FORCE: the policies bind the table owner too. If app_runtime ever owned these
-- tables, RLS would still hold. Roles with BYPASSRLS (postgres, for migrations
-- and ops scripts) still bypass it.
ALTER TABLE entity_index FORCE ROW LEVEL SECURITY;
ALTER TABLE version_log FORCE ROW LEVEL SECURITY;

-- Soft delete only: a DELETE is refused unless its transaction opts in with
-- SET LOCAL app.allow_hard_delete = 'true' (erasure). Core's shared function.
CREATE TRIGGER no_hard_delete_entity_index
   BEFORE DELETE ON entity_index
   FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

CREATE TRIGGER no_hard_delete_version_log
   BEFORE DELETE ON version_log
   FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

-- A tombstone can be restored, but not otherwise updated. Synergy's own
-- function (0000), not core's block_update_on_deleted, which refuses restores.
CREATE TRIGGER no_update_deleted_entity_index
   BEFORE UPDATE ON entity_index
   FOR EACH ROW EXECUTE FUNCTION synergy_block_update_on_deleted();

CREATE TRIGGER no_update_deleted_version_log
   BEFORE UPDATE ON version_log
   FOR EACH ROW EXECUTE FUNCTION synergy_block_update_on_deleted();
```

`user_id` cascades from `profiles`, and a cascading delete fires `BEFORE DELETE` triggers too: once a user has entities, deleting the account is refused unless the transaction sets `app.allow_hard_delete`. That is the overview's "erasure overrides", built in lesson 11.

```bash
pnpm test:integration
```

The throwaway database builds from every migration, and core's Data API test confirms the new tables gave `anon` and `authenticated` nothing.

### 3c — `human`

Rename `person` to `human` in `ACTOR_KINDS`, then:

```bash
pnpm db:generate --filter=@sidekick/synergy -- --name=actor_kind_human
```

`0004_actor_kind_human.sql` drops and re-adds both actor-kind CHECKs.

## Step 4 — The per-user lock

> **What and why:** an advisory lock is a number only our code gives meaning to; transactions asking for the same number take turns, and nothing else waits. Without it, two of one user's tabs can each pass a check the other is about to invalidate: tab A deletes note N after finding no live references, tab B links plan P to N after finding N live, and both commit (D202). With every Synergy write taking the user's lock first, B waits, re-reads and is refused. One lock per user is enough because RLS confines everything that can conflict to one user's data.

`packages/platform/synergy/src/repository/lock.ts`:

```ts
import { sql } from 'drizzle-orm';

import type { RlsTx } from '@sidekick/core/db';

// Every Synergy write calls this first, before it reads anything (D202).
// It takes the current user's lock, held until the transaction ends, so one
// user's Synergy writes run one at a time. Reads never wait for it.
async function lockCurrentUser(tx: RlsTx): Promise<void> {
   // The key is the user withRLS set, so the lock can't name another user.
   // Without withRLS, current_setting raises an error instead of locking nothing.
   await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(current_setting('app.current_user_id'), 0))`,
   );
}

export type SynergyMutation<Args extends unknown[], Result> = (
   tx: RlsTx,
   ...args: Args
) => Promise<Result>;

// Wraps a Synergy mutation so it takes the user's lock before anything else.
export function withUserLock<Args extends unknown[], Result>(
   mutation: SynergyMutation<Args, Result>,
): SynergyMutation<Args, Result> {
   return async function openUserLock(tx, ...args) {
      await lockCurrentUser(tx);
      return mutation(tx, ...args);
   };
}
```

`_xact_` releases the lock at commit or rollback; a session-level lock would outlive the request on Supabase's transaction pooler. `withUserLock` arrived in step 5d, after the first two repository functions called the lock directly.

## Step 5 — The repository

### 5a to 5d — `registerEntity`, `saveEntityContent`, `getEntity`, `withUserLock`

`packages/platform/synergy/src/repository/errors.ts`:

```ts
// Synergy's error codes. Keys only (D201): the client looks up the words.
// Lesson 4's routes turn each code into an HTTP status.
export type SynergyErrorCode = 'not_found' | 'stale_content';

export class SynergyError extends Error {
   constructor(readonly code: SynergyErrorCode) {
      super(code);
      this.name = 'SynergyError';
   }
}
```

`packages/platform/synergy/src/db/utils.ts`:

```ts
import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export function increment(
   column: AnyPgColumn<{ dataType: 'number' }>,
): SQL<unknown> {
   return sql`${column} + 1`;
}
```

`packages/platform/synergy/src/repository/entities.ts` (as merged):

```ts
import { and, eq, isNull, sql, type InferSelectModel } from 'drizzle-orm';

import type { RlsTx } from '@sidekick/core/db';

import { entityIndex, versionLog } from '../db/schema';
import type { ACTOR_KINDS } from '../db/schema/columns';
import { increment } from '../db/utils';
import { SynergyError } from './errors';
import { withUserLock } from './lock';

type ActorKind = (typeof ACTOR_KINDS)[number];

// Who is writing. Mirrors the provenance CHECK: only the system has no id.
export interface SystemAsActor {
   kind: 'system';
   id?: never;
}
export interface NonSystemAsActor {
   kind: Exclude<ActorKind, 'system'>;
   id: string;
}

export type Actor = SystemAsActor | NonSystemAsActor;

// A row of entity_index, exactly as Drizzle returns it.
export interface EntityIndexRow extends InferSelectModel<typeof entityIndex> {}

// The user withRLS set. RLS's WITH CHECK refuses any other user_id anyway.
export const currentUserId = sql`current_setting('app.current_user_id')::uuid`;

export interface RegisterEntityPayload {
   id: string;
   provider: string;
   type: string;
   displayName: string;
   title?: string;
   actor: Actor;
}
// Creates an entity's index row. The provider calls it in the same transaction
// that inserts its own row.
export const registerEntity = withUserLock(
   async function registerEntityMutation(
      tx,
      payload: RegisterEntityPayload,
   ): Promise<EntityIndexRow> {
      const [entity] = await tx
         .insert(entityIndex)
         .values({
            id: payload.id,
            provider: payload.provider,
            type: payload.type,
            displayName: payload.displayName,
            title: payload.title,
            actorKind: payload.actor.kind,
            actorId: payload.actor.id,
            userId: currentUserId,
         })
         .returning();

      return entity;
   },
);

export interface SaveEntityContentPayload {
   id: string;
   // The content_seq the editor started from.
   baselineContentSeq: number;
   // The author flags a version; every other save is a revision.
   bump: 'revision' | 'version';
   changeNote?: string;
   displayName: string;
   title?: string;
   actor: Actor;
}

export const saveEntityContent = withUserLock(
   async function saveEntityContentMutation(
      tx,
      payload: SaveEntityContentPayload,
   ): Promise<EntityIndexRow> {
      const {
         id,
         baselineContentSeq,
         bump,
         changeNote,
         displayName,
         title,
         actor: { kind: actorKind, id: actorId },
      } = payload;
      const revision =
         bump === 'revision'
            ? increment(entityIndex.revision)
            : entityIndex.revision;
      const version =
         bump === 'version'
            ? increment(entityIndex.version)
            : entityIndex.version;
      const contentSeq = increment(entityIndex.contentSeq);

      const [updatedEntityRow] = await tx
         .update(entityIndex)
         .set({
            version,
            revision,
            contentSeq,
            displayName,
            title: title ?? null,
            editedAt: sql`now()`,
            updatedAt: sql`now()`,
            actorKind,
            actorId: actorId ?? null,
            reason: null,
         })
         .where(
            and(
               eq(entityIndex.id, id),
               eq(entityIndex.contentSeq, baselineContentSeq),
               isNull(entityIndex.deletedAt),
            ),
         )
         .returning();

      if (!updatedEntityRow) {
         // No match: either
         // 1. the baseline from which edit was initiated has shifted (updated by another tab or device),
         // 2. entity has been deleted, or
         // 3. it never existed in first place.
         // We hold the lock, so this answer can't change before we return it.
         const [live] = await tx
            .select({ id: entityIndex.id })
            .from(entityIndex)
            .where(and(eq(entityIndex.id, id), isNull(entityIndex.deletedAt)));

         throw new SynergyError(live ? 'stale_content' : 'not_found');
      }

      if (bump === 'version') {
         await tx.insert(versionLog).values({
            userId: currentUserId,
            entityId: id,
            version: updatedEntityRow.version,
            changeNote,
            actorKind,
            actorId: actorId ?? null,
         });
      }

      return updatedEntityRow;
   },
);

export interface GetEntityOptions {
   includeDeleted: boolean;
}

export async function getEntity(
   tx: RlsTx,
   id: string,
   options: GetEntityOptions,
): Promise<EntityIndexRow | undefined> {
   const [entity] = await tx
      .select()
      .from(entityIndex)
      .where(
         options.includeDeleted
            ? eq(entityIndex.id, id)
            : and(eq(entityIndex.id, id), isNull(entityIndex.deletedAt)),
      );
   return entity;
}
```

- **The stale check is one statement.** `UPDATE … SET content_seq = content_seq + 1 … WHERE content_seq = $base` checks and moves the token together, so there is no window between them. Zero rows updated means refused; one follow-up read under the lock tells `stale_content` from `not_found`.
- **`undefined` versus `null` in Drizzle.** In `.set()` and `.values()`, `undefined` means "leave this column out" and `null` means "write NULL". In an insert, leaving out gives the default; in an update, it keeps the old value. So `saveEntityContent` writes `actorId ?? null`: without it, a system save after a human one would keep the human's id beside `actor_kind = 'system'`, and the provenance CHECK would refuse it.
- **`includeDeleted` is required**, so every read states whether a tombstone counts (D66). Reads take no lock.
- **Names:** the entity noun with a specific verb (`registerEntity`, `saveEntityContent`, later `setEntityStatus`, `deleteEntity`, `restoreEntity`), and layer suffixes for types (`EntityIndexRow` for a database row; the plain noun is kept for lesson 4's contract types).

### 5e — Interfaces for inferred types

`EntityIndexRow`, `RlsTx` (core) and `GetEntityOptions` are interfaces, so editors show their names instead of every field. `typescript-eslint` flags an empty interface that only extends something; the root `eslint.config.js` allows exactly that form:

```js
{
   // Lets an inferred type be named as an interface (EntityIndexRow extends
   // InferSelectModel<...>), so editors show its name instead of every field.
   files: ['**/*.ts', '**/*.tsx'],
   rules: {
      '@typescript-eslint/no-empty-object-type': [
         'error',
         { allowInterfaces: 'with-single-extends' },
      ],
   },
},
```

### 5f — `sidekick/require-user-lock`

`packages/eslint-plugin-sidekick/src/rules/require-user-lock.ts` reports any call to a method named `insert`, `update` or `delete` that isn't inside the function passed to an imported `withUserLock(...)`. It checks each write call, not each export, so a helper that writes is caught too. It can't see types (`map.delete` would be flagged) or raw SQL through `tx.execute`. Register it in `src/index.ts` and turn it on in the root config:

```js
{
   // Every Synergy write takes the per-user lock first (D202): each insert,
   // update or delete in the repository must sit inside withUserLock(...).
   files: ['packages/platform/synergy/src/repository/**/*.ts'],
   plugins: { sidekick: sidekickPlugin },
   rules: {
      'sidekick/require-user-lock': 'error',
   },
},
```

Its tests (`require-user-lock.test.ts`) pass with the plugin's others. Planting an unwrapped `tx.delete(entityIndex)` in the repository fails `pnpm lint` with the rule's message.

> **Gotcha — restart the editor's ESLint server after a plugin change.** The root config loads the plugin from its compiled `dist/`. Cursor's ESLint server had loaded the old copy; when the config named a rule that copy lacked, it stopped linting every file the rule covers and showed no errors at all. `pnpm lint` builds the plugin first and was never stale. Rebuild, then run **ESLint: Restart ESLint Server** ([[08-ai-coding-harness/commands-and-environment|Commands and environment]]).

## Step 6 — Prove it

### 6a — Let Synergy's tests run repository code

`packages/platform/synergy/vitest.config.ts` aliases `server-only` to `tests/stubs/server-only.ts` (an empty module, copied from core), and the config joins `tsconfig.json`'s `include`. Core's database client starts with `import 'server-only'`, which throws outside a Next.js server.

### 6b — Strict restore

```bash
pnpm db:generate --filter=@sidekick/synergy -- --custom --name=strict_restore
```

`0005_strict_restore.sql`:

```sql
-- Restores are strict (lesson 3): an update to a soft-deleted row is allowed only
-- when it restores the row and changes nothing but deleted_at and the bookkeeping
-- columns. A restore that also edits is two statements in one transaction:
-- restore, then a normal save (which runs the content_seq check).
-- Synergy's own function: only Synergy's tables bind it, so replacing it here
-- changes exactly those tables.
CREATE OR REPLACE FUNCTION synergy_block_update_on_deleted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.deleted_at IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot update a soft-deleted row in % (id: %). Restore it first.',
            TG_TABLE_NAME, OLD.id;
    END IF;

    -- The row as JSON, minus the columns a restore may change, must not differ
    IF to_jsonb(NEW) - ARRAY['deleted_at', 'updated_at', 'actor_kind', 'actor_id', 'reason']
        IS DISTINCT FROM
        to_jsonb(OLD) - ARRAY['deleted_at', 'updated_at', 'actor_kind', 'actor_id', 'reason'] THEN
        RAISE EXCEPTION
            'A restore in % (id: %) may change only deleted_at and the provenance columns.',
            TG_TABLE_NAME, OLD.id;
    END IF;

    RETURN NEW;
END;
$$;
```

Listing the columns a restore may change, rather than the ones it may not, protects every column added later. `restore-aware-trigger.test.ts` gains "refuses a restore that also changes other columns", on its own probe row: the first version reused row 2, which the existing restore test had already brought back, so it passed an ordinary update and failed. Each test owns the rows it changes.

### 6c — The repository tests

`packages/platform/synergy/tests/integration/entities.test.ts` runs as `app_runtime` through `withRLS`, the path a provider takes, and proves:

1. register, then save twice: revision 2, `content_seq` 2, version 1;
2. a second save from the same stale `content_seq` gets `stale_content`;
3. a version save logs a `version_log` row with its note and leaves `revision` alone;
4. another user can't read the entity, and their save gets `not_found`;
5. a hard delete is refused;
6. a tombstone is visible only with `includeDeleted: true`;
7. a deleted row can be restored, but not edited, nor edited while restoring;
8. saving content to a deleted entity gets `not_found`.

Each test registers its own entity. The delete and restore tests write rows directly, since the repository gets those functions in lesson 11. Drizzle wraps a database error as *Failed query: …* with the trigger's message on `error.cause`, so those assertions check the cause.

```bash
pnpm test:integration
```

Synergy 13, core 17.

### 6d — Break each guard

One at a time, rerunning `pnpm test:integration --filter=@sidekick/synergy` after each:

1. comment out `eq(entityIndex.contentSeq, baselineContentSeq)` in `saveEntityContent`: "refuses a save from a stale content_seq" fails;
2. in a scratch custom migration (`--name=break_guards`), `ALTER POLICY entity_index_own_rows ON entity_index USING (true) WITH CHECK (true);`: "hides another user's entity" fails;
3. `DROP TRIGGER no_hard_delete_entity_index ON entity_index;`: "refuses a hard delete" fails;
4. `DROP TRIGGER no_update_deleted_entity_index ON entity_index;`: "can restore a deleted row but not otherwise update it" fails.

Remove the scratch migration's three parts and the suite is back to 13/13.

## Step 7 — Delete models

- `profiles.ts` and `user-feature-entitlements.ts` in core each name their model in a comment (hard delete), as Synergy's schema files do.
- Core `0010_block_update_on_deleted_message.sql` replaces `block_update_on_deleted` with the same body and a corrected message: "This table does not allow restores." The old message said "Restore it first", which the function forbids. Nothing binds it today, and shared SQL functions are public API, so the behaviour is unchanged.

```bash
pnpm db:generate --filter=@sidekick/core -- --custom --name=block_update_on_deleted_message
```

(The first attempt ran with `--filter=@sidekick/synergy` and produced a Synergy `0006`; its three parts were removed before regenerating in core.)

- The vault gets the [[03-system-design/non-functional/database/delete-models|delete-model guide]] ([[D264]]): hard delete, soft delete with tombstones hidden (the default), and soft delete with tombstones visible, with every table's model. [[03-system-design/non-functional/security/row-level-security|Row-level security]] and [[03-system-design/non-functional/database/soft-delete-support|soft-delete support]] become one template per model.

**Exit check:** `pnpm prettier:check`, `pnpm turbo run lint typecheck build test --force`, `pnpm test:integration` (Synergy 13, core 17), CI green on [sidekick#58](https://github.com/mehtapratik/sidekick/pull/58), and `pnpm db:migrate` on dev (core `0010`, Synergy `0001` to `0005`).

---

## Post note — `version_log` is append-only (added 2026-11-14)

After the lesson, Pratik pointed out that a log is a chronology that is never edited, so giving `version_log` soft-delete columns and the restore-aware trigger (step 1c, step 3b) was wrong. A follow-up on `refactor/synergy/append-only-version-log` made it **append-only**, a fourth [[03-system-design/non-functional/database/delete-models|delete model]]:

1. **Schema** (Synergy `0006_append_only_version_log`): `version_log` keeps only `created_at` (no `updated_at`, no `deleted_at`), and `(entity_id, version)` is a plain unique index, since there are no tombstones. The actor columns now mean who made the bump.
2. **Updates refused** (Synergy `0007_refuse_version_log_updates`, custom): drop `no_update_deleted_version_log`, add `synergy_refuse_update()` and bind it as `no_update_version_log`, and `REVOKE UPDATE, DELETE ON version_log FROM app_runtime`. `enforce_soft_delete` stays, so only erasure deletes a row; a cascade from a deleted entity still works because referential actions run as the table's owner.
3. **Tests:** as `app_runtime`, an update and a delete get *permission denied*; as `postgres`, the update hits the trigger and the delete hits `enforce_soft_delete`. Synergy 15, core 17.
