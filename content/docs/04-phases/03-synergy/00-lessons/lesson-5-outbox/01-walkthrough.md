---
publish: true
id: build.phase-3.lesson-5
title: "Synergy Lesson 5 Walkthrough: Outbox, Status and Versions"
created: 2026-11-24
updated: 2026-11-24
kind: guidance
version: 2.0.0
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

Lesson 5 gave Synergy an outbox: every write now records its change events in the same transaction, for readers that will come later (notifications, search, push). It added a read-only role for those readers, two routes (`PATCH /api/synergy/entities/:id/status` and `GET /api/synergy/entities/:id/versions`), and on the way it changed the ETag to a hash of the response (D271) and made the version log start at version 1. Pratik typed the code ([sidekick#69](https://github.com/mehtapratik/sidekick/pull/69)).

**How to use this page:** it repeats the lesson. Start from `main` as it was after lesson 4 ([sidekick#66](https://github.com/mehtapratik/sidekick/pull/66)), do the steps in order, and run each step's check before the next. Code blocks marked `diff` are edits to a file that exists: add the `+` lines, remove the `-` lines, and leave the rest. Every other block is a whole file. Commands run from the repo root unless a step says otherwise. Each step ends with the commit as it landed.

The notes behind it (questions, design calls, surprises) are in [[04-phases/03-synergy/00-lessons/lesson-5-outbox/02-notes|the lesson notes]].

## What an outbox is

A **delivery queue**, like an email app's outbox: a list of changes that programs must react to, kept until every reader has handled them. Not a notification table (people read that) and not an audit log (that lives in `version_log` and the provenance columns).

1. A request makes its change and writes an event ("entity `abc` content saved") in the same transaction.
2. Both commit, or neither does. D268 rolls a failed request back, events included.
3. Later, a reader (a server program, not a device) reads the events after its bookmark and does its job.
4. Pruning deletes an event behind every reader's bookmark and older than 90 days ([[backlogged-unplanned#B24 — Outbox bookmarks, pruning and a lag alert|B24]]).

Without the outbox, "save, then call the search service" loses the event whenever the call fails or the server stops between the two. The tables stay the truth; the outbox is only a to-do list, so a device that was away catches up from the tables, never from events.

## Where the build differs from the brief

- **The reader role was designed by Pratik** in a new rhythm, from step 2 on: Pratik states the plan, the coach corrects it, Pratik writes it, the coach checks it.
- **Event kinds, not types.** A fixed set in code with a CHECK is a [[07-glossary/kind|kind]], so the column is `kind` and the list `OUTBOX_EVENT_KINDS`.
- **The ETag is a hash of the response (D271)**, the decision lesson 4 handed over. Lesson 7's open question about what the ETag covers is settled with it.
- **Version 1 is logged at creation**, with a backfill migration for existing entities. Not in the brief: Pratik asked how a history UI would show the creation.
- **Unplanned refactors:** `Actor` moved to `repository/actor.ts`, `toActorColumns` builds every write's actor columns, and the pieces handlers share moved to `api/entity.ts`.
- **A correction to the design docs:** storing `pg_current_xact_id()` alone isn't commit order. A reader must also stop at `pg_snapshot_xmin` (step 1a).

## Step 0 — The branch

```bash
git switch main
git pull
git switch -c feat/synergy/outbox
pnpm install
```

`pnpm install` brings `node_modules` up to date with Renovate's lockfile (#67).

**Check:** `git status -sb` shows `## feat/synergy/outbox` and a clean tree.

## Step 1 — The outbox table

### 1a — The schema

The outbox's policy needs the same ownership check as `ownRowsPolicy`, so take it out into its own function. Replace `packages/platform/synergy/src/db/schema/policies.ts`:

```ts
import { sql, type SQL } from 'drizzle-orm';
import { pgPolicy, type AnyPgColumn, type PgPolicy } from 'drizzle-orm/pg-core';

/**
 * True when the row belongs to the user withRLS set. Compares only user_id,
 * never deleted_at: tombstones stay visible to the repository, which filters
 * deleted rows itself (D66).
 */
export function ownRow(self: { userId: AnyPgColumn }): SQL {
   // nullif: once a withRLS transaction ends, its pooled connection reads the
   // setting back as '' (not NULL), and ''::uuid would throw.
   return sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid`;
}

/** Synergy's row-level security: a user reads and writes only their own rows */
export function ownRowsPolicy(
   tableName: string,
   self: { userId: AnyPgColumn },
): PgPolicy {
   return pgPolicy(`${tableName}_own_rows`, {
      for: 'all',
      using: ownRow(self),
      withCheck: ownRow(self),
   });
}
```

Create `packages/platform/synergy/src/db/schema/outbox.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
   bigint,
   check,
   customType,
   index,
   jsonb,
   pgPolicy,
   pgTable,
   text,
   uuid,
} from 'drizzle-orm/pg-core';

import { utcTimestamp } from '@sidekick/core/db/columns';
import { profiles } from '@sidekick/core/db/schema';

import { provenance, provenanceChecks, sqlList } from './columns';
import { ownRow } from './policies';

/**
 * Every kind of event Synergy writes. Keys only (D201). Each lesson adds the
 * events for what it builds, from the overview's list.
 */
export const OUTBOX_EVENT_KINDS = [
   'entity.created',
   'entity.content_saved',
   'entity.version_bumped',
   'entity.status_changed',
] as const;

/**
 * Postgres's 64-bit transaction id. Drizzle has no built-in for it; it reads
 * as a string, because it can exceed JavaScript's safe integer range.
 */
const xid8 = customType<{ data: string; driverData: string }>({
   dataType: () => 'xid8',
});

/**
 * One row per change event, written in the same transaction as the change,
 * for readers that work across users (notifications, search, push).
 *
 * Delete model: hard delete. Non-syncable: no device reads it, and a pruning
 * job deletes events every reader has processed (Synergy store choices).
 */
export const outbox = pgTable(
   'outbox',
   {
      // Orders the events inside one transaction; xact_id orders transactions.
      id: bigint('id', { mode: 'number' })
         .primaryKey()
         .generatedAlwaysAsIdentity(),
      // The transaction that wrote the event. Can't be rebuilt later.
      xactId: xid8('xact_id')
         .notNull()
         .default(sql`pg_current_xact_id()`),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      kind: text('kind', { enum: OUTBOX_EVENT_KINDS }).notNull(),
      // The entity, link or tag the event is about. No foreign key: an event
      // must outlive its subject (an entity erased).
      subjectId: uuid('subject_id').notNull(),
      payload: jsonb('payload').notNull().default({}),
      createdAt: utcTimestamp('created_at').notNull().defaultNow(),
      ...provenance,
   },
   (self) => [
      index('outbox_xact_id_id_idx').on(self.xactId, self.id),
      check(
         'outbox_kind_check',
         sql`${self.kind} IN (${sqlList(OUTBOX_EVENT_KINDS)})`,
      ),
      ...provenanceChecks('outbox', self),
      // Insert only: app_runtime writes its own user's events and reads none.
      pgPolicy('outbox_insert_own_rows', {
         for: 'insert',
         withCheck: ownRow(self),
      }),
   ],
);
```

Export it from `packages/platform/synergy/src/db/schema/index.ts`:

```diff
@@ -4,3 +4,4 @@
  */
 export * from './entity-index';
 export * from './version-log';
+export * from './outbox';
```

**What and why:**

- **Two ids for order.** The identity `id` orders the events inside one transaction (a version save writes two); `xact_id` says which transaction wrote them. `xid8` is a custom Drizzle type that reads as a string, because it can exceed JavaScript's safe integer range.
- **Commit order needs more than `xact_id`.** A transaction gets its id at its first write, not when it commits, so transaction 100 can commit after 101: the same gap a `bigserial` has. A reader reads in `(xact_id, id)` order and only below `pg_snapshot_xmin(pg_current_snapshot())`, the oldest transaction still running. The id still has to be stored now, because it can't be rebuilt later.
- **Insert-only policy:** a `WITH CHECK` (which rows may be written: the user's own) and no `USING` (which rows may be read), so `app_runtime` can write events and see none.
- **Kinds with a CHECK:** a typo such as `'entity.craeted'` fails at the database. A new kind is one more entry in `OUTBOX_EVENT_KINDS`, and `db:generate` regenerates the CHECK.
- **Hard delete:** no `updated_at`, no `deleted_at`, no soft-delete triggers ([[03-system-design/non-functional/database/delete-models|Delete models]]).

**Check:**

```bash
pnpm turbo lint typecheck --filter=@sidekick/synergy --force
```

Both pass.

### 1b — Generate the table

```bash
pnpm db:generate --filter=@sidekick/synergy -- --name=outbox
```

It writes `packages/platform/synergy/src/db/migrations/0008_outbox.sql`, `meta/0008_snapshot.json` and an entry in `meta/_journal.json`. The three belong together: commit all three or delete all three.

**Check:** `0008_outbox.sql` is exactly this, and touches neither `entity_index` nor `version_log` (the `policies.ts` change generates nothing, because the SQL it builds didn't change):

```sql
CREATE TABLE "outbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"xact_id" "xid8" DEFAULT pg_current_xact_id() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	CONSTRAINT "outbox_kind_check" CHECK ("outbox"."kind" IN ('entity.created', 'entity.content_saved', 'entity.version_bumped', 'entity.status_changed')),
	CONSTRAINT "outbox_actor_kind_check" CHECK ("outbox"."actor_kind" IN ('human', 'system', 'agent', 'api_key')),
	CONSTRAINT "outbox_actor_id_check" CHECK (("outbox"."actor_kind" = 'system') = ("outbox"."actor_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_xact_id_id_idx" ON "outbox" USING btree ("xact_id","id");--> statement-breakpoint
CREATE POLICY "outbox_insert_own_rows" ON "outbox" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("outbox"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid);
```

### 1c — Insert-only: FORCE and a REVOKE

```bash
pnpm db:generate --filter=@sidekick/synergy -- --custom --name=outbox_insert_only
```

It writes an empty `0009_outbox_insert_only.sql`. Fill it:

```sql
-- The outbox is insert-only for the app (Synergy lesson 5). Two walls:
-- 0008's policy decides WHICH rows app_runtime may insert (its own user's);
-- this REVOKE decides WHICH operations it may run at all. Without the REVOKE,
-- a SELECT would quietly return nothing; with it, the SELECT fails loudly.

-- FORCE: the policy binds the table owner too (see 0003).
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;

-- Readers get their own role (lesson 5, step 2); pruning arrives with the
-- first reader. INSERT stays, from the default privileges in core's 0001.
REVOKE SELECT, UPDATE, DELETE ON outbox FROM app_runtime;
```

**Why both a policy and a `REVOKE`:** Postgres checks the privilege first (may this role run this command on this table?), then the policy (which rows?). With only the policy, a `SELECT` by `app_runtime` would return nothing and look like it works; with the `REVOKE` it fails with `permission denied`. Because of that, the helper in step 3 inserts without `RETURNING`, which needs `SELECT`.

### 1d — The catalog test

Edit `packages/foundation/core/tests/integration/catalog.test.ts`:

```diff
@@ -22,6 +22,7 @@ const TABLES: Readonly<Record<string, DeleteModel>> = {
    user_feature_entitlements: 'hard delete',
    entity_index: 'tombstones visible',
    version_log: 'append-only',
+   outbox: 'hard delete',
    sandbox_notes: 'tombstones hidden',
    sandbox_tasks: 'tombstones hidden',
 };
@@ -60,7 +61,9 @@ async function security(table: string) {
    const policies = await testAdminDb<{ using: string }[]>`
       SELECT qual AS using
       FROM pg_policies
-      WHERE schemaname = 'public' AND tablename = ${table}`;
+      WHERE schemaname = 'public' AND tablename = ${table}
+      -- An INSERT-only policy has no USING term (the outbox's)
+      AND qual IS NOT NULL`;
    const [privileges] = await testAdminDb<
       { canUpdate: boolean; canDelete: boolean }[]
    >`
```

**Check:** make the first change only (`outbox: 'hard delete'`) and run:

```bash
pnpm test:integration
```

Core fails with `TypeError: Cannot read properties of null (reading 'includes')`: `pg_policies.qual` is a policy's `USING` term, and an insert-only policy has none. Add the `qual IS NOT NULL` lines and run it again: core 35 passed, Synergy 21, notes 6, tasks 6.

### Commit

```bash
git add packages/platform/synergy/src/db packages/foundation/core/tests/integration/catalog.test.ts
git commit -m "feat(synergy): add the insert-only outbox table"
```

## Step 2 — The reader role

Readers work across users, so they need a role that reads every user's events and nothing else. It is named for what it does (`<what>_<access>`, like `app_runtime`), and it gets past RLS through a policy on the outbox only: `BYPASSRLS` would skip RLS on every table the role is ever granted.

### 2a — The role

```bash
pnpm db:generate --filter=@sidekick/synergy -- --custom --name=outbox_reader_role
```

Fill `0010_outbox_reader_role.sql`:

```sql
-- Create the outbox_reader role if it does not exist yet.
-- Outbox readers (notifications, search, push) work across users, so they connect as this role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'outbox_reader') THEN
    CREATE ROLE outbox_reader
      -- create role without login capability to avoid committing a password to source control.
      -- admin can enable login by setting a password manually before setting up connection strings in the app.
      -- ALTER ROLE outbox_reader WITH LOGIN PASSWORD '<strong-password>';
      NOLOGIN
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

-- Give outbox_reader access to the public schema
GRANT USAGE ON SCHEMA public TO outbox_reader;

-- Read-only access to outbox table
GRANT SELECT ON outbox TO outbox_reader;
```

Only the role-creating block comes from core's `0001_app_runtime_grants.sql`. A new role starts with no privileges, and `0001`'s default privileges go to `app_runtime` alone, so its `GRANT … ON ALL TABLES` and `ALTER DEFAULT PRIVILEGES` lines must not be copied: they would give the reader every table. Watch the `IF NOT EXISTS` check name the new role; checking `app_runtime` skips the `CREATE ROLE`, and the grants then fail.

### 2b — The policy

A missing policy doesn't bypass RLS; it denies. Add the role and a `SELECT` policy to `packages/platform/synergy/src/db/schema/outbox.ts`:

```diff
@@ -6,6 +6,7 @@ import {
    index,
    jsonb,
    pgPolicy,
+   pgRole,
    pgTable,
    text,
    uuid,
@@ -28,6 +29,12 @@ export const OUTBOX_EVENT_KINDS = [
    'entity.status_changed',
 ] as const;
 
+/**
+ * The read-only role outbox readers connect as. Created in migration 0010,
+ * so Drizzle only refers to it.
+ */
+export const outboxReader = pgRole('outbox_reader').existing();
+
 /**
  * Postgres's 64-bit transaction id. Drizzle has no built-in for it; it reads
  * as a string, because it can exceed JavaScript's safe integer range.
@@ -77,5 +84,11 @@ export const outbox = pgTable(
          for: 'insert',
          withCheck: ownRow(self),
       }),
+      // Readers work across users: outbox_reader sees every row.
+      pgPolicy('outbox_reader_reads_every_row', {
+         for: 'select',
+         to: outboxReader,
+         using: sql`true`,
+      }),
    ],
 );
```

```bash
pnpm db:generate --filter=@sidekick/synergy -- --name=outbox_reader_policy
```

**Check:** `0011_outbox_reader_policy.sql` is one line:

```sql
CREATE POLICY "outbox_reader_reads_every_row" ON "outbox" AS PERMISSIVE FOR SELECT TO "outbox_reader" USING (true);
```

`.existing()` tells drizzle-kit not to create the role. The policy must be `0011`, after the role's `0010`; in the other order `db:migrate` fails with `role "outbox_reader" does not exist`.

### 2c — A test login

The throwaway test database gives the role a password, the way it does `app_runtime`. Edit `scripts/test-db/with-test-db.sh` (keep the `\` at the end of the `app_runtime` line, or the next line runs as a command of its own and stops every integration run):

```diff
@@ -61,12 +61,15 @@ psql "$(url admin)" -v ON_ERROR_STOP=1 -q -f "$HERE/supabase-stub.sql"
   pnpm turbo run db:migrate --output-logs=errors-only)
   
 # The out-of-band step from the app_runtime decision note
+# and the same for the outbox's read-only role (Synergy lesson 5)
 psql "$(url admin)" -v ON_ERROR_STOP=1 -q \
-  -c "ALTER ROLE app_runtime WITH LOGIN PASSWORD 'test-only'"
+  -c "ALTER ROLE app_runtime WITH LOGIN PASSWORD 'test-only'" \
+  -c "ALTER ROLE outbox_reader WITH LOGIN PASSWORD 'test-only'"
 
 export DATABASE_URL="postgresql://app_runtime:test-only@127.0.0.1:$PORT/postgres"
 export TEST_AUTH_DATABASE_URL="$(url supabase_auth_admin)"
 # postgres: the privileged migration/seed role, the only one that writes entitlements
 export TEST_ADMIN_DATABASE_URL="$(url postgres)"
+export TEST_OUTBOX_READER_DATABASE_URL="postgresql://outbox_reader:test-only@127.0.0.1:$PORT/postgres"
 
 "$@"
```

Turbo passes a task only the environment variables it lists. Edit `turbo.json`:

```diff
@@ -42,7 +42,8 @@
          "passThroughEnv": [
             "DATABASE_URL",
             "TEST_AUTH_DATABASE_URL",
-            "TEST_ADMIN_DATABASE_URL"
+            "TEST_ADMIN_DATABASE_URL",
+            "TEST_OUTBOX_READER_DATABASE_URL"
          ]
       }
    }
```

Add a connection helper at the end of `packages/test-utils/src/db.ts`:

```diff
@@ -30,3 +30,10 @@ export function createTestAdminDb(): Sql {
 export function createTestRuntimeDb(): Sql {
    return postgres(requireTestEnv('DATABASE_URL'), { max: 1 });
 }
+
+/** outbox_reader: the read-only role outbox readers connect as, across users */
+export function createTestOutboxReaderDb(): Sql {
+   return postgres(requireTestEnv('TEST_OUTBOX_READER_DATABASE_URL'), {
+      max: 1,
+   });
+}
```

### 2d — Prove it

Create `packages/platform/synergy/tests/integration/outbox-reader.test.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
   createTestAdminDb,
   createTestAuthDb,
   createTestOutboxReaderDb,
} from '@sidekick/test-utils/db';

// Proves the outbox's read-only role: it reads every user's events and can
// change nothing. Nothing uses the role yet; the first reader will.

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();
const readerDb = createTestOutboxReaderDb();

const userA = randomUUID();
const userB = randomUUID();
const subjectA = randomUUID();
const subjectB = randomUUID();

beforeAll(async () => {
   await testAuthDb`INSERT INTO auth.users
      (id, email)
   VALUES
      (${userA}, 'a@example.com'),
      (${userB}, 'b@example.com')
   `;
   // postgres bypasses RLS, so it can seed both users' events at once
   await testAdminDb`INSERT INTO outbox
      (user_id, kind, subject_id, actor_kind, actor_id)
   VALUES
      (${userA}, 'entity.created', ${subjectA}, 'human', ${userA}),
      (${userB}, 'entity.created', ${subjectB}, 'human', ${userB})
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
   await readerDb.end();
});

describe('outbox_reader', () => {
   it("reads every user's events", async () => {
      const rows = await readerDb<{ subjectId: string }[]>`
         SELECT subject_id AS "subjectId" FROM outbox
         WHERE subject_id IN (${subjectA}, ${subjectB})`;

      expect(rows.map(({ subjectId }) => subjectId).sort()).toEqual(
         [subjectA, subjectB].sort(),
      );
   });

   it('cannot insert, update or delete events', async () => {
      await expect(readerDb`INSERT INTO outbox
         (user_id, kind, subject_id, actor_kind, actor_id)
      VALUES
         (${userA}, 'entity.created', ${randomUUID()}, 'human', ${userA})
      `).rejects.toThrow('permission denied for table outbox');
      await expect(
         readerDb`UPDATE outbox SET payload = '{}' WHERE subject_id = ${subjectA}`,
      ).rejects.toThrow('permission denied for table outbox');
      await expect(
         readerDb`DELETE FROM outbox WHERE subject_id = ${subjectA}`,
      ).rejects.toThrow('permission denied for table outbox');
   });

   it('cannot read any other table', async () => {
      await expect(
         readerDb`SELECT id FROM entity_index LIMIT 1`,
      ).rejects.toThrow('permission denied for table entity_index');
   });
});
```

**Check:** `pnpm test:integration`: Synergy 24 passed (core 35, notes 6, tasks 6). To watch the policy matter, empty `0011` and run it again: "reads every user's events" fails with `expected [] to deeply equal [ …(2) ]`. Put `0011` back.

### Commit

```bash
git add packages/platform/synergy scripts/test-db/with-test-db.sh turbo.json packages/test-utils/src/db.ts
git commit -m "feat(synergy): add the read-only outbox_reader role"
```

## Step 3 — Write events

### 3a — `Actor` gets its own file

The outbox helper needs `Actor` and `currentUserId`, and `entities.ts` needs the helper. In one file they would import each other, which `import-x/no-cycle` refuses. Create `packages/platform/synergy/src/repository/actor.ts`:

```ts
import { sql } from 'drizzle-orm';

import type { ACTOR_KINDS } from '../db/schema/columns';

type ActorKind = (typeof ACTOR_KINDS)[number];

/** The system writing on its own: it has no id */
export interface SystemAsActor {
   kind: 'system';
   id?: never;
}
/** A human, agent or API key writing: each has an id */
export interface NonSystemAsActor {
   kind: Exclude<ActorKind, 'system'>;
   /** The id of the user, agent or API key */
   id: string;
}

/** Who is writing. Mirrors the provenance CHECK: only the system has no id. */
export type Actor = SystemAsActor | NonSystemAsActor;

/** SQL for the user withRLS set. RLS's WITH CHECK refuses any other user_id anyway. */
export const currentUserId = sql`current_setting('app.current_user_id')::uuid`;
```

Then point the imports at it. `packages/platform/synergy/src/api/actor.ts`:

```diff
@@ -1,6 +1,6 @@
 import type { ApiCaller } from '@sidekick/core/api';
 
-import type { Actor } from '../repository/entities';
+import type { Actor } from '../repository/actor';
 
 /**
  * Who Synergy records as the writer of a request: the signed-in human, or the
```

`packages/platform/synergy/src/server.ts`:

```diff
@@ -9,7 +9,6 @@ export {
    getEntity,
    registerEntity,
    saveEntityContent,
-   type Actor,
    type EntityIndexRow,
    type GetEntityOptions,
    type RegisterEntityPayload,
@@ -20,3 +19,4 @@ export { SynergyError } from './repository/errors';
 export { identifyActor } from './api/actor';
 export { toEntity } from './api/entity';
 export { readEntity, type EntityRouteContext } from './api/read-entity';
+export { type Actor } from './repository/actor';
```

`packages/platform/synergy/tests/integration/entities.test.ts`:

```diff
@@ -7,11 +7,11 @@ import { withRLS } from '@sidekick/core/db';
 import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';
 
 import { entityIndex, versionLog } from '../../src/db/schema';
+import type { Actor } from '../../src/repository/actor';
 import {
    getEntity,
    registerEntity,
    saveEntityContent,
-   type Actor,
 } from '../../src/repository/entities';
 
 // Proves Synergy's repository, RLS and triggers on entity_index and version_log,
```

### 3b — `recordEvent`

Create `packages/platform/synergy/src/repository/outbox.ts`:

```ts
import { withUserLock } from '@sidekick/core/db';

import type { EntityStatus } from '../contracts/entity';
import { outbox, type OUTBOX_EVENT_KINDS } from '../db/schema';
import { currentUserId, type Actor } from './actor';

/** One of the kinds in OUTBOX_EVENT_KINDS */
type OutboxEventKind = (typeof OUTBOX_EVENT_KINDS)[number];

/**
 * What each kind of event carries in its payload: only the facts a reader
 * needs to act on it. A kind missing here fails the typecheck.
 */
interface OutboxPayloads {
   'entity.created': { provider: string; type: string };
   'entity.content_saved': { contentSeq: number };
   'entity.version_bumped': { version: number };
   'entity.status_changed': { from: EntityStatus; to: EntityStatus };
}

interface OutboxEventBase {
   /** The entity, link or tag the event is about */
   subjectId: string;
   /** Who made the change */
   actor: Actor;
}

/** An event of one kind, with that kind's payload */
interface OutboxEventOf<Kind extends OutboxEventKind> extends OutboxEventBase {
   kind: Kind;
   payload: OutboxPayloads[Kind];
}

/** One event: its kind decides the shape of its payload */
export type OutboxEvent = {
   [Kind in OutboxEventKind]: OutboxEventOf<Kind>;
}[OutboxEventKind];

/**
 * Writes one event to the outbox in the caller's transaction, so the event
 * commits or rolls back with the change it describes. No RETURNING:
 * app_runtime may insert into the outbox but not read it.
 */
export const recordEvent = withUserLock(async function recordEventWrite(
   tx,
   event: OutboxEvent,
): Promise<void> {
   await tx.insert(outbox).values({
      userId: currentUserId,
      kind: event.kind,
      subjectId: event.subjectId,
      payload: event.payload,
      actorKind: event.actor.kind,
      actorId: event.actor.id ?? null,
   });
});
```

**What and why:**

- **A typed payload per kind.** `OutboxPayloads` holds each kind's shape. The union is built *from* the kinds list, so a kind added to `OUTBOX_EVENT_KINDS` without a payload fails the typecheck (`Type 'Kind' cannot be used to index type 'OutboxPayloads'`). A hand-written union would let a new kind typecheck and never be recordable.
- **Inside `withUserLock`**, because lint (`require-user-lock`) refuses any repository insert outside it. The calling write already holds the lock, and taking it again in the same transaction returns at once.
- **One event per call**, so the order of calls is the order of `id`s. **No `RETURNING`**, because `app_runtime` has no `SELECT` on the outbox.

### 3c — The entity writes record their events

`packages/platform/synergy/src/repository/entities.ts` loses the code that moved to `actor.ts`, and its two writes call `recordEvent` after the change they describe:

```diff
@@ -4,33 +4,14 @@ import { withUserLock, type RlsTx } from '@sidekick/core/db';
 
 import { SYNERGY_ERROR_CODE } from '../contracts/errors';
 import { entityIndex, versionLog } from '../db/schema';
-import type { ACTOR_KINDS } from '../db/schema/columns';
 import { increment } from '../db/utils';
+import { currentUserId, type Actor } from './actor';
 import { SynergyError } from './errors';
-
-type ActorKind = (typeof ACTOR_KINDS)[number];
-
-/** The system writing on its own: it has no id */
-export interface SystemAsActor {
-   kind: 'system';
-   id?: never;
-}
-/** A human, agent or API key writing: each has an id */
-export interface NonSystemAsActor {
-   kind: Exclude<ActorKind, 'system'>;
-   /** The id of the user, agent or API key */
-   id: string;
-}
-
-/** Who is writing. Mirrors the provenance CHECK: only the system has no id. */
-export type Actor = SystemAsActor | NonSystemAsActor;
+import { recordEvent } from './outbox';
 
 /** A row of entity_index, exactly as Drizzle returns it */
 export interface EntityIndexRow extends InferSelectModel<typeof entityIndex> {}
 
-/** SQL for the user withRLS set. RLS's WITH CHECK refuses any other user_id anyway. */
-export const currentUserId = sql`current_setting('app.current_user_id')::uuid`;
-
 /** What registerEntity needs to create an entity's index row */
 export interface RegisterEntityPayload {
    /** The entity's id, generated by the client */
@@ -70,6 +51,13 @@ export const registerEntity = withUserLock(
          })
          .returning();
 
+      await recordEvent(tx, {
+         kind: 'entity.created',
+         subjectId: entity.id,
+         actor: payload.actor,
+         payload: { provider: entity.provider, type: entity.type },
+      });
+
       return entity;
    },
 );
@@ -162,6 +150,13 @@ export const saveEntityContent = withUserLock(
          );
       }
 
+      await recordEvent(tx, {
+         kind: 'entity.content_saved',
+         subjectId: id,
+         actor: payload.actor,
+         payload: { contentSeq: updatedEntityRow.contentSeq },
+      });
+
       if (bump === 'version') {
          await tx.insert(versionLog).values({
             userId: currentUserId,
@@ -171,6 +166,12 @@ export const saveEntityContent = withUserLock(
             actorKind,
             actorId: actorId ?? null,
          });
+         await recordEvent(tx, {
+            kind: 'entity.version_bumped',
+            subjectId: id,
+            actor: payload.actor,
+            payload: { version: updatedEntityRow.version },
+         });
       }
 
       return updatedEntityRow;
```

A stale save throws `stale_content` before it reaches `recordEvent`, so it records nothing.

**Check:**

```bash
pnpm turbo lint typecheck --filter=@sidekick/synergy --filter=@sidekick/sandbox-notes --filter=@sidekick/sandbox-tasks --force
pnpm test:integration
```

All pass; integration as in step 2.

### Commit

```bash
git add packages/platform/synergy
git commit -m "feat(synergy): record entity events in the outbox"
```

## Step 4 — Status

### 4a — The ETag is a hash of the response (D271)

Lesson 4's `ETag: "<content_seq>"` didn't move on a status change, so a client's `If-None-Match` would get 304 and keep a stale status. Three options were weighed: `"<content_seq>.<updated_at>"` (JavaScript dates keep milliseconds, so two writes in one millisecond can share it), a hash of the response, and a new metadata counter. Pratik chose the hash ([[D271]]). `content_seq` keeps its job as the stale-write token; a hash would refuse saves whenever an entry was renamed or deprecated.

Edit `packages/platform/synergy/src/api/read-entity.ts`:

```diff
@@ -1,8 +1,11 @@
+import { createHash } from 'node:crypto';
+
 import { z } from 'zod';
 
 import { errorResponse, type ApiHandler } from '@sidekick/core/api';
 import { HTTP_STATUS } from '@sidekick/core/http';
 
+import type { Entity } from '../contracts/entity';
 import { SYNERGY_ERROR_CODE } from '../contracts/errors';
 import { getEntity } from '../repository/entities';
 import { toEntity } from './entity';
@@ -31,9 +34,22 @@ export function matchesIfNoneMatch(
       .some((tag) => tag === '*' || tag === etag);
 }
 
+/**
+ * The ETag of an entity's response: a hash of the exact JSON the API sends, so
+ * it changes whenever any field does (status included) and never otherwise.
+ * HTTP requires an ETag to cover the whole response (RFC 9110).
+ */
+export function entityETag(entity: Entity): string {
+   const hash = createHash('sha256')
+      .update(JSON.stringify(entity))
+      .digest('base64url');
+
+   return `"${hash}"`;
+}
+
 /**
  * `GET /api/synergy/entities/:id`: an entity's index fields with
- * `ETag: "<content_seq>"`, or 304 with no body when the caller's
+ * its ETag (entityETag), or 304 with no body when the caller's
  * `If-None-Match` already names it (D210). Another user's id, a deleted
  * entity and an id that never existed all answer 404 (D209).
  */
@@ -55,7 +71,8 @@ export const readEntity: ApiHandler<EntityRouteContext> =
          );
       }
 
-      const etag = `"${row.contentSeq}"`;
+      const entity = toEntity(row);
+      const etag = entityETag(entity);
       // private: only the caller's browser may store it; no-cache: it must ask
       // (cheaply, with If-None-Match) before reusing it
       const headers = { 'ETag': etag, 'Cache-Control': 'private, no-cache' };
@@ -67,5 +84,5 @@ export const readEntity: ApiHandler<EntityRouteContext> =
          });
       }
 
-      return Response.json(toEntity(row), { headers });
+      return Response.json(entity, { headers });
    };
```

`packages/platform/synergy/src/contracts/entity.ts`:

```diff
@@ -20,7 +20,7 @@ export const entitySchema = z.object({
    status: z.enum(ENTITY_STATUSES),
    version: z.int(),
    revision: z.int(),
-   // The stale-write token and the ETag
+   // The stale-write token a save sends back as its baseline
    contentSeq: z.int(),
    editedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
```

Unit tests, `packages/platform/synergy/src/api/read-entity.test.ts`:

```diff
@@ -1,6 +1,7 @@
 import { describe, expect, it } from 'vitest';
 
-import { matchesIfNoneMatch } from './read-entity';
+import type { Entity } from '../contracts';
+import { entityETag, matchesIfNoneMatch } from './read-entity';
 
 describe('matchesIfNoneMatch', () => {
    it.each([
@@ -17,3 +18,29 @@ describe('matchesIfNoneMatch', () => {
       expect(matchesIfNoneMatch(null, '"4"')).toBe(false);
    });
 });
+
+describe('entityETag', () => {
+   const entity: Entity = {
+      id: '0b5c1c0e-6f0e-4c0e-8a3e-4b3c2d1e0f9a',
+      provider: 'sandbox-notes',
+      type: 'note',
+      displayName: 'A note',
+      status: 'active',
+      version: 1,
+      revision: 0,
+      contentSeq: 0,
+      editedAt: '2026-11-23T10:00:00.000Z',
+      createdAt: '2026-11-23T10:00:00.000Z',
+      updatedAt: '2026-11-23T10:00:00.000Z',
+   };
+
+   it('is the same for the same entity', () => {
+      expect(entityETag({ ...entity })).toBe(entityETag(entity));
+   });
+
+   it('changes when only the status changes', () => {
+      expect(entityETag({ ...entity, status: 'deprecated' })).not.toBe(
+         entityETag(entity),
+      );
+   });
+});
```

The integration tests stop expecting `"0"` and `"1"` and use the ETag the server gives. `packages/platform/synergy/tests/integration/read-entities.test.ts`:

```diff
@@ -6,7 +6,7 @@ import { withApiGuard } from '@sidekick/core/api';
 import { withRLS } from '@sidekick/core/db';
 import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';
 
-import { readEntity } from '../../src/api/read-entity';
+import { entityETag, readEntity } from '../../src/api/read-entity';
 import { entitySchema } from '../../src/contracts';
 import {
    registerEntity,
@@ -68,17 +68,18 @@ afterAll(async () => {
 });
 
 describe('GET /api/synergy/entities/:id', () => {
-   it('returns the entity with its content_seq as the ETag', async () => {
+   it('returns the entity with the hash of its JSON as the ETag', async () => {
       signInAs(owner);
       const id = await newEntity();
 
       const response = await read(id);
+      // The response keeps its own contract
+      const entity = entitySchema.parse(await response.json());
 
       expect(response.status).toBe(200);
-      expect(response.headers.get('ETag')).toBe('"0"');
+      expect(response.headers.get('ETag')).toBe(entityETag(entity));
       expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
-      // The response keeps its own contract
-      expect(entitySchema.parse(await response.json())).toMatchObject({
+      expect(entity).toMatchObject({
          id,
          provider: 'sandbox-notes',
          type: 'note',
@@ -89,17 +90,19 @@ describe('GET /api/synergy/entities/:id', () => {
    it('answers 304 with no body while the ETag still matches', async () => {
       signInAs(owner);
       const id = await newEntity();
+      const etag = (await read(id)).headers.get('ETag') ?? '';
 
-      const response = await read(id, '"0"');
+      const response = await read(id, etag);
 
       expect(response.status).toBe(304);
-      expect(response.headers.get('ETag')).toBe('"0"');
+      expect(response.headers.get('ETag')).toBe(etag);
       expect(await response.text()).toBe('');
    });
 
-   it('answers 200 with the new ETag once someone has saved', async () => {
+   it('answers 200 with a new ETag once someone has saved', async () => {
       signInAs(owner);
       const id = await newEntity();
+      const etag = (await read(id)).headers.get('ETag') ?? '';
       await withRLS(owner, (tx) =>
          saveEntityContent(tx, {
             id,
@@ -110,10 +113,10 @@ describe('GET /api/synergy/entities/:id', () => {
          }),
       );
 
-      const response = await read(id, '"0"');
+      const response = await read(id, etag);
 
       expect(response.status).toBe(200);
-      expect(response.headers.get('ETag')).toBe('"1"');
+      expect(response.headers.get('ETag')).not.toBe(etag);
       expect(await response.json()).toMatchObject({ displayName: 'Edited' });
    });
 
```

**Check:** `pnpm test` and `pnpm test:integration` pass (Synergy 24).

```bash
git add packages/platform/synergy
git commit -m "fix(synergy): hash the entity response for its ETag"
```

### 4b — `setEntityStatus`, with one actor-columns helper

`active` and `deprecated` are the statuses a request may set directly; `superseded` is a side effect of "this entry replaces that one" (lesson 8). `packages/platform/synergy/src/contracts/entity.ts`:

```diff
@@ -1,7 +1,19 @@
 import { z } from 'zod';
 
+/**
+ * The statuses a user can set by hand. Superseded is set only when another
+ * entry replaces this one (lesson 8).
+ */
+export const EXPLICIT_ENTITY_STATUSES = ['active', 'deprecated'] as const;
+
+/** A status a person can set by hand */
+export type ExplicitEntityStatus = (typeof EXPLICIT_ENTITY_STATUSES)[number];
+
 /** The lifecycle states an entity can be in */
-export const ENTITY_STATUSES = ['active', 'deprecated', 'superseded'] as const;
+export const ENTITY_STATUSES = [
+   ...EXPLICIT_ENTITY_STATUSES,
+   'superseded',
+] as const;
 
 /** The lifecycle states an entity can be in. One of `ENTITY_STATUSES` values.*/
 export type EntityStatus = (typeof ENTITY_STATUSES)[number];
```

Every write builds its actor columns the same way. In Drizzle's `.set()`, `undefined` leaves a column as it was, so a system actor needs `null`, never `undefined`. Add to `packages/platform/synergy/src/repository/actor.ts`:

```diff
@@ -21,3 +21,14 @@ export type Actor = SystemAsActor | NonSystemAsActor;
 
 /** SQL for the user withRLS set. RLS's WITH CHECK refuses any other user_id anyway. */
 export const currentUserId = sql`current_setting('app.current_user_id')::uuid`;
+
+/** An actor as a row's actor_kind and actor_id store it */
+export function toActorColumns(actor: Actor): {
+   actorKind: ActorKind;
+   actorId: string | null;
+} {
+   return {
+      actorKind: actor.kind,
+      actorId: actor.id ?? null,
+   };
+}
```

`packages/platform/synergy/src/repository/outbox.ts`:

```diff
@@ -2,7 +2,7 @@ import { withUserLock } from '@sidekick/core/db';
 
 import type { EntityStatus } from '../contracts/entity';
 import { outbox, type OUTBOX_EVENT_KINDS } from '../db/schema';
-import { currentUserId, type Actor } from './actor';
+import { currentUserId, toActorColumns, type Actor } from './actor';
 
 /** One of the kinds in OUTBOX_EVENT_KINDS */
 type OutboxEventKind = (typeof OUTBOX_EVENT_KINDS)[number];
@@ -50,7 +50,6 @@ export const recordEvent = withUserLock(async function recordEventWrite(
       kind: event.kind,
       subjectId: event.subjectId,
       payload: event.payload,
-      actorKind: event.actor.kind,
-      actorId: event.actor.id ?? null,
+      ...toActorColumns(event.actor),
    });
 });
```

`packages/platform/synergy/src/repository/entities.ts`: every actor column through `toActorColumns` (`registerEntity` was missing `?? null`), and the new `setEntityStatus`:

```diff
@@ -2,10 +2,11 @@ import { and, eq, isNull, sql, type InferSelectModel } from 'drizzle-orm';
 
 import { withUserLock, type RlsTx } from '@sidekick/core/db';
 
+import type { ExplicitEntityStatus } from '../contracts/entity';
 import { SYNERGY_ERROR_CODE } from '../contracts/errors';
 import { entityIndex, versionLog } from '../db/schema';
 import { increment } from '../db/utils';
-import { currentUserId, type Actor } from './actor';
+import { currentUserId, toActorColumns, type Actor } from './actor';
 import { SynergyError } from './errors';
 import { recordEvent } from './outbox';
 
@@ -45,8 +46,7 @@ export const registerEntity = withUserLock(
             type: payload.type,
             displayName: payload.displayName,
             title: payload.title,
-            actorKind: payload.actor.kind,
-            actorId: payload.actor.id,
+            ...toActorColumns(payload.actor),
             userId: currentUserId,
          })
          .returning();
@@ -97,7 +97,7 @@ export const saveEntityContent = withUserLock(
          changeNote,
          displayName,
          title,
-         actor: { kind: actorKind, id: actorId },
+         actor,
       } = payload;
       const revision =
          bump === 'revision'
@@ -119,8 +119,7 @@ export const saveEntityContent = withUserLock(
             title: title ?? null,
             editedAt: sql`now()`,
             updatedAt: sql`now()`,
-            actorKind,
-            actorId: actorId ?? null,
+            ...toActorColumns(actor),
             reason: null,
          })
          .where(
@@ -163,8 +162,7 @@ export const saveEntityContent = withUserLock(
             entityId: id,
             version: updatedEntityRow.version,
             changeNote,
-            actorKind,
-            actorId: actorId ?? null,
+            ...toActorColumns(actor),
          });
          await recordEvent(tx, {
             kind: 'entity.version_bumped',
@@ -178,6 +176,59 @@ export const saveEntityContent = withUserLock(
    },
 );
 
+/** What setEntityStatus needs to change an entity's status */
+export interface SetEntityStatusPayload {
+   /** The id of the entity */
+   id: string;
+   /** The status it moves to */
+   status: ExplicitEntityStatus;
+   /** Who is changing it */
+   actor: Actor;
+}
+
+/**
+ * Sets an entity's status to active or deprecated, and records the change.
+ * A metadata write: no counter moves. Setting the status it already has
+ * changes nothing and records nothing. Throws SynergyError `not_found` if the
+ * entity is deleted or never existed.
+ */
+export const setEntityStatus = withUserLock(
+   async function setEntityStatusMutation(
+      tx,
+      payload: SetEntityStatusPayload,
+   ): Promise<EntityIndexRow> {
+      const { id, status, actor } = payload;
+      const current = await getEntity(tx, id, { includeDeleted: false });
+      if (!current) {
+         throw new SynergyError(SYNERGY_ERROR_CODE.NOT_FOUND);
+      }
+
+      if (current.status === status) {
+         return current;
+      }
+
+      const [updated] = await tx
+         .update(entityIndex)
+         .set({
+            status,
+            updatedAt: sql`now()`,
+            ...toActorColumns(actor),
+            reason: null,
+         })
+         .where(eq(entityIndex.id, id))
+         .returning();
+
+      await recordEvent(tx, {
+         kind: 'entity.status_changed',
+         subjectId: id,
+         actor,
+         payload: { from: current.status, to: status },
+      });
+
+      return updated;
+   },
+);
+
 /** How getEntity looks up an entity */
 export interface GetEntityOptions {
    /** Also return the entity if it is a tombstone */
```

**What `setEntityStatus` does:** take the user lock; read the live entity (`not_found` if missing or deleted); the same status again returns it unchanged and records nothing, so a retried request is harmless; otherwise update the status, `updated_at` and the actor, and record `entity.status_changed` with `{ from, to }`. No counter moves, so an open editor's next save isn't refused.

**Check:** `pnpm turbo lint typecheck test --filter=@sidekick/synergy --filter=@sidekick/sandbox-notes --filter=@sidekick/sandbox-tasks --force` and `pnpm test:integration` pass.

```bash
git add packages/platform/synergy
git commit -m "feat(synergy): set an entity's status, with one actor-columns helper"
```

### 4c — The route

Pieces two handlers share belong in the concept's file, never in another handler's file, so `entityETag` and `EntityRouteContext` move from `read-entity.ts` to `api/entity.ts`. `packages/platform/synergy/src/api/entity.ts`:

```diff
@@ -1,6 +1,14 @@
+import { createHash } from 'node:crypto';
+
 import type { Entity } from '../contracts/entity';
 import type { EntityIndexRow } from '../repository/entities';
 
+/** Next.js's second route-handler argument for `/api/synergy/entities/[id]` */
+export interface EntityRouteContext {
+   /** The route's dynamic segments */
+   params: Promise<{ id: string }>;
+}
+
 /** Maps an entity_index row to the Entity the API returns */
 export function toEntity(row: EntityIndexRow): Entity {
    return {
@@ -18,3 +26,16 @@ export function toEntity(row: EntityIndexRow): Entity {
       updatedAt: row.updatedAt.toISOString(),
    };
 }
+
+/**
+ * The ETag of an entity's response: a hash of the exact JSON the API sends, so
+ * it changes whenever any field does (status included) and never otherwise.
+ * HTTP requires an ETag to cover the whole response (RFC 9110).
+ */
+export function entityETag(entity: Entity): string {
+   const hash = createHash('sha256')
+      .update(JSON.stringify(entity))
+      .digest('base64url');
+
+   return `"${hash}"`;
+}
```

`packages/platform/synergy/src/api/read-entity.ts`:

```diff
@@ -1,20 +1,11 @@
-import { createHash } from 'node:crypto';
-
 import { z } from 'zod';
 
 import { errorResponse, type ApiHandler } from '@sidekick/core/api';
 import { HTTP_STATUS } from '@sidekick/core/http';
 
-import type { Entity } from '../contracts/entity';
 import { SYNERGY_ERROR_CODE } from '../contracts/errors';
 import { getEntity } from '../repository/entities';
-import { toEntity } from './entity';
-
-/** Next.js's second route-handler argument for `/api/synergy/entities/[id]` */
-export interface EntityRouteContext {
-   /** The route's dynamic segments */
-   params: Promise<{ id: string }>;
-}
+import { entityETag, toEntity, type EntityRouteContext } from './entity';
 
 /**
  * Whether an `If-None-Match` header names this ETag. The header may list
@@ -34,19 +25,6 @@ export function matchesIfNoneMatch(
       .some((tag) => tag === '*' || tag === etag);
 }
 
-/**
- * The ETag of an entity's response: a hash of the exact JSON the API sends, so
- * it changes whenever any field does (status included) and never otherwise.
- * HTTP requires an ETag to cover the whole response (RFC 9110).
- */
-export function entityETag(entity: Entity): string {
-   const hash = createHash('sha256')
-      .update(JSON.stringify(entity))
-      .digest('base64url');
-
-   return `"${hash}"`;
-}
-
 /**
  * `GET /api/synergy/entities/:id`: an entity's index fields with
  * its ETag (entityETag), or 304 with no body when the caller's
```

The `entityETag` unit tests follow it. `packages/platform/synergy/src/api/read-entity.test.ts`:

```diff
@@ -1,7 +1,6 @@
 import { describe, expect, it } from 'vitest';
 
-import type { Entity } from '../contracts';
-import { entityETag, matchesIfNoneMatch } from './read-entity';
+import { matchesIfNoneMatch } from './read-entity';
 
 describe('matchesIfNoneMatch', () => {
    it.each([
@@ -18,29 +17,3 @@ describe('matchesIfNoneMatch', () => {
       expect(matchesIfNoneMatch(null, '"4"')).toBe(false);
    });
 });
-
-describe('entityETag', () => {
-   const entity: Entity = {
-      id: '0b5c1c0e-6f0e-4c0e-8a3e-4b3c2d1e0f9a',
-      provider: 'sandbox-notes',
-      type: 'note',
-      displayName: 'A note',
-      status: 'active',
-      version: 1,
-      revision: 0,
-      contentSeq: 0,
-      editedAt: '2026-11-23T10:00:00.000Z',
-      createdAt: '2026-11-23T10:00:00.000Z',
-      updatedAt: '2026-11-23T10:00:00.000Z',
-   };
-
-   it('is the same for the same entity', () => {
-      expect(entityETag({ ...entity })).toBe(entityETag(entity));
-   });
-
-   it('changes when only the status changes', () => {
-      expect(entityETag({ ...entity, status: 'deprecated' })).not.toBe(
-         entityETag(entity),
-      );
-   });
-});
```

Create `packages/platform/synergy/src/api/entity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { Entity } from '../contracts';
import { entityETag } from './entity';

describe('entityETag', () => {
   const entity: Entity = {
      id: '0b5c1c0e-6f0e-4c0e-8a3e-4b3c2d1e0f9a',
      provider: 'sandbox-notes',
      type: 'note',
      displayName: 'A note',
      status: 'active',
      version: 1,
      revision: 0,
      contentSeq: 0,
      editedAt: '2026-11-23T10:00:00.000Z',
      createdAt: '2026-11-23T10:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
   };

   it('is the same for the same entity', () => {
      expect(entityETag({ ...entity })).toBe(entityETag(entity));
   });

   it('changes when only the status changes', () => {
      expect(entityETag({ ...entity, status: 'deprecated' })).not.toBe(
         entityETag(entity),
      );
   });
});
```

`packages/platform/synergy/tests/integration/read-entities.test.ts`:

```diff
@@ -6,7 +6,8 @@ import { withApiGuard } from '@sidekick/core/api';
 import { withRLS } from '@sidekick/core/db';
 import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';
 
-import { entityETag, readEntity } from '../../src/api/read-entity';
+import { entityETag } from '../../src/api/entity';
+import { readEntity } from '../../src/api/read-entity';
 import { entitySchema } from '../../src/contracts';
 import {
    registerEntity,
```

The request schema, in `packages/platform/synergy/src/contracts/entity.ts`:

```diff
@@ -9,6 +9,16 @@ export const EXPLICIT_ENTITY_STATUSES = ['active', 'deprecated'] as const;
 /** A status a person can set by hand */
 export type ExplicitEntityStatus = (typeof EXPLICIT_ENTITY_STATUSES)[number];
 
+/** The body of `PATCH /api/synergy/entities/:id/status` */
+export const setEntityStatusRequestSchema = z.object({
+   status: z.enum(EXPLICIT_ENTITY_STATUSES),
+});
+
+/** The body of `PATCH /api/synergy/entities/:id/status` */
+export interface SetEntityStatusRequest extends z.infer<
+   typeof setEntityStatusRequestSchema
+> {}
+
 /** The lifecycle states an entity can be in */
 export const ENTITY_STATUSES = [
    ...EXPLICIT_ENTITY_STATUSES,
```

`packages/platform/synergy/src/contracts/index.ts`:

```diff
@@ -12,4 +12,8 @@ export {
    type EntityStatus,
    entitySchema,
    type Entity,
+   EXPLICIT_ENTITY_STATUSES,
+   type ExplicitEntityStatus,
+   setEntityStatusRequestSchema,
+   type SetEntityStatusRequest,
 } from './entity';
```

Create the handler, `packages/platform/synergy/src/api/change-entity-status.ts`:

```ts
import { z } from 'zod';

import {
   errorResponse,
   parseRequestBody,
   type ApiHandler,
} from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';

import { setEntityStatusRequestSchema } from '../contracts/entity';
import { SYNERGY_ERROR_CODE } from '../contracts/errors';
import { setEntityStatus } from '../repository/entities';
import { identifyActor } from './actor';
import { entityETag, toEntity, type EntityRouteContext } from './entity';
import { synergyErrorResponse } from './error-response';

/**
 * `PATCH /api/synergy/entities/:id/status` with `{ "status": "deprecated" }`
 * or `"active"`: answers the entity after the change, with its new ETag.
 * Another user's id, a deleted entity and an id that never existed all
 * answer 404 (D209).
 */
export const changeEntityStatus: ApiHandler<EntityRouteContext> =
   async function changeEntityStatus({ tx, req, ctx, caller }) {
      const { id } = await ctx.params;
      if (z.uuid().safeParse(id).error) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      const parsed = await parseRequestBody(req, setEntityStatusRequestSchema);
      if (!parsed.ok) {
         return parsed.response;
      }

      try {
         const row = await setEntityStatus(tx, {
            id,
            status: parsed.data.status,
            actor: identifyActor(caller),
         });
         const entity = toEntity(row);

         return Response.json(entity, {
            headers: {
               'ETag': entityETag(entity),
               'Cache-Control': 'private, no-cache',
            },
         });
      } catch (error) {
         return synergyErrorResponse(error);
      }
   };
```

`packages/platform/synergy/src/server.ts`:

```diff
@@ -17,6 +17,7 @@ export {
 export { synergyErrorResponse } from './api/error-response';
 export { SynergyError } from './repository/errors';
 export { identifyActor } from './api/actor';
-export { toEntity } from './api/entity';
-export { readEntity, type EntityRouteContext } from './api/read-entity';
+export { toEntity, type EntityRouteContext } from './api/entity';
+export { readEntity } from './api/read-entity';
 export { type Actor } from './repository/actor';
+export { changeEntityStatus } from './api/change-entity-status';
```

Create the route, `apps/app/src/app/api/synergy/entities/[id]/status/route.ts`. The folder path is the URL, and Next.js types `params` from it: the file must be inside `[id]`, or the build fails with `Type '{ params: Promise<{}>; }' is not assignable to type 'EntityRouteContext'`. In zsh, quote paths with `[id]`.

```ts
import { withApiGuard } from '@sidekick/core/api';
import { changeEntityStatus } from '@sidekick/synergy/server';

/** Deprecates an entity or makes it active again (see changeEntityStatus) */
export const PATCH = withApiGuard(changeEntityStatus, { lockUser: true });
```

**Check:**

```bash
pnpm turbo build lint typecheck test --filter=@sidekick/app --filter=@sidekick/synergy --force
```

All pass.

```bash
git add packages/platform/synergy "apps/app/src/app/api/synergy/entities/[id]/status"
git commit -m "feat(synergy): deprecate and reactivate entities through PATCH status"
```

## Step 5 — Versions

### 5a — The cursor

Create `packages/platform/synergy/src/api/version-cursor.ts`:

```ts
import { z } from 'zod';

// What a cursor holds: the version number the previous page ended on
const cursorSchema = z.object({ before: z.int().positive() });

/**
 * The cursor for the next page of a version list. Opaque on purpose
 * (base64url JSON), so clients pass it back as it is and never build one;
 * its contents can change without breaking them.
 */
export function encodeVersionCursor(before: number): string {
   return Buffer.from(JSON.stringify({ before })).toString('base64url');
}

/**
 * The version number a cursor points before, or `undefined` if the cursor is
 * not one encodeVersionCursor made.
 */
export function decodeVersionCursor(cursor: string): number | undefined {
   try {
      const json: unknown = JSON.parse(
         Buffer.from(cursor, 'base64url').toString('utf8'),
      );

      return cursorSchema.safeParse(json).data?.before;
   } catch {
      return undefined;
   }
}
```

Create `packages/platform/synergy/src/api/version-cursor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { decodeVersionCursor, encodeVersionCursor } from './version-cursor';

describe('version cursor', () => {
   it('decodes what it encodes', () => {
      expect(decodeVersionCursor(encodeVersionCursor(7))).toBe(7);
   });

   it.each([
      ['not base64url JSON', 'not-a-cursor'],
      ['JSON of the wrong shape', Buffer.from('{"v":7}').toString('base64url')],
      ['a version below 1', encodeVersionCursor(0)],
      ['a fractional version', encodeVersionCursor(2.5)],
      ['an empty string', ''],
   ])('refuses %s', (_, cursor) => {
      expect(decodeVersionCursor(cursor)).toBeUndefined();
   });
});
```

**Why a cursor, and why opaque:** "versions below 27" means the same thing however many versions were added since, where `?page=2` repeats or skips a row; and the database starts from the index instead of counting past skipped rows. Clients only pass the cursor back, never build one, so its contents can change without breaking them; a cursor from before a change answers 400 and the client starts again from page 1. Base64url isn't secret: RLS is the security.

**Check:** `pnpm test` passes.

### 5b — The query

Create `packages/platform/synergy/src/repository/versions.ts`:

```ts
import { and, desc, eq, lt, type InferSelectModel } from 'drizzle-orm';

import type { RlsTx } from '@sidekick/core/db';

import { versionLog } from '../db/schema';

/** A row of version_log, exactly as Drizzle returns it */
export interface VersionLogRow extends InferSelectModel<typeof versionLog> {}

/** Which page of an entity's version log to read */
export interface ListVersionsOptions {
   /** The entity whose versions to list */
   entityId: string;
   /** Only versions below this one; leave it out for the first page */
   before?: number;
   /** At most this many rows */
   limit: number;
}

/**
 * One page of an entity's version log, newest first. RLS limits it to the
 * user's own rows; the unique (entity_id, version) index serves the query.
 */
export async function listVersions(
   tx: RlsTx,
   options: ListVersionsOptions,
): Promise<VersionLogRow[]> {
   const { entityId, before, limit } = options;

   return tx
      .select()
      .from(versionLog)
      .where(
         and(
            eq(versionLog.entityId, entityId),
            before === undefined ? undefined : lt(versionLog.version, before),
         ),
      )
      .orderBy(desc(versionLog.version))
      .limit(limit);
}
```

A read, so no lock. The unique `(entity_id, version)` index serves it.

### 5c — The contract and `invalid_cursor`

Create `packages/platform/synergy/src/contracts/version.ts`:

```ts
import { z } from 'zod';

/** One version bump as Synergy's API returns it, without its provenance */
export const versionSchema = z.object({
   version: z.int().positive(),
   changeNote: z.string().optional(),
   createdAt: z.iso.datetime(),
});

/** One version bump as Synergy's API returns it */
export interface Version extends z.infer<typeof versionSchema> {}

/**
 * One page of `GET /api/synergy/entities/:id/versions`, newest first.
 * `nextCursor` is null on the last page.
 */
export const versionsPageSchema = z.object({
   versions: z.array(versionSchema),
   nextCursor: z.string().nullable(),
});

/** One page of an entity's versions */
export interface VersionsPage extends z.infer<typeof versionsPageSchema> {}
```

`packages/platform/synergy/src/contracts/index.ts`:

```diff
@@ -17,3 +17,9 @@ export {
    setEntityStatusRequestSchema,
    type SetEntityStatusRequest,
 } from './entity';
+export {
+   versionSchema,
+   type Version,
+   versionsPageSchema,
+   type VersionsPage,
+} from './version';
```

`packages/platform/synergy/src/contracts/errors.ts` (the `Record` type fails the typecheck until the new code has its status):

```diff
@@ -7,6 +7,7 @@ import { HTTP_STATUS, type HttpStatus } from '@sidekick/core/http';
 export const SYNERGY_ERROR_CODE = Object.freeze({
    NOT_FOUND: 'not_found',
    STALE_CONTENT: 'stale_content',
+   INVALID_CURSOR: 'invalid_cursor',
 });
 
 /** One of Synergy's error codes */
@@ -22,4 +23,5 @@ export const SYNERGY_ERROR_STATUS: Readonly<
 > = {
    [SYNERGY_ERROR_CODE.NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
    [SYNERGY_ERROR_CODE.STALE_CONTENT]: HTTP_STATUS.CONFLICT,
+   [SYNERGY_ERROR_CODE.INVALID_CURSOR]: HTTP_STATUS.BAD_REQUEST,
 };
```

### 5d — Version 1 at creation, and a backfill

`entity_index` keeps only the last writer, so without a version 1 row the creator is lost after the first save, and a history would have to invent its first entry. `registerEntity` logs version 1. `packages/platform/synergy/src/repository/entities.ts`:

```diff
@@ -51,6 +51,15 @@ export const registerEntity = withUserLock(
          })
          .returning();
 
+      // Version 1 is a version too: the log starts at creation, so the history
+      // is complete without the API or the UI adding the first entry
+      await tx.insert(versionLog).values({
+         userId: currentUserId,
+         entityId: entity.id,
+         version: entity.version,
+         ...toActorColumns(payload.actor),
+      });
+
       await recordEvent(tx, {
          kind: 'entity.created',
          subjectId: entity.id,
```

`packages/platform/synergy/tests/integration/entities.test.ts` now expects two rows after a version save:

```diff
@@ -132,12 +132,18 @@ describe('registerEntity and saveEntityContent', () => {
          }),
       );
       const log = await withRLS(userA, (tx) =>
-         tx.select().from(versionLog).where(eq(versionLog.entityId, id)),
+         tx
+            .select()
+            .from(versionLog)
+            .where(eq(versionLog.entityId, id))
+            .orderBy(versionLog.version),
       );
 
       expect(saved).toMatchObject({ version: 2, revision: 0, contentSeq: 1 });
-      expect(log).toHaveLength(1);
-      expect(log[0]).toMatchObject({
+      expect(log).toHaveLength(2);
+      // Version 1 from creation, with no note; version 2 from this save
+      expect(log[0]).toMatchObject({ version: 1, changeNote: null });
+      expect(log[1]).toMatchObject({
          version: 2,
          changeNote: 'Reworded the rule',
       });
```

Entities created before this have no version 1 row. A data migration adds one:

```bash
pnpm db:generate --filter=@sidekick/synergy -- --custom --name=version_one_backfill
```

Fill `0012_version_one_backfill.sql`:

```sql
-- From Synergy lesson 5, registerEntity logs version 1, so an entity's history
-- starts at its creation. Entities created before that have no version 1 row:
-- add one, dated at the entity's creation. Their creator wasn't recorded
-- (entity_index keeps only the last writer), so the row says the system wrote
-- it, and why. Runs as the migration role, which bypasses RLS.
INSERT INTO 
    version_log 
        (user_id, entity_id, version, created_at, actor_kind, actor_id, reason)
    SELECT 
        ei.user_id, ei.id, 1, ei.created_at, 'system', NULL, 'backfill: version 1 (Synergy lesson 5)'
    FROM 
        entity_index ei
    WHERE NOT EXISTS (
        SELECT 1 FROM version_log vl WHERE vl.entity_id = ei.id AND vl.version = 1
    );
```

It stays a migration even though only an existing database has rows to fill: it is recorded and reviewed, runs once per database, and reaches a copy restored from a backup. `NOT EXISTS` means it never adds a second row.

**Check:** `pnpm test:integration` passes (Synergy 24). If `db:migrate` fails with only `schema "drizzle" already exists` and exit code 1, drizzle-kit has hidden Postgres's error: suspect the newest migration, and to see the message, run its statements in the Supabase SQL editor between `BEGIN;` and `ROLLBACK;`.

### 5e — The handler and the route

Create `packages/platform/synergy/src/api/list-versions.ts`:

```ts
import { z } from 'zod';

import { errorResponse, type ApiHandler } from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';

import { SYNERGY_ERROR_CODE } from '../contracts/errors';
import type { Version, VersionsPage } from '../contracts/version';
import { getEntity } from '../repository/entities';
import { listVersions, type VersionLogRow } from '../repository/versions';
import type { EntityRouteContext } from './entity';
import { decodeVersionCursor, encodeVersionCursor } from './version-cursor';

/** How many versions one page holds */
const PAGE_SIZE = 20;

/** Maps a version_log row to the Version the API returns */
function toVersion(row: VersionLogRow): Version {
   return {
      version: row.version,
      changeNote: row.changeNote ?? undefined,
      createdAt: row.createdAt.toISOString(),
   };
}

/**
 * `GET /api/synergy/entities/:id/versions[?cursor=…]`: one page of the
 * entity's versions, newest first, with the cursor for the next page.
 * Another user's id, a deleted entity and an id that never existed all
 * answer 404 (D209); a cursor this API didn't make answers 400.
 */
export const listEntityVersions: ApiHandler<EntityRouteContext> =
   async function listEntityVersions({ tx, req, ctx }) {
      const { id } = await ctx.params;
      if (z.uuid().safeParse(id).error) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      const cursor = new URL(req.url).searchParams.get('cursor');
      const before = cursor === null ? undefined : decodeVersionCursor(cursor);
      if (cursor !== null && before === undefined) {
         return errorResponse(
            SYNERGY_ERROR_CODE.INVALID_CURSOR,
            HTTP_STATUS.BAD_REQUEST,
         );
      }

      const entity = await getEntity(tx, id, { includeDeleted: false });
      if (!entity) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      // One row more than a page: if it comes back, there is a next page
      const rows = await listVersions(tx, {
         entityId: id,
         before,
         limit: PAGE_SIZE + 1,
      });
      const page = rows.slice(0, PAGE_SIZE);
      const last = page.at(-1);
      const hasMore = rows.length > PAGE_SIZE;

      const body: VersionsPage = {
         versions: page.map(toVersion),
         nextCursor: hasMore && last ? encodeVersionCursor(last.version) : null,
      };
      return Response.json(body);
   };
```

`packages/platform/synergy/src/server.ts`:

```diff
@@ -21,3 +21,4 @@ export { toEntity, type EntityRouteContext } from './api/entity';
 export { readEntity } from './api/read-entity';
 export { type Actor } from './repository/actor';
 export { changeEntityStatus } from './api/change-entity-status';
+export { listEntityVersions } from './api/list-versions';
```

Create `apps/app/src/app/api/synergy/entities/[id]/versions/route.ts`:

```ts
import { withApiGuard } from '@sidekick/core/api';
import { listEntityVersions } from '@sidekick/synergy/server';

/** Lists an entity's versions, a page at a time (see listEntityVersions) */
export const GET = withApiGuard(listEntityVersions);
```

**What and why:** a cursor this API didn't make answers 400 `invalid_cursor`; a missing, deleted or other user's entity answers 404, checked with `getEntity` first, because a deleted entity keeps its version rows and an empty later page isn't a missing entity. 21 rows fill a page of 20: if the 21st comes back, there's a next page. No lock (a read) and no feature (Synergy belongs to every user).

**Check:**

```bash
pnpm turbo build lint typecheck test --filter=@sidekick/app --filter=@sidekick/synergy --force
```

All pass. Then commit and migrate your dev database (it reads the root `.env.local`; Synergy runs `0008` to `0012`):

```bash
git add packages/platform/synergy "apps/app/src/app/api/synergy/entities/[id]/versions"
git commit -m "feat(synergy): list an entity's versions, starting at version 1"
pnpm db:migrate
```

## Step 6 — Prove it

### 6a — The outbox

Create `packages/platform/synergy/tests/integration/outbox.test.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { outbox } from '../../src/db/schema';
import type { Actor } from '../../src/repository/actor';
import {
   registerEntity,
   saveEntityContent,
   setEntityStatus,
} from '../../src/repository/entities';

// Proves the outbox: every Synergy write leaves exactly its events, in the
// order they happened, in the same transaction as the write. Reads the outbox
// as postgres, because app_runtime may not (the last test proves it).

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const user = randomUUID();
const actor: Actor = { kind: 'human', id: user };

beforeAll(async () => {
   await testAuthDb`INSERT INTO auth.users (id, email) VALUES (${user}, 'outbox@example.com')`;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

/** One event as the tests compare it */
interface StoredEvent {
   kind: string;
   payload: unknown;
   xactId: string;
   actorKind: string;
   actorId: string | null;
}

/** The entity's events in the order a reader would process them */
async function eventsOf(subjectId: string): Promise<StoredEvent[]> {
   return testAdminDb<StoredEvent[]>`
      SELECT kind, payload, xact_id::text AS "xactId",
         actor_kind AS "actorKind", actor_id AS "actorId"
      FROM outbox
      WHERE subject_id = ${subjectId}
      ORDER BY xact_id, id`;
}

async function newEntity(): Promise<string> {
   const id = randomUUID();
   await withRLS(user, (tx) =>
      registerEntity(tx, {
         id,
         provider: 'sandbox-notes',
         type: 'note',
         displayName: 'A note',
         actor,
      }),
   );
   return id;
}

describe('the outbox', () => {
   it('records entity.created when an entity is registered', async () => {
      const id = await newEntity();

      expect(await eventsOf(id)).toEqual([
         expect.objectContaining({
            kind: 'entity.created',
            payload: { provider: 'sandbox-notes', type: 'note' },
            actorKind: 'human',
            actorId: user,
         }),
      ]);
   });

   it('records a version save as two events in one transaction, in order', async () => {
      const id = await newEntity();
      await withRLS(user, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'version',
            displayName: 'Edited',
            actor,
         }),
      );

      const [created, saved, bumped] = await eventsOf(id);

      expect([created.kind, saved.kind, bumped.kind]).toEqual([
         'entity.created',
         'entity.content_saved',
         'entity.version_bumped',
      ]);
      expect(saved.payload).toEqual({ contentSeq: 1 });
      expect(bumped.payload).toEqual({ version: 2 });
      // One save, one transaction; the registration was another
      expect(saved.xactId).toBe(bumped.xactId);
      expect(BigInt(created.xactId)).toBeLessThan(BigInt(saved.xactId));
   });

   it('records only content_saved for a revision save', async () => {
      const id = await newEntity();
      await withRLS(user, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'revision',
            displayName: 'Edited',
            actor,
         }),
      );

      expect((await eventsOf(id)).map(({ kind }) => kind)).toEqual([
         'entity.created',
         'entity.content_saved',
      ]);
   });

   it('records a status change, and nothing when the status is already set', async () => {
      const id = await newEntity();
      const deprecate = () =>
         withRLS(user, (tx) =>
            setEntityStatus(tx, { id, status: 'deprecated', actor }),
         );
      await deprecate();
      await deprecate();

      const events = await eventsOf(id);

      expect(events.map(({ kind }) => kind)).toEqual([
         'entity.created',
         'entity.status_changed',
      ]);
      expect(events[1].payload).toEqual({ from: 'active', to: 'deprecated' });
   });

   it('records nothing for a stale save', async () => {
      const id = await newEntity();

      await expect(
         withRLS(user, (tx) =>
            saveEntityContent(tx, {
               id,
               baselineContentSeq: 7,
               bump: 'revision',
               displayName: 'Stale',
               actor,
            }),
         ),
      ).rejects.toMatchObject({ code: 'stale_content' });
      expect((await eventsOf(id)).map(({ kind }) => kind)).toEqual([
         'entity.created',
      ]);
   });

   it('loses its events with the write when the transaction fails', async () => {
      const id = randomUUID();

      await expect(
         withRLS(user, async (tx) => {
            await registerEntity(tx, {
               id,
               provider: 'sandbox-notes',
               type: 'note',
               displayName: 'Never saved',
               actor,
            });
            throw new Error('the provider failed after Synergy wrote');
         }),
      ).rejects.toThrow('the provider failed');
      expect(await eventsOf(id)).toEqual([]);
   });

   it('is closed to app_runtime: it can write events but not read them', async () => {
      await expect(
         withRLS(user, (tx) => tx.select().from(outbox)),
      ).rejects.toMatchObject({
         cause: expect.objectContaining({
            message: 'permission denied for table outbox',
         }),
      });
   });
});
```

It reads the outbox as `postgres` in reader order (`ORDER BY xact_id, id`). `BigInt` compares `xid8` values beyond JavaScript's safe integers. **Check:** Synergy 31 passed.

### 6b — The status route

Create `packages/platform/synergy/tests/integration/entity-status.test.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { changeEntityStatus } from '../../src/api/change-entity-status';
import { readEntity } from '../../src/api/read-entity';
import { entitySchema } from '../../src/contracts';
import { registerEntity } from '../../src/repository/entities';
import { signInAs } from '../helpers';

// Proves PATCH /api/synergy/entities/:id/status end to end: the real guard,
// handler and database, with only the Supabase session faked (see signInAs).
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const stranger = randomUUID();

// The same guard options as apps/app's route files
const PATCH = withApiGuard(changeEntityStatus, { lockUser: true });
const GET = withApiGuard(readEntity);

function setStatus(id: string, status: string) {
   return PATCH(
      new Request(`http://localhost/api/synergy/entities/${id}/status`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ status }),
      }),
      { params: Promise.resolve({ id }) },
   );
}

function read(id: string, ifNoneMatch?: string) {
   return GET(
      new Request(`http://localhost/api/synergy/entities/${id}`, {
         headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {},
      }),
      { params: Promise.resolve({ id }) },
   );
}

async function newEntity(): Promise<string> {
   const id = randomUUID();
   await withRLS(owner, (tx) =>
      registerEntity(tx, {
         id,
         provider: 'sandbox-notes',
         type: 'note',
         displayName: 'A note',
         actor: { kind: 'human', id: owner },
      }),
   );
   return id;
}

beforeAll(async () => {
   await testAuthDb`
      INSERT INTO auth.users (id, email)
      VALUES
         (${owner}, 'owner@example.com'),
         (${stranger}, 'stranger@example.com')
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

describe('PATCH /api/synergy/entities/:id/status', () => {
   it('deprecates and reactivates, moving no counter', async () => {
      signInAs(owner);
      const id = await newEntity();

      const deprecated = await setStatus(id, 'deprecated');
      const reactivated = await setStatus(id, 'active');

      expect(deprecated.status).toBe(200);
      expect(entitySchema.parse(await deprecated.json())).toMatchObject({
         status: 'deprecated',
         version: 1,
         revision: 0,
         contentSeq: 0,
      });
      expect(reactivated.status).toBe(200);
      expect(entitySchema.parse(await reactivated.json())).toMatchObject({
         status: 'active',
         version: 1,
         revision: 0,
         contentSeq: 0,
      });
   });

   it('gives a cached copy a new ETag once the status changes (D271)', async () => {
      signInAs(owner);
      const id = await newEntity();
      const etag = (await read(id)).headers.get('ETag') ?? '';

      const patched = await setStatus(id, 'deprecated');
      const response = await read(id, etag);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: 'deprecated' });
      // The PATCH answer carries the same new ETag a GET gives
      expect(patched.headers.get('ETag')).toBe(response.headers.get('ETag'));
      expect(response.headers.get('ETag')).not.toBe(etag);
   });

   it('refuses superseded, which only a supersede sets', async () => {
      signInAs(owner);
      const id = await newEntity();

      const response = await setStatus(id, 'superseded');

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
         code: 'validation_failed',
      });
   });

   it('answers 404 for another user’s entity, a deleted one and a non-uuid id', async () => {
      signInAs(owner);
      const deleted = await newEntity();
      await testAdminDb`UPDATE entity_index SET deleted_at = now() WHERE id = ${deleted}`;
      const owned = await newEntity();

      signInAs(stranger);
      const strangers = await setStatus(owned, 'deprecated');
      signInAs(owner);
      const tombstone = await setStatus(deleted, 'deprecated');
      const notAnId = await setStatus('not-a-uuid', 'deprecated');

      expect([strangers.status, tombstone.status, notAnId.status]).toEqual([
         404, 404, 404,
      ]);
      // The stranger's request changed nothing
      expect(await (await read(owned)).json()).toMatchObject({
         status: 'active',
      });
   });
});
```

Through the guard with the route file's options. **Check:** Synergy 35 passed. To watch D271 matter, make `entityETag` return `` `"${entity.contentSeq}"` ``: "gives a cached copy a new ETag once the status changes" fails. Put it back.

### 6c — The version list

Create `packages/platform/synergy/tests/integration/list-versions.test.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { listEntityVersions } from '../../src/api/list-versions';
import { versionsPageSchema, type VersionsPage } from '../../src/contracts';
import type { Actor } from '../../src/repository/actor';
import {
   registerEntity,
   saveEntityContent,
} from '../../src/repository/entities';
import { signInAs } from '../helpers';

// Proves GET /api/synergy/entities/:id/versions end to end: the real guard,
// handler and database, with only the Supabase session faked (see signInAs).
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const stranger = randomUUID();

// The same guard options as apps/app's route file: none
const GET = withApiGuard(listEntityVersions);

function list(id: string, cursor?: string) {
   const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
   return GET(
      new Request(
         `http://localhost/api/synergy/entities/${id}/versions${query}`,
      ),
      { params: Promise.resolve({ id }) },
   );
}

async function page(id: string, cursor?: string): Promise<VersionsPage> {
   const response = await list(id, cursor);
   expect(response.status).toBe(200);
   return versionsPageSchema.parse(await response.json());
}

/** A fresh entity with this many version saves after its creation */
async function entityWithVersions(saves: number): Promise<string> {
   const id = randomUUID();
   const actor: Actor = { kind: 'human', id: owner };
   await withRLS(owner, (tx) =>
      registerEntity(tx, {
         id,
         provider: 'sandbox-notes',
         type: 'note',
         displayName: 'A note',
         actor,
      }),
   );
   for (let seq = 0; seq < saves; seq++) {
      await withRLS(owner, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: seq,
            bump: 'version',
            changeNote: `Save ${seq + 1}`,
            displayName: 'A note',
            actor,
         }),
      );
   }
   return id;
}

beforeAll(async () => {
   await testAuthDb`
      INSERT INTO auth.users (id, email)
      VALUES
         (${owner}, 'owner@example.com'),
         (${stranger}, 'stranger@example.com')
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

describe('GET /api/synergy/entities/:id/versions', () => {
   it('lists a new entity’s version 1, from its creation', async () => {
      signInAs(owner);
      const id = await entityWithVersions(0);

      expect(await page(id)).toEqual({
         versions: [{ version: 1, createdAt: expect.any(String) }],
         nextCursor: null,
      });
   });

   it('pages newest first, with no gap or repeat, until nextCursor is null', async () => {
      signInAs(owner);
      // 25 saves: versions 26 down to 1, so pages of 20 and 6
      const id = await entityWithVersions(25);

      const first = await page(id);
      const second = await page(id, first.nextCursor ?? undefined);
      const all = [...first.versions, ...second.versions].map(
         ({ version }) => version,
      );

      expect(first.versions).toHaveLength(20);
      expect(first.versions[0]).toMatchObject({
         version: 26,
         changeNote: 'Save 25',
      });
      expect(second.versions).toHaveLength(6);
      expect(second.nextCursor).toBeNull();
      expect(all).toEqual(Array.from({ length: 26 }, (_, i) => 26 - i));
   });

   it('answers 400 for a cursor it didn’t make', async () => {
      signInAs(owner);
      const id = await entityWithVersions(0);

      const response = await list(id, 'not-a-cursor');

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'invalid_cursor' });
   });

   it('answers 404 for another user’s entity and a deleted one', async () => {
      signInAs(owner);
      const owned = await entityWithVersions(1);
      const deleted = await entityWithVersions(1);
      await testAdminDb`UPDATE entity_index SET deleted_at = now() WHERE id = ${deleted}`;

      const tombstone = await list(deleted);
      signInAs(stranger);
      const strangers = await list(owned);

      expect([tombstone.status, strangers.status]).toEqual([404, 404]);
   });
});
```

**Check:** Synergy 39 passed (core 35, notes 6, tasks 6).

```bash
git add packages/platform/synergy/tests
git commit -m "test(synergy): prove the outbox, the status route and the version list"
```

## Step 7 — The PR

The design docs this changed go in the same PR: the Synergy overview (event kinds, `outbox_reader`, the snapshot's xmin, version 1, the ETag, the API table), content sequence with [[D271]] and its row in the decisions log, store choices, delete models, the RLS page's insert-only template, lesson 7's brief, the PRD's [[D177]] and the spec, glossary pages for [[07-glossary/user|user]], [[07-glossary/actor|actor]] and [[07-glossary/caller|caller]], and the file-naming rule in the [[08-ai-coding-harness/architecture-invariants|architecture invariants]]. Then:

```bash
pnpm prettier:check
pnpm turbo lint typecheck build test --force
pnpm test:integration
git push -u origin feat/synergy/outbox
```

Open the PR as `feat(synergy): the outbox, entity status and the version list` ([sidekick#69](https://github.com/mehtapratik/sidekick/pull/69)) and squash-merge it when the `checks` job is green.

## Exit check

- `pnpm prettier:check`, `lint`, `typecheck`, `build` and `test` green uncached (35 tasks); `pnpm test:integration` green: core 35, Synergy 39, notes 6, tasks 6. The CI `checks` job green on #69.
- Dev migrated through Synergy `0012`.
