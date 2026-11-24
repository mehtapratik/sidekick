---
publish: true
id: build.phase-3.lesson-4
title: "Synergy Lesson 4 Walkthrough: Sandbox Providers and the First Routes"
created: 2026-11-22
updated: 2026-11-24
kind: guidance
version: 2.0.0
tags:
   - build
   - walkthrough
   - phase-3
   - synergy
   - feature-system
   - api
   - database
   - rls
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-4-sandbox-providers/00-brief]]"
---

# Synergy Lesson 4 Walkthrough — Sandbox Providers and the First Routes

This walkthrough lets you repeat lesson 4 from the page alone and end up where [sidekick#64](https://github.com/mehtapratik/sidekick/pull/64) ended: two sandbox feature packages with their own tables and routes, Synergy's first route with an ETag and 304, write transactions that take the user lock first, one way to validate input and one way to answer errors, an error response that rolls back (D268), and tests that prove all of it. Every step gives the file, the exact code, the commands, and what you should see; a short **What** and **How** follow.

The notes behind it (questions, design calls, surprises) are in [[04-phases/03-synergy/00-lessons/lesson-4-sandbox-providers/02-notes|the lesson notes]].

**The order.** The steps follow the order the lesson was built, with two exceptions so every step builds on finished code: `HTTP_STATUS` (5a) comes before the error map that uses it, and refinements made later in the lesson (each package's `ENTITY_TYPE`, Synergy's `SYNERGY_ERROR_CODE`, the response schemas) are folded into the step that creates their file. Each code block is the file as merged.

## Before you start

- Lesson 3 is merged, and `main` passes `pnpm test:integration` (core 17, Synergy 15 at the end of lesson 3 plus its follow-up).
- Make a branch:

```bash
git switch main && git pull && git switch -c feat/synergy/sandbox-providers
```

- After each step, the checks that matter run from the repo root: `pnpm turbo typecheck lint test --force` (uncached) and, where the step touches the database, `pnpm test:integration`. Integration tests only run through the root script, which builds the throwaway database.

## How a request flows

What the lesson builds, for `PUT /api/sandbox/notes/:id`:

1. **Route file** (`apps/app/src/app/api/sandbox/notes/[id]/route.ts`): wiring only. A URL and method, a handler, the guard's options.
2. **Guard** (`withApiGuard`, `@sidekick/core/api`): who are you (401), open the transaction, set the user, take the user lock, do you have the feature (403), run the handler, then commit, or roll back on a throw or an error response (D268), and log.
3. **Handler** (`saveNote`, `@sidekick/sandbox-notes/server`): validate the input against the contract (400), ask Synergy to record the save (404, 409), write the feature's own table, shape the response.
4. **Feature contract** (`@sidekick/sandbox-notes/contracts`): request and response schemas, no database code, so a UI imports the same file.
5. **Synergy's repository** (`saveEntityContent`, `@sidekick/synergy/server`): the stale check, the revision or version bump, the version log. It speaks in error codes, never HTTP.
6. **Synergy's contract** (`@sidekick/synergy/contracts`): `Entity`, the error codes and their statuses.
7. **Schemas** (`src/db/schema/` in each package): the tables as TypeScript, the source of every migration and RLS policy.
8. **Postgres:** RLS, soft-delete triggers, the deferred foreign key and the transaction.

Where does a new piece go? Shared with the browser: a contract. Needs the database: `/server`, behind a handler. About one URL: a route file. About every request: the guard.

## Step 1 — The user lock at the start of a transaction

Lesson 3 left a deadlock for lesson 10: a provider writes its own row before calling Synergy, so the user lock wasn't first in the transaction. `withRLS` now takes it right after it sets the user.

### 1a — Two wrappers inside `withRLS`

Replace `packages/foundation/core/src/db/rls.ts`:

```ts
import { sql } from 'drizzle-orm';

import { getUnsafeDb } from './unsafe';

type UnsafeDbTx = Parameters<
   Parameters<ReturnType<typeof getUnsafeDb>['transaction']>[0]
>[0];

/** A database transaction scoped to one user, so RLS policies apply to every query in it */
export interface RlsTx extends UnsafeDbTx {}

/** Work to run inside withRLS's transaction */
export type RlsTxHandler<T> = (tx: RlsTx) => Promise<T>;

/** Work that takes the RLS transaction first, then its own arguments */
export type RlsTxWork<Args extends unknown[], Result> = (
   tx: RlsTx,
   ...args: Args
) => Promise<Result>;

/** Extra work withRLS does before it runs fn */
export interface RlsOptions {
   /** Take the user's lock before fn runs. Every write route sets it. */
   lockUser?: boolean;
}

/**
 * Wraps work so it takes the current user's lock before anything else. The lock
 * is held until the transaction ends, so one user's locked work runs one at a time.
 */
export function withUserLock<Args extends unknown[], Result>(
   work: RlsTxWork<Args, Result>,
): RlsTxWork<Args, Result> {
   return async function lockedWork(tx, ...args) {
      // The key is the user withRLS set, so the lock can't name another user.
      // Without withRLS, current_setting raises an error instead of locking nothing.
      await tx.execute(
         sql`select pg_advisory_xact_lock(hashtextextended(current_setting('app.current_user_id'), 0))`,
      );
      return work(tx, ...args);
   };
}

// Not exported: withRLS stays the only public way into user data.
function withUserOnlyData<T>(
   fn: RlsTxHandler<T>,
): (userId: string) => Promise<T> {
   return async function userOnlyData(userId) {
      return getUnsafeDb().transaction(async (tx) => {
         await tx.execute(
            sql`select set_config('app.current_user_id', ${userId}, true)`,
         );
         return fn(tx);
      });
   };
}

/** Opens a transaction as the given user, so RLS filters every query to that user's rows, and runs fn in it */
export async function withRLS<T>(
   userId: string,
   fn: RlsTxHandler<T>,
   options: RlsOptions = {},
): Promise<T> {
   // The lock wraps fn, so it runs right after the user is set and before fn
   // touches a row: two of the user's requests can't take locks in opposite
   // orders and deadlock.
   const work = options.lockUser ? withUserLock(fn) : fn;
   return withUserOnlyData(work)(userId);
}
```

Replace `packages/foundation/core/src/db/index.ts`:

```ts
/** Safe entry point: every user-data query runs inside withRLS. */
export {
   withRLS,
   withUserLock,
   type RlsTx,
   type RlsTxWork,
   type RlsOptions,
} from './rls';
```

Check:

```bash
pnpm turbo typecheck lint --filter=@sidekick/core --force
```

Both tasks succeed.

**What:** the user lock becomes something core can take as the first statement of any transaction, and one `withUserLock` serves both routes and Synergy.

**How:**

1. `withUserOnlyData` (private) opens the transaction and sets `app.current_user_id`.
2. `withUserLock` wraps any work so the advisory lock runs first; it's generic over extra arguments, so it fits a route's `(tx)` and Synergy's `(tx, payload)`.
3. `withRLS` composes them: with `lockUser`, the lock sits between "set the user" and "run fn".

### 1b — The guard passes `lockUser` through

In `packages/foundation/core/src/api/guard.ts`, add to `GuardOptions`:

```ts
   /** Take the user's lock at the start of the transaction. Every write route sets it. */
   lockUser?: boolean;
```

and pass it to `withRLS` at the end of `authorizeAndHandle` (step 5d later wraps this call):

```ts
   return withRLS(
      caller.userId,
      async (tx) => {
         if (
            opts.feature &&
            !(await getEnabledFeatures(tx)).includes(opts.feature)
         ) {
            return { code: 'FEATURE_DISABLED', feature: opts.feature };
         }

         return handler({ tx, caller, req, ctx });
      },
      {
         lockUser: opts.lockUser,
      },
   );
```

In the `withApiGuard` JSDoc, the `@param opts` line becomes:

```ts
 * @param opts Feature the caller must be entitled to, scope a key caller must hold, and whether to take the user's lock
```

In `packages/foundation/core/src/api/guard.test.ts`, the test "runs the handler in the caller's transaction and passes ctx through" now expects the third argument:

```ts
      expect(withRLS).toHaveBeenCalledWith(
         MOCK_SESSION_CALLER.userId,
         expect.any(Function),
         { lockUser: undefined },
      );
```

and a new test follows it:

```ts
   it('asks withRLS for the user lock when the route sets lockUser', async () => {
      await withApiGuard(mockHandler, { lockUser: true })(
         createMockHttpRequest(),
         undefined,
      );

      expect(withRLS).toHaveBeenCalledWith(
         MOCK_SESSION_CALLER.userId,
         expect.any(Function),
         { lockUser: true },
      );
   });
```

Check:

```bash
pnpm turbo typecheck lint test --filter=@sidekick/core --force
```

Core's unit tests: `Tests  28 passed (28)`.

**What:** a route asks for the lock next to its feature: `withApiGuard(handler, { feature, lockUser: true })`. Read routes leave it out and never wait.

**How:** the guard owns the transaction, so it forwards the flag. Inside a write route's transaction: set the user, take the lock, read entitlements (no row lock), run the handler.

### 1c — Synergy uses core's lock

```bash
git rm packages/platform/synergy/src/repository/lock.ts
```

In `packages/platform/synergy/src/repository/entities.ts`, the core import becomes:

```ts
import { withUserLock, type RlsTx } from '@sidekick/core/db';
```

and `import { withUserLock } from './lock';` goes.

Check:

```bash
pnpm turbo typecheck lint --filter=@sidekick/synergy --force
```

Both succeed: `sidekick/require-user-lock` only checks that `withUserLock` is imported, not where from.

**What:** one lock wrapper for the whole app, so routes and Synergy take the same lock with the same key. A route already holding it makes Synergy's second take free.

### 1d — Prove the lock

Create `packages/foundation/core/tests/integration/user-lock.test.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createTestRuntimeDb } from '@sidekick/test-utils/db';

import { withRLS, type RlsTx } from '../../src/db';

// Proves withRLS's lockUser option against a real database: the lock is taken,
// and it makes one user's locked transactions run one at a time. Runs inside
// pnpm test:integration (DATABASE_URL is app_runtime, the role withRLS uses).

const testRuntimeDb = createTestRuntimeDb();

const userA = randomUUID();
const userB = randomUUID();

afterAll(async () => {
   await testRuntimeDb.end();
});

/** How many advisory locks this transaction's own connection holds */
async function advisoryLocksHeld(tx: RlsTx): Promise<number> {
   const [row] = await tx.execute<{ held: number }>(
      sql`select count(*)::int as held from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()`,
   );
   return row.held;
}

/** How many advisory locks any connection is waiting for */
async function advisoryLocksAwaited(): Promise<number> {
   const [row] = await testRuntimeDb<{ awaited: number }[]>`
      select count(*)::int as awaited from pg_locks
      where locktype = 'advisory' and not granted`;
   return row.awaited;
}

describe('withRLS lockUser', () => {
   it('takes no lock by default', async () => {
      expect(await withRLS(userA, advisoryLocksHeld)).toBe(0);
   });

   it('holds the user lock before fn runs when lockUser is set', async () => {
      expect(await withRLS(userA, advisoryLocksHeld, { lockUser: true })).toBe(
         1,
      );
   });

   it('makes a second locked transaction for the same user wait, but not another user’s', async () => {
      const order: string[] = [];
      let lock = () => {
         /* no-ops */
      };
      let unlock = () => {
         /* no-ops */
      };
      const waitForLock = new Promise<void>((resolve) => (lock = resolve));
      const waitForUnlock = new Promise<void>((resolve) => (unlock = resolve));

      // The first transaction takes userA's lock and holds it until released
      const first = withRLS(
         userA,
         async () => {
            // resolves `waitForLock` promise to allow move to execution on next line after it
            lock();
            // waits here until promise is resolved, i.e. `unlock` is invoked.
            await waitForUnlock;
            order.push('first done');
         },
         { lockUser: true },
      );
      // waits here until promise is resolved, i.e. `lock` is invoked.
      await waitForLock;

      // A second one for userA starts, and Postgres makes it wait for the lock
      const second = withRLS(
         userA,
         async () => {
            order.push('second ran');
         },
         { lockUser: true },
      );
      await vi.waitFor(async () => {
         // since `unlock` is not called, i.e. `waitForUnlock` is not resolved,
         // first transaction lock must still be in place for `userA`
         expect(await advisoryLocksAwaited()).toBe(1);
      });

      // The third transaction for userB's lock has a different key,
      // so userB doesn't wait for userA
      await withRLS(
         userB,
         async () => {
            order.push('userB ran');
         },
         { lockUser: true },
      );

      // Releasing the first lock on `userA` lets the second transaction
      // on the same user run, never before. This is done by resolving
      // `waitForUnlock` promise to allow move to execution on next line after it
      unlock();
      await Promise.all([first, second]);
      expect(order).toEqual(['userB ran', 'first done', 'second ran']);
   });
});
```

Check:

```bash
pnpm test:integration
```

`@sidekick/core:test:integration` ends with `Tests  20 passed (20)`. Watch it fail once: change `withRLS` to `const work = fn;`, run again, and two tests fail ("expected +0 to be 1"); put it back.

**What:** proof against Postgres that the lock is taken, that a second locked transaction for the same user waits, and that another user's doesn't.

**How:** `pg_locks` is Postgres's live table of held and awaited locks. The third test holds userA's lock open with an unresolved promise, waits until `pg_locks` shows one lock not yet granted (the second transaction), runs userB straight through, then releases the first and checks the order `['userB ran', 'first done', 'second ran']`. The file must end in `.test.ts`, or Vitest never runs it.

Commit: `feat(core): take the user lock at the start of withRLS`.

## Step 2 — The sandbox packages

### 2a — Make room for `_sandbox`

In `pnpm-workspace.yaml`, after `- 'packages/features/*'`:

```yaml
   - 'packages/features/_sandbox/*'
```

In `eslint.config.js`, add to the end of `tsProjects`:

```js
   'packages/features/_sandbox/*/tsconfig.json',
```

and in `boundaries/elements`, right before the `packages/features/*` entry:

```js
            // Each sandbox provider is its own feature, so notes can't import
            // tasks. Listed first: packages/features/* also matches _sandbox.
            { type: 'feature', pattern: 'packages/features/_sandbox/*' },
```

**What:** pnpm finds the sandbox packages, ESLint can resolve imports into them, and boundaries treats notes and tasks as separate features. Without the element, `_sandbox` as a whole would be one feature and imports between notes and tasks would never be checked.

### 2b — The notes package

Create `packages/features/_sandbox/notes/package.json` (step 3b adds the database scripts and dependencies, step 5 the other entry points):

```json
{
   "name": "@sidekick/sandbox-notes",
   "version": "0.0.0",
   "private": true,
   "license": "MIT",
   "type": "module",
   "exports": {
      ".": "./src/index.ts"
   },
   "scripts": {
      "lint": "eslint .",
      "typecheck": "tsc -p tsconfig.json --noEmit"
   }
}
```

`packages/features/_sandbox/notes/tsconfig.json` (step 3b adds Node types and the Drizzle config):

```json
{
   "extends": "../../../../tsconfig.base.json",
   "include": ["src"]
}
```

`packages/features/_sandbox/notes/src/index.ts` (`ENTITY_TYPE` was added at the end of the lesson):

```ts
/** The notes sandbox's key: its entitlement, its guard option and its Synergy provider name */
export const FEATURE_KEY = 'sandbox-notes';

/** The notes sandbox's manifest, which the features registry lists */
export const MANIFEST = {
   key: FEATURE_KEY,
   name: 'Sandbox notes',
   description: 'A mock notes provider that Synergy is proven with',
};

/**
 * The entity types the notes sandbox provides, by name. A type is scoped to its
 * provider (D200): Synergy never lists them, and another provider may reuse
 * the same word.
 */
export const ENTITY_TYPE = Object.freeze({
   NOTE: 'note',
});
```

### 2c — The tasks package

The same three files under `packages/features/_sandbox/tasks/`, with `"name": "@sidekick/sandbox-tasks"` and this `src/index.ts`:

```ts
/** The tasks sandbox's key: its entitlement, its guard option and its Synergy provider name */
export const FEATURE_KEY = 'sandbox-tasks';

/** The tasks sandbox's manifest, which the features registry lists */
export const MANIFEST = {
   key: FEATURE_KEY,
   name: 'Sandbox tasks',
   description: 'A mock tasks provider that Synergy is proven with',
};

/**
 * The entity types the tasks sandbox provides, by name. A type is scoped to its
 * provider (D200): Synergy never lists them, and another provider may reuse
 * the same word.
 */
export const ENTITY_TYPE = Object.freeze({
   TASK: 'task',
});
```

Mind the folder: both must sit under `packages/features/_sandbox/`. A copy made in Finder is named `notes copy`; rename it to `tasks`.

### 2d — The registry lists both

In `packages/features-registry/package.json`, after `scripts`:

```json
   "dependencies": {
      "@sidekick/sandbox-notes": "workspace:*",
      "@sidekick/sandbox-tasks": "workspace:*"
   },
```

Replace `packages/features-registry/src/index.ts`:

```ts
import * as sandboxNotes from '@sidekick/sandbox-notes';
import * as sandboxTasks from '@sidekick/sandbox-tasks';

import type { FeatureManifest } from './manifest';

export type { FeatureManifest } from './manifest';

/** Every feature's manifest in the system */
export const ALL_FEATURES: readonly FeatureManifest[] = [
   sandboxNotes.MANIFEST,
   sandboxTasks.MANIFEST,
];

/** The key of every feature in ALL_FEATURES, so a mistyped key is a type error */
export type FeatureKey =
   typeof sandboxNotes.FEATURE_KEY | typeof sandboxTasks.FEATURE_KEY;
```

Check:

```bash
pnpm install
```

```bash
pnpm turbo build typecheck lint test --filter=@sidekick/features-registry --filter=@sidekick/ops --force
```

Every task succeeds, and `pnpm ls -r --depth -1` lists `@sidekick/sandbox-notes` and `@sidekick/sandbox-tasks`.

**What:** the first two feature packages, each describing itself with a key and a manifest, and a registry that lists them.

**How:**

1. A feature sits below the registry and can't import it, so the `FeatureManifest` type stays in the registry, and each feature exports a plain object the registry's annotation checks.
2. `FeatureKey` is built from the `FEATURE_KEY` constants: a `const` string keeps its literal type, a key inside a plain object widens to `string`. No type casts.
3. `ENTITY_TYPE` names the entity types each provider owns; types belong to their provider (D200), so there is no central list.
4. The manifest's `name` and `description` are inline: only the ops script reads them (backlog B22).

### 2e — Watch lint refuse a feature-to-feature import

Create `packages/features/_sandbox/notes/src/probe.ts`:

```ts
import { FEATURE_KEY } from '@sidekick/sandbox-tasks';

export const PROBE = FEATURE_KEY;
```

add `"dependencies": { "@sidekick/sandbox-tasks": "workspace:*" }` to the notes `package.json`, then:

```bash
pnpm install && pnpm turbo lint --filter=@sidekick/sandbox-notes --force
```

Expected:

```
2:29  error  There is no policy allowing dependencies from elements of type "feature" to elements of type "feature"  boundaries/dependencies
```

Comment out the `packages/features/_sandbox/*` element and the same lint passes. Put it back, delete `probe.ts` and the dependency, and run `pnpm install`.

Commit: `feat(sandbox): add the notes and tasks sandbox feature packages`.

## Step 3 — The tables

### 3a — Refuse relative imports into another package

In `eslint.config.js`, in the "Dependency hygiene" block, after the `import-x/no-extraneous-dependencies` rule:

```js
         // Another package is imported by its name, never by a relative path
         // into its folder: a relative path skips its package.json `exports`
         // and its declared dependency, and breaks when a folder moves.
         'import-x/no-relative-packages': 'error',
```

Probe it with `packages/features/_sandbox/notes/src/probe.ts`:

```ts
import { FEATURE_KEY } from '../../tasks/src';

export const PROBE = FEATURE_KEY;
```

```bash
pnpm turbo lint --filter=@sidekick/sandbox-notes --force
```

Expected: `Relative import from another package is not allowed` (`import-x/no-relative-packages`) next to the boundaries error. Delete `probe.ts`.

**What:** an editor once rewrote an import into `../../features/_sandbox/notes copy/src`, and lint said nothing: the registry may import features, so boundaries allowed the direction. This rule refuses the path.

Commit: `chore(lint): refuse relative imports into another package`.

### 3b — Share the timestamp and tombstone columns

Create `packages/foundation/core/src/db/columns.ts`:

```ts
import { timestamp } from 'drizzle-orm/pg-core';

// Column conventions every package's tables share. Spread them into each
// pgTable: Drizzle builds a fresh column per table.

/** A timestamp column stored with its time zone */
export function utcTimestamp(name: string): ReturnType<typeof timestamp> {
   return timestamp(name, { withTimezone: true });
}

/** created_at and updated_at, both set to now() on insert */
export const timestamps = {
   createdAt: utcTimestamp('created_at').notNull().defaultNow(),
   updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
};

/** deleted_at: NULL while the row is live. A soft-deleted row (a tombstone) keeps its data. */
export const tombstone = {
   deletedAt: utcTimestamp('deleted_at'),
};
```

In `packages/foundation/core/package.json` `exports`, after `"./db"`:

```json
      "./db/columns": "./src/db/columns.ts",
```

In `packages/platform/synergy/src/db/schema/columns.ts`, remove `timestamp,` from the `pg-core` import, delete `utcTimestamp`, `timestamps` and `tombstone`, and replace the comment under the imports with:

```ts
// Columns only Synergy's tables carry: who wrote a row, and why. The shared
// conventions (timestamps, tombstone) come from @sidekick/core/db/columns.
```

In `entity-index.ts` and `version-log.ts`, import them from core:

```ts
import { timestamps, tombstone, utcTimestamp } from '@sidekick/core/db/columns';
```

```ts
import { utcTimestamp } from '@sidekick/core/db/columns';
```

and keep only `provenance`, `provenanceChecks` (and `sqlList` in `entity-index.ts`) from `./columns`.

Check:

```bash
pnpm db:generate --filter=@sidekick/synergy
```

Expected: `No schema changes, nothing to migrate`. (If drizzle-kit crashes with "`Bud1` is not valid JSON", delete the Finder `.DS_Store` in `src/db/migrations/meta/`.)

**What:** every package's tables record time and soft deletion the same way. Provenance stays in Synergy: who wrote what is recorded once, in `entity_index` and `version_log`, so provider rows don't carry it.

Commit: `refactor(core): share the timestamp and tombstone columns`.

### 3c — The notes table

1. Give notes its own migrations. Replace `packages/features/_sandbox/notes/tsconfig.json`:

```json
{
   "extends": "../../../../tsconfig.base.json",
   "compilerOptions": {
      "types": ["node"]
   },
   "include": ["src", "tests", "drizzle.config.ts", "vitest.config.ts"]
}
```

   create `packages/features/_sandbox/notes/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

const directUrl = process.env.DATABASE_DIRECT_URL;

if (!directUrl) {
   throw new Error('Missing DATABASE_DIRECT_URL environment variable');
}

export default defineConfig({
   schema: './src/db/schema/index.ts',
   out: './src/db/migrations',
   dialect: 'postgresql',
   // This package's own migrations table (lesson 2): drizzle-kit applies only
   // migrations newer than the newest row, so packages can't share one.
   migrations: {
      table: '__drizzle_migrations_sandbox_notes',
   },
   dbCredentials: {
      url: directUrl,
   },
});
```

   and add to the notes `package.json` the scripts `"db:generate": "drizzle-kit generate"` and `"db:migrate": "drizzle-kit migrate"`, `dependencies` `@sidekick/core`, `@sidekick/synergy` (`workspace:*`) and `drizzle-orm` (`^0.45.4`), and `devDependencies` `@types/node` (`^24.19.2`) and `drizzle-kit` (`^0.31.11`). Run `pnpm install`. (The finished `package.json` is shown in step 9a.)

2. The schema. `packages/features/_sandbox/notes/src/db/schema/notes.ts`:

```ts
import { sql } from 'drizzle-orm';
import { jsonb, pgPolicy, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps, tombstone } from '@sidekick/core/db/columns';
import { profiles } from '@sidekick/core/db/schema';

/**
 * One row per sandbox note. Its id is its entity's id in Synergy's
 * entity_index, enforced by a deferrable foreign key (migration 0001).
 *
 * Delete model: soft delete, tombstones hidden. A deleted note is invisible to
 * every query and frozen; nothing restores it.
 */
export const sandboxNotes = pgTable(
   'sandbox_notes',
   {
      // Client-generated, and the same id as the note's entity_index row.
      id: uuid('id').primaryKey(),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      title: text('title').notNull(),
      // A Tiptap document as JSON. The save route validates its shape.
      body: jsonb('body').notNull(),
      ...timestamps,
      ...tombstone,
   },
   (self) => [
      // Own live rows: USING hides tombstones as well as other users' rows.
      // WITH CHECK leaves deleted_at out, so an update may set it (the soft
      // delete). nullif: a pooled connection reads the setting back as '',
      // and ''::uuid would throw.
      pgPolicy('sandbox_notes_own_live_rows', {
         for: 'all',
         using: sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid AND ${self.deletedAt} IS NULL`,
         withCheck: sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid`,
      }),
   ],
);
```

   and `packages/features/_sandbox/notes/src/db/schema/index.ts`:

```ts
/**
 * The notes sandbox's Drizzle tables. drizzle-kit reads this file to generate
 * migrations, so every table must be exported from here.
 */
export * from './notes';
```

3. Generate the first migration:

```bash
pnpm db:generate --filter=@sidekick/sandbox-notes -- --name=sandbox_notes
```

   `src/db/migrations/0000_sandbox_notes.sql` must read:

```sql
CREATE TABLE "sandbox_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sandbox_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sandbox_notes" ADD CONSTRAINT "sandbox_notes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sandbox_notes_own_live_rows" ON "sandbox_notes" AS PERMISSIVE FOR ALL TO public USING ("sandbox_notes"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid AND "sandbox_notes"."deleted_at" IS NULL) WITH CHECK ("sandbox_notes"."user_id" = nullif(current_setting('app.current_user_id', true), '')::uuid);
```

4. Create the hand-written migration:

```bash
pnpm db:generate --filter=@sidekick/sandbox-notes -- --custom --name=force_rls_soft_delete_and_entity_fk
```

   and fill `src/db/migrations/0001_force_rls_soft_delete_and_entity_fk.sql` (remove drizzle-kit's placeholder comment):

```sql
-- FORCE: the policy binds the table owner too, so RLS holds even if app_runtime
-- ever owned this table. Roles with BYPASSRLS (postgres) still bypass it.
ALTER TABLE sandbox_notes FORCE ROW LEVEL SECURITY;

-- Soft delete only: a DELETE is refused unless its transaction opts in with
-- SET LOCAL app.allow_hard_delete = 'true' (erasure). Core's shared function.
CREATE TRIGGER no_hard_delete_sandbox_notes
   BEFORE DELETE ON sandbox_notes
   FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

-- Tombstones hidden: a deleted note is frozen, and nothing restores it.
-- Core's shared function, which refuses every update to a deleted row.
CREATE TRIGGER no_update_deleted_sandbox_notes
   BEFORE UPDATE ON sandbox_notes
   FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();

-- A note can't exist without its entity_index row. DEFERRABLE INITIALLY
-- DEFERRED: Postgres checks it at commit, not per statement, so the create
-- route may insert the note before registerEntity inserts its index row, as
-- long as both happen in the same transaction.
ALTER TABLE sandbox_notes
   ADD CONSTRAINT sandbox_notes_id_entity_index_id_fk
   FOREIGN KEY (id) REFERENCES entity_index (id)
   DEFERRABLE INITIALLY DEFERRED;
```

Check:

```bash
pnpm test:integration
```

It builds the database from every package's migrations (core, Synergy, then notes) and stays green. The `.sql`, `meta/*_snapshot.json` and `meta/_journal.json` move together; never rename one without the others.

**What:** the provider's own table, holding what a note *is* (title and body), keyed by the same id as its `entity_index` row.

**How:**

1. **`sandbox_notes`, not `notes`:** every package shares one `public` schema, so a plain name would collide with a real notes feature later.
2. **Tombstones hidden** (D264's default): the policy's `USING` adds `deleted_at IS NULL`, and `WITH CHECK` leaves it out so an update may set it. FORCE and core's two triggers come from the hand-written migration, because Drizzle can't declare them.
3. **The deferred key:** Postgres checks it at commit, not per statement, so a note can be written before `registerEntity` inside one transaction, but never committed without its index row. The snapshot doesn't know the key, so a later `db:generate` won't drop it.
4. **`body` is untyped `jsonb`:** the save route validates the Tiptap shape with zod.

Each table writing out its own ownership check, instead of calling one central function, is recorded as **D267** (deferred; backlog B14).

Commit: `feat(sandbox): add the sandbox_notes table`.

### 3d — The tasks table

The same recipe under `packages/features/_sandbox/tasks/`: copy notes' `tsconfig.json` and `drizzle.config.ts` (migrations table `__drizzle_migrations_sandbox_tasks`), add the same scripts and dependencies, then:

`src/db/schema/tasks.ts`:

```ts
import { sql } from 'drizzle-orm';
import { boolean, pgPolicy, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps, tombstone } from '@sidekick/core/db/columns';
import { profiles } from '@sidekick/core/db/schema';

/**
 * One row per sandbox task. Its id is its entity's id in Synergy's
 * entity_index, enforced by a deferrable foreign key (migration 0001).
 *
 * Delete model: soft delete, tombstones hidden. A deleted task is invisible to
 * every query and frozen; nothing restores it.
 */
export const sandboxTasks = pgTable(
   'sandbox_tasks',
   {
      // Client-generated, and the same id as the task's entity_index row.
      id: uuid('id').primaryKey(),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      title: text('title').notNull(),
      done: boolean('done').notNull().default(false),
      ...timestamps,
      ...tombstone,
   },
   (self) => [
      // Own live rows: USING hides tombstones as well as other users' rows.
      // WITH CHECK leaves deleted_at out, so an update may set it (the soft
      // delete). nullif: a pooled connection reads the setting back as '',
      // and ''::uuid would throw.
      pgPolicy('sandbox_tasks_own_live_rows', {
         for: 'all',
         using: sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid AND ${self.deletedAt} IS NULL`,
         withCheck: sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid`,
      }),
   ],
);
```

`src/db/schema/index.ts`:

```ts
/**
 * The tasks sandbox's Drizzle tables. drizzle-kit reads this file to generate
 * migrations, so every table must be exported from here.
 */
export * from './tasks';
```

```bash
pnpm db:generate --filter=@sidekick/sandbox-tasks -- --name=sandbox_tasks
```

```bash
pnpm db:generate --filter=@sidekick/sandbox-tasks -- --custom --name=force_rls_soft_delete_and_entity_fk
```

`0001_force_rls_soft_delete_and_entity_fk.sql`:

```sql
-- FORCE: the policy binds the table owner too, so RLS holds even if app_runtime
-- ever owned this table. Roles with BYPASSRLS (postgres) still bypass it.
ALTER TABLE sandbox_tasks FORCE ROW LEVEL SECURITY;

-- Soft delete only: a DELETE is refused unless its transaction opts in with
-- SET LOCAL app.allow_hard_delete = 'true' (erasure). Core's shared function.
CREATE TRIGGER no_hard_delete_sandbox_tasks
   BEFORE DELETE ON sandbox_tasks
   FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

-- Tombstones hidden: a deleted task is frozen, and nothing restores it.
-- Core's shared function, which refuses every update to a deleted row.
CREATE TRIGGER no_update_deleted_sandbox_tasks
   BEFORE UPDATE ON sandbox_tasks
   FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();

-- A task can't exist without its entity_index row. DEFERRABLE INITIALLY
-- DEFERRED: Postgres checks it at commit, not per statement, so the create
-- route may insert the task before registerEntity inserts its index row, as
-- long as both happen in the same transaction.
ALTER TABLE sandbox_tasks
   ADD CONSTRAINT sandbox_tasks_id_entity_index_id_fk
   FOREIGN KEY (id) REFERENCES entity_index (id)
   DEFERRABLE INITIALLY DEFERRED;
```

Check: `pnpm test:integration` stays green.

Commit: `feat(sandbox): add the sandbox_tasks table`.

## Step 4 — Synergy's entry points

In `packages/platform/synergy/package.json`, replace `exports` and add `server-only` to `dependencies`:

```json
   "exports": {
      "./server": "./src/server.ts",
      "./contracts": "./src/contracts/index.ts",
      "./react": "./src/react.ts"
   },
```

```json
      "server-only": "^0.0.1",
```

Delete `packages/platform/synergy/src/index.ts`. Create `src/react.ts`:

```ts
/**
 * Synergy's React entry point: the Sneak Peek Link and the renderers'
 * contract arrive in Phase 3b. Empty until then (D199).
 */
export {};
```

Create `src/server.ts` with its first exports (steps 5 and 6 add the rest; the finished file is in step 6b):

```ts
import 'server-only';

/**
 * Synergy's server entry point: the repository providers call inside their
 * withRLS transaction. server-only makes a browser bundle that imports it
 * fail to build (D199).
 */
export {
   getEntity,
   registerEntity,
   saveEntityContent,
   type Actor,
   type EntityIndexRow,
   type GetEntityOptions,
   type RegisterEntityPayload,
   type SaveEntityContentPayload,
} from './repository/entities';
export { SynergyError } from './repository/errors';
```

Step 5b creates `src/contracts/errors.ts` and `src/contracts/index.ts`; run `pnpm install` once they exist.

**What:** Synergy's public surface (D199): `/server` for database code behind `server-only`, `/contracts` for what server and browser share, and an empty `/react` reserved for 3b. Package `exports` are the only doors, so `repository/` stays private.

Commit: `feat(synergy): add the server, contracts and react entry points`.

## Step 5 — Errors, validation and the notes routes

### 5a — `HTTP_STATUS`

Create `packages/foundation/core/src/http/status.ts`:

```ts
// Its own entry point, with no imports: browser code (Synergy's /contracts,
// later the UI) can use it without pulling in server-only modules.

/** The HTTP statuses Sidekick's API answers with, by their standard names */
export const HTTP_STATUS = Object.freeze({
   OK: 200,
   CREATED: 201,
   NOT_MODIFIED: 304,
   BAD_REQUEST: 400,
   UNAUTHORIZED: 401,
   FORBIDDEN: 403,
   NOT_FOUND: 404,
   CONFLICT: 409,
   UNPROCESSABLE_CONTENT: 422,
   INTERNAL_SERVER_ERROR: 500,
});

/** One of the statuses in HTTP_STATUS */
export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
```

In `packages/foundation/core/package.json` `exports`, after `"./db/schema"`:

```json
      "./http": "./src/http/status.ts"
```

In `guard.ts`, import it (`import { HTTP_STATUS } from '../http/status';`) and name the guard's statuses:

```ts
const GUARD_ERRORS = {
   UNAUTHENTICATED: { status: HTTP_STATUS.UNAUTHORIZED, error: 'Unauthorized' },
   SCOPE_MISSING: { status: HTTP_STATUS.FORBIDDEN, error: 'Forbidden' },
   FEATURE_DISABLED: {
      status: HTTP_STATUS.FORBIDDEN,
      error: 'Feature disabled',
   },
   INTERNAL: {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error: 'Internal error',
   },
} as const;
```

**What:** statuses read as words everywhere, and `HttpStatus` narrows a status to the ones in the table. It's its own entry point with no imports, so browser-safe code (Synergy's `/contracts`) can use it without pulling in the guard's `server-only`.

### 5b — The error map

Create `packages/foundation/core/src/api/error-response.ts`:

```ts
import type { HttpStatus } from '../http/status';

/** The body of every API error response: a stable code, never words (D201) */
export interface ApiErrorBody<Code extends string = string> {
   /** Which error happened; the client looks up the words */
   code: Code;
}

/** Builds an error response whose whole body is the error's code */
export function errorResponse(code: string, status: HttpStatus): Response {
   const body: ApiErrorBody = { code };
   return Response.json(body, { status });
}
```

Create `packages/platform/synergy/src/contracts/errors.ts`:

```ts
import { HTTP_STATUS, type HttpStatus } from '@sidekick/core/http';

/**
 * Every error Synergy can answer with, by name. Keys only (D201): the client
 * looks up the words, and SYNERGY_ERROR_STATUS gives each one its HTTP status.
 */
export const SYNERGY_ERROR_CODE = Object.freeze({
   NOT_FOUND: 'not_found',
   STALE_CONTENT: 'stale_content',
});

/** One of Synergy's error codes */
export type SynergyErrorCode =
   (typeof SYNERGY_ERROR_CODE)[keyof typeof SYNERGY_ERROR_CODE];

/**
 * The HTTP status each code answers with (Synergy overview, API). Typed as a
 * Record, so a new code without a status fails the typecheck.
 */
export const SYNERGY_ERROR_STATUS: Readonly<
   Record<SynergyErrorCode, HttpStatus>
> = {
   [SYNERGY_ERROR_CODE.NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
   [SYNERGY_ERROR_CODE.STALE_CONTENT]: HTTP_STATUS.CONFLICT,
};
```

Create `packages/platform/synergy/src/contracts/index.ts` (step 6a adds the entity exports):

```ts
/**
 * Synergy's contracts: what the server and the browser share. No database
 * code, so either side may import it (D199).
 */
export {
   SYNERGY_ERROR_CODE,
   SYNERGY_ERROR_STATUS,
   type SynergyErrorCode,
} from './errors';
```

Replace `packages/platform/synergy/src/repository/errors.ts`:

```ts
import type { SynergyErrorCode } from '../contracts/errors';

/** An expected failure of a Synergy operation, identified by its code */
export class SynergyError extends Error {
   constructor(readonly code: SynergyErrorCode) {
      super(code);
      this.name = 'SynergyError';
   }
}
```

In `src/repository/entities.ts`, import `SYNERGY_ERROR_CODE` from `'../contracts/errors'` and throw with it:

```ts
         throw new SynergyError(
            live
               ? SYNERGY_ERROR_CODE.STALE_CONTENT
               : SYNERGY_ERROR_CODE.NOT_FOUND,
         );
```

Create `packages/platform/synergy/src/api/error-response.ts`:

```ts
import { errorResponse } from '@sidekick/core/api';

import { SYNERGY_ERROR_STATUS } from '../contracts';
import { SynergyError } from '../repository/errors';

/**
 * Turns a SynergyError into its HTTP response, with the status from the error
 * map. Anything else is rethrown, so withApiGuard rolls the transaction back
 * and answers 500.
 */
export function synergyErrorResponse(error: unknown): Response {
   if (!(error instanceof SynergyError)) {
      throw error;
   }

   return errorResponse(error.code, SYNERGY_ERROR_STATUS[error.code]);
}
```

and its test, `src/api/error-response.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { SYNERGY_ERROR_CODE, type SynergyErrorCode } from '../contracts/errors';
import { SynergyError } from '../repository/errors';
import { synergyErrorResponse } from './error-response';

const CASES: [SynergyErrorCode, number][] = [
   [SYNERGY_ERROR_CODE.NOT_FOUND, 404],
   [SYNERGY_ERROR_CODE.STALE_CONTENT, 409],
];

describe('synergyErrorResponse', () => {
   it.each(CASES)(
      'answers %s with %i and a code-only body',
      async (code, status) => {
         const response = synergyErrorResponse(new SynergyError(code));

         expect(response.status).toBe(status);
         expect(await response.json()).toEqual({ code });
      },
   );

   it('rethrows anything that is not a SynergyError', () => {
      const error = new Error('database is down');

      expect(() => synergyErrorResponse(error)).toThrow(error);
   });
});
```

Export it from `src/server.ts`:

```ts
export { synergyErrorResponse } from './api/error-response';
```

and `export { errorResponse, type ApiErrorBody } from './error-response';` from core's `src/api/index.ts`. Add `zod` (`^4.6.7`) to Synergy's dependencies (step 6 uses it) and run `pnpm install`.

Check:

```bash
pnpm turbo typecheck lint test --filter=@sidekick/core --filter=@sidekick/synergy --force
```

Synergy's unit tests: `Tests  3 passed (3)`.

**What:** core owns the shape of every error, `{ code }`; Synergy owns what its codes mean and their statuses. `SYNERGY_ERROR_CODE` is the inventory of what Synergy can fail with, and the `Record` type makes a new code without a status fail the typecheck.

### 5c — Request validation

Add zod to core:

```bash
pnpm --filter @sidekick/core add zod@^4.6.7
```

Create `packages/foundation/core/src/api/validation.ts`:

```ts
import { z } from 'zod';

import { HTTP_STATUS } from '../http/status';
import type { ApiErrorBody } from './error-response';

// Every zod issue's message is a catalog key, never a sentence (D252). Set
// once for the process: it holds keys, not words, so it's the same for every
// request and locale.
z.config({
   customError: (issue) => `common.validation.${issue.code}`,
});

/** A word the client looks up: a catalog key and the values its message needs (D250) */
export interface ValidationMessage {
   /** The catalog key */
   key: string;
   /** Values the message reads, such as `minimum` */
   values?: Record<string, unknown>;
}

/** One problem with a request's input, at its path */
export interface ValidationIssue {
   /** Where in the input the problem is, such as `['title']` */
   path: (string | number)[];
   /** What the problem is, as a key the client looks up */
   message: ValidationMessage;
}

/** The body of a 400 for invalid input: one code, one issue per problem */
export interface ValidationFailedBody extends ApiErrorBody<'validation_failed'> {
   /** Every problem zod found */
   issues: ValidationIssue[];
}

// Issue fields that aren't message values: the key already says the code, and
// `input` would echo what the user sent back to them.
const NON_VALUE_KEYS = new Set(['code', 'path', 'message', 'input']);

function toValidationMessage(issue: z.core.$ZodIssue): ValidationMessage {
   return {
      key: issue.message,
      // strip out known key/value pairs from ZodIssue object to return only real values
      values: Object.fromEntries(
         Object.entries(issue).filter(([key]) => !NON_VALUE_KEYS.has(key)),
      ),
   };
}

function toPath(issue: z.core.$ZodIssue) {
   return issue.path.map((segment) =>
      typeof segment === 'number' ? segment : String(segment),
   );
}

function toValidationFailedBody(error: z.ZodError): ValidationFailedBody {
   const issues: ValidationIssue[] = error.issues.map((anIssue) => {
      return {
         path: toPath(anIssue),
         message: toValidationMessage(anIssue),
      };
   });
   return {
      code: 'validation_failed',
      issues,
   };
}

/** Answers 400 with Sidekick's own shape for zod's issues, never zod's own format */
function validationFailedResponse(error: z.ZodError): Response {
   return Response.json(toValidationFailedBody(error), {
      status: HTTP_STATUS.BAD_REQUEST,
   });
}

/** A request body that passed its schema: the typed data */
export interface ValidBody<Data> {
   ok: true;
   /** The parsed, typed body */
   data: Data;
}

/** A request body that failed its schema: the 400 to send back */
export interface InvalidBody {
   ok: false;
   /** The validation_failed response, ready to return */
   response: Response;
}

/** The outcome of reading a request body: the valid data, or the 400 to send back */
export type ParsedBody<Data> = ValidBody<Data> | InvalidBody;

/**
 * Parses a request's JSON body against a schema. A body that isn't JSON
 * fails validation like any other bad input, instead of throwing.
 */
export async function parseRequestBody<Schema extends z.ZodType>(
   req: Request,
   schema: Schema,
): Promise<ParsedBody<z.output<Schema>>> {
   const json: unknown = await req.json().catch(() => undefined);
   const result = schema.safeParse(json);

   return result.success
      ? { ok: true, data: result.data }
      : { ok: false, response: validationFailedResponse(result.error) };
}
```

`src/api/validation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseRequestBody } from './validation';

const schema = z.object({ title: z.string().min(1) });

function jsonRequest(body: string): Request {
   return new Request('http://localhost/api/test', { method: 'POST', body });
}

describe('parseRequestBody', () => {
   it('returns the parsed data for a valid body', async () => {
      const parsed = await parseRequestBody(
         jsonRequest('{"title":"Hello"}'),
         schema,
      );

      expect(parsed).toEqual({ ok: true, data: { title: 'Hello' } });
   });

   it('answers 400 with one keyed issue per problem', async () => {
      const parsed = await parseRequestBody(
         jsonRequest('{"title":""}'),
         schema,
      );
      if (parsed.ok) throw new Error('expected a validation failure');

      expect(parsed.response.status).toBe(400);
      const body = await parsed.response.json();
      expect(body).toEqual({
         code: 'validation_failed',
         issues: [
            {
               path: ['title'],
               message: {
                  key: 'common.validation.too_small',
                  values: expect.objectContaining({ minimum: 1 }),
               },
            },
         ],
      });
      // Never echoes what the user sent
      expect(body.issues[0].message.values).not.toHaveProperty('input');
   });

   it('answers 400, instead of throwing, when the body is not JSON', async () => {
      const parsed = await parseRequestBody(jsonRequest('not json'), schema);
      if (parsed.ok) throw new Error('expected a validation failure');

      expect(parsed.response.status).toBe(400);
   });
});
```

and add to core's `src/api/index.ts`:

```ts
export {
   parseRequestBody,
   type ValidBody,
   type InvalidBody,
   type ParsedBody,
   type ValidationFailedBody,
   type ValidationIssue,
   type ValidationMessage,
} from './validation';
```

Check:

```bash
pnpm turbo typecheck lint test build --filter=@sidekick/core --force
```

Core's unit tests: `Tests  31 passed (31)`. Run `build` too: an editor's unused `import { InvalidBody, ValidBody } from './validation'` passes typecheck and lint but fails `build` under `verbatimModuleSyntax`.

**What:** every route validates input the same way and answers bad input in D252's shape: one `validation_failed` code with one issue per problem, each message a catalog key (`common.validation.*`), never the user's input echoed back.

**How:** a handler writes

```ts
const parsed = await parseRequestBody(req, schema);
if (!parsed.ok) return parsed.response;
```

`validationFailedResponse` stays private, so handlers never see zod's error type, and a body that isn't JSON is a 400, not a 500.

### 5d — An error response rolls back (D268)

In `guard.ts`, add above `authorizeAndHandle`:

```ts
/**
 * Carries a handler's error response out of withRLS's transaction. Throwing it
 * rolls the transaction back; the guard then returns the response (D268).
 */
class ErrorResponseRollback extends Error {
   constructor(readonly response: Response) {
      super('Rolled back for an error response');
      this.name = 'ErrorResponseRollback';
   }
}
```

and replace the `return withRLS(...)` from step 1b with:

```ts
   try {
      return await withRLS(
         caller.userId,
         async (tx) => {
            if (
               opts.feature &&
               !(await getEnabledFeatures(tx)).includes(opts.feature)
            ) {
               return { code: 'FEATURE_DISABLED', feature: opts.feature };
            }

            const response = await handler({ tx, caller, req, ctx });

            // An error response undoes everything the handler wrote (D268),
            // whatever order it wrote in
            if (response.status >= HTTP_STATUS.BAD_REQUEST) {
               throw new ErrorResponseRollback(response);
            }

            return response;
         },
         {
            lockUser: opts.lockUser,
         },
      );
   } catch (error) {
      if (error instanceof ErrorResponseRollback) {
         return error.response;
      }
      throw error;
   }
```

In `packages/foundation/core/tests/integration/guard.test.ts`, replace the test "keeps the handler's write when it returns an error response instead of throwing" with:

```ts
   it('rolls back the handler’s write when it returns an error response (D268)', async () => {
      mockSignedInAs(otherUserId);
      const guarded = withApiGuard(async ({ tx, caller }) => {
         await tx
            .update(profiles)
            .set({ email: 'changed@example.com' })
            .where(eq(profiles.id, caller.userId));
         return Response.json({ code: 'stale_content' }, { status: 409 });
      });

      const response = await guarded(createMockHttpRequest(), undefined);
      // The handler's response reaches the client unchanged...
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ code: 'stale_content' });
      // ...and its write is gone
      expect(await getProfileEmail(otherUserId)).toBe('other@example.com');
   });
```

Check:

```bash
pnpm test:integration
```

Core: `Tests  20 passed (20)`. With the old `return withRLS(...)` the new test fails ("expected 'changed@example.com' to be 'other@example.com'").

**What:** a response either fully succeeded or changed nothing. Before, only a throw rolled back, so a handler that wrote and then returned a 409 kept its write.

**How:**

1. The guard throws `ErrorResponseRollback` *inside* the transaction callback, so Drizzle rolls back and `withRLS` rejects.
2. The `catch` wraps the `await withRLS(...)` call, so it runs after the rollback and returns the handler's response unchanged.
3. Anything else is rethrown, logged and answered 500. The order of a handler's writes no longer matters for correctness; "validate before you write" is retired. A write that must survive an error is backlog B16.

### 5e — The notes contract

In the notes `package.json`, add `"./contracts": "./src/contracts.ts"` to `exports`, then `pnpm --filter @sidekick/sandbox-notes add zod@^4.6.7`. Create `packages/features/_sandbox/notes/src/contracts.ts`:

```ts
import { z } from 'zod';

// What the notes sandbox's API accepts and returns. Shared by its routes and,
// later, its UI; no database code.

/**
 * A note's body: a Tiptap document as JSON. Only the outer shape is checked,
 * a `doc` node holding a list of nodes; the editor owns everything inside.
 */
export const noteBodySchema = z.looseObject({
   type: z.literal('doc'),
   content: z.array(z.looseObject({ type: z.string() })).optional(),
});

/** A note's body: a Tiptap document as JSON */
export interface NoteBody extends z.infer<typeof noteBodySchema> {}

/** What `POST /api/sandbox/notes` accepts */
export const createNoteRequestSchema = z.object({
   // Client-generated, so the editor knows the id before the first save
   id: z.uuid(),
   title: z.string().trim().min(1).max(200),
   body: noteBodySchema,
});

/** What `POST /api/sandbox/notes` accepts */
export interface CreateNoteRequest extends z.infer<
   typeof createNoteRequestSchema
> {}

/** A note as the API returns it */
export const noteSchema = z.object({
   // The note's id, which is also its entity's id
   id: z.uuid(),
   title: z.string(),
   body: noteBodySchema,
   // The entity's content_seq: the baseline the next save sends
   contentSeq: z.int(),
   createdAt: z.iso.datetime(),
   updatedAt: z.iso.datetime(),
});

/** A note as the API returns it */
export interface Note extends z.infer<typeof noteSchema> {}

/** What `PUT /api/sandbox/notes/:id` accepts */
export const saveNoteRequestSchema = z.object({
   title: z.string().trim().min(1).max(200),
   body: noteBodySchema,
   // The contentSeq the editor started from: a save based on anything older
   // is stale and answers 409
   baselineContentSeq: z.int().nonnegative(),
   // The author flags a version; every other save is a revision
   bump: z.enum(['version', 'revision']).default('revision'),
   // An optional note logged with a version bump
   changeNote: z.string().trim().max(500).optional(),
});

/** What `PUT /api/sandbox/notes/:id` accepts */
export interface SaveNoteRequest extends z.infer<
   typeof saveNoteRequestSchema
> {}
```

**What:** the notes API's promise in one file both sides import. Each response type is inferred from its schema, so a client can parse a response instead of trusting it.

**How:** `looseObject` keeps Tiptap's attributes and marks instead of stripping them; titles are trimmed before `min(1)`; `contentSeq` is the baseline the next save sends; dates are ISO 8601 strings, because JSON has no date type.

### 5f — The notes handlers

Create `packages/platform/synergy/src/api/actor.ts`:

```ts
import type { ApiCaller } from '@sidekick/core/api';

import type { Actor } from '../repository/entities';

/**
 * Who Synergy records as the writer of a request: the signed-in human, or the
 * API key the request used.
 */
export function identifyActor(caller: ApiCaller): Actor {
   if (caller.kind === 'session') {
      return { kind: 'human', id: caller.userId };
   }

   return { kind: 'api_key', id: caller.keyId };
}
```

and export it from Synergy's `src/server.ts`: `export { identifyActor } from './api/actor';`.

In the notes `package.json`, add `"./server": "./src/server.ts"` to `exports` and `"server-only": "^0.0.1"` to `dependencies`, then `pnpm install`. Create `packages/features/_sandbox/notes/src/server.ts`:

```ts
import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
   errorResponse,
   parseRequestBody,
   type ApiHandler,
} from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';
import { SYNERGY_ERROR_CODE } from '@sidekick/synergy/contracts';
import {
   identifyActor,
   registerEntity,
   saveEntityContent,
   synergyErrorResponse,
} from '@sidekick/synergy/server';

import {
   createNoteRequestSchema,
   saveNoteRequestSchema,
   type Note,
} from './contracts';
import { sandboxNotes } from './db/schema';
import { ENTITY_TYPE, FEATURE_KEY } from './index';

/**
 * `POST /api/sandbox/notes`: creates a note and registers its entity with
 * Synergy, in the guard's transaction. Answers 201 with the note.
 */
export const createNote: ApiHandler<unknown> = async function createNote({
   tx,
   caller,
   req,
}) {
   const parsed = await parseRequestBody(req, createNoteRequestSchema);
   if (!parsed.ok) {
      return parsed.response;
   }
   const { id, title, body } = parsed.data;

   // Order of operations, synergy's registerEntity or entity's own mutation,
   // doesn't matter for correctness: any error response or throw rolls
   // back both writes (D268).
   const entity = await registerEntity(tx, {
      id,
      provider: FEATURE_KEY,
      type: ENTITY_TYPE.NOTE,
      displayName: title,
      title,
      actor: identifyActor(caller),
   });

   const [timestamps] = await tx
      .insert(sandboxNotes)
      .values({
         id,
         userId: caller.userId,
         title,
         body,
      })
      .returning({
         createdAt: sandboxNotes.createdAt,
         updatedAt: sandboxNotes.updatedAt,
      });

   const note: Note = {
      id,
      title,
      body,
      contentSeq: entity.contentSeq,
      createdAt: timestamps.createdAt.toISOString(),
      updatedAt: timestamps.updatedAt.toISOString(),
   };

   return Response.json(note, { status: HTTP_STATUS.CREATED });
};

/** Next.js's second route-handler argument for `/api/sandbox/notes/[id]` */
export interface NoteRouteContext {
   /** The route's dynamic segments */
   params: Promise<{ id: string }>;
}

/**
 * `PUT /api/sandbox/notes/:id`: saves a note's title and body and bumps its
 * entity in Synergy. Answers 200 with the note, 404 when there's no such note
 * for the caller, or 409 `stale_content` when someone saved since the
 * editor's baseline.
 */
export const saveNote: ApiHandler<NoteRouteContext> = async function saveNote({
   tx,
   ctx,
   req,
   caller,
}) {
   // An id that isn't a uuid can't name a note: not found, never a 500
   const { id } = await ctx.params;

   if (z.uuid().safeParse(id).error) {
      return errorResponse(SYNERGY_ERROR_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const parsed = await parseRequestBody(req, saveNoteRequestSchema);
   if (!parsed.ok) {
      return parsed.response;
   }

   const { title, body, baselineContentSeq, bump, changeNote } = parsed.data;

   let updatedContentSeq: number;
   try {
      const entity = await saveEntityContent(tx, {
         id,
         baselineContentSeq,
         bump,
         changeNote,
         displayName: title,
         title,
         actor: identifyActor(caller),
      });

      updatedContentSeq = entity.contentSeq;
   } catch (error) {
      return synergyErrorResponse(error);
   }

   const [timestamps] = await tx
      .update(sandboxNotes)
      .set({
         title,
         body,
         updatedAt: sql`now()`,
      })
      .where(eq(sandboxNotes.id, id))
      .returning({
         createdAt: sandboxNotes.createdAt,
         updatedAt: sandboxNotes.updatedAt,
      });

   // The entity is live but the note isn't: answer not found, and the
   // rollback (D268) undoes the entity's bump
   if (!timestamps) {
      return errorResponse(SYNERGY_ERROR_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return Response.json(
      {
         id,
         title,
         body,
         contentSeq: updatedContentSeq,
         createdAt: timestamps.createdAt.toISOString(),
         updatedAt: timestamps.updatedAt.toISOString(),
      } satisfies Note,
      { status: HTTP_STATUS.OK },
   );
};
```

Check:

```bash
pnpm turbo typecheck lint --filter=@sidekick/sandbox-notes --filter=@sidekick/synergy --force
```

**What:** one request creates the note and its entity together, or neither; a save succeeds only from the current baseline.

**How**, for a save:

1. The id comes from `ctx.params`; a non-uuid is 404, not a Postgres error.
2. The body is validated (400).
3. `saveEntityContent` bumps the entity only if `content_seq` still equals the baseline; otherwise `stale_content` (409), or `not_found` (404) for another user's or a deleted entity.
4. The note row is updated; if it's missing, 404, and D268 undoes the bump.
5. 200 with the new `contentSeq`.

`identifyActor` lives in Synergy because `Actor` is Synergy's concept. Creating with an id that already exists answers 500 until idempotency keys (lesson 6).

### 5g — The notes routes, and keeping the UI off the data layer

```bash
pnpm --filter @sidekick/app add '@sidekick/sandbox-notes@workspace:*'
```

(The quotes stop zsh from treating `*` as a filename pattern.)

`apps/app/src/app/api/sandbox/notes/route.ts`:

```ts
import { withApiGuard } from '@sidekick/core/api';
import { FEATURE_KEY } from '@sidekick/sandbox-notes';
import { createNote } from '@sidekick/sandbox-notes/server';

/** Creates a note and its Synergy entity (see createNote) */
export const POST = withApiGuard(createNote, {
   feature: FEATURE_KEY,
   lockUser: true,
});
```

`apps/app/src/app/api/sandbox/notes/[id]/route.ts`:

```ts
import { withApiGuard } from '@sidekick/core/api';
import { FEATURE_KEY } from '@sidekick/sandbox-notes';
import { saveNote } from '@sidekick/sandbox-notes/server';

/** Saves a note, refusing a stale save with 409 (see saveNote) */
export const PUT = withApiGuard(saveNote, {
   feature: FEATURE_KEY,
   lockUser: true,
});
```

Then the D269 lint rule. In `eslint.config.js`, after `unsafeDbPatternBan`:

```js
// D269: the App's UI reaches data only through its own API, like any other
// client (D48). Only route handlers (src/app/api/**/route.ts) may import the
// database, the guard or a package's server entry point.
const uiDataMessage =
   'UI code reaches data only through the API (D48, D269). Call the route with fetch; only src/app/api/**/route.ts may import this.';

const uiDataPathBans = ['@sidekick/core/db', '@sidekick/core/api'].map(
   (name) => ({ name, message: uiDataMessage }),
);

const uiDataPatternBan = {
   group: ['@sidekick/core/db/*', '@sidekick/*/server'],
   message: uiDataMessage,
};
```

and, before the "Dependency hygiene" section:

```js
   {
      // D269: in the App, only route handlers touch data. Every other file
      // (pages, layouts, components) calls the API like any other client.
      // Every global ban still applies here.
      files: ['apps/app/src/**/*.{ts,tsx}'],
      ignores: ['apps/app/src/app/api/**/route.ts'],
      rules: {
         'no-restricted-imports': [
            'error',
            {
               paths: [...cssInJsBans, adminClientPathBan, ...uiDataPathBans],
               patterns: [
                  unsafeDbPatternBan,
                  adminClientPatternBan,
                  uiDataPatternBan,
               ],
            },
         ],
      },
   },
```

Check:

```bash
pnpm turbo build --filter=@sidekick/app --force
```

The route list includes `ƒ /api/sandbox/notes` and `ƒ /api/sandbox/notes/[id]`, and the endpoint check passes. Probe D269: a file `apps/app/src/app/probe-d269.ts` importing `withRLS` from `@sidekick/core/db` fails lint with "UI code reaches data only through the API (D48, D269)…"; delete it.

**What:** each route file is one line of wiring, and the UI can't sneak around the API. The API stays inside `apps/app` until Phase 9 (**D270**, backlog B17).

Commits: `refactor(core): name HTTP statuses with HTTP_STATUS constants`, `feat(synergy): map Synergy's error codes to HTTP responses`, `feat(core): validate request bodies with zod in the D252 shape`, `feat(core): roll back a handler's transaction on an error response (D268)`, `feat(sandbox): create notes through Synergy`, `feat(sandbox): save notes with a stale-content check`, `feat(app): mount the notes sandbox routes`, `chore(lint): keep the App's UI off the data layer (D269, D270)`.

## Step 6 — Synergy's read route

### 6a — The entity contract

Create `packages/platform/synergy/src/contracts/entity.ts`:

```ts
import { z } from 'zod';

/** The lifecycle states an entity can be in */
export const ENTITY_STATUSES = ['active', 'deprecated', 'superseded'] as const;

/** The lifecycle states an entity can be in. One of `ENTITY_STATUSES` values.*/
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

/**
 * An entity as Synergy's API returns it: its index fields, never its owner or
 * provenance. Timestamps are ISO 8601 strings.
 */
export const entitySchema = z.object({
   id: z.uuid(),
   // Keys, never labels (D201): 'sandbox-notes', 'note'
   provider: z.string(),
   type: z.string(),
   displayName: z.string(),
   title: z.string().optional(),
   status: z.enum(ENTITY_STATUSES),
   version: z.int(),
   revision: z.int(),
   // The stale-write token and the ETag
   contentSeq: z.int(),
   editedAt: z.iso.datetime(),
   createdAt: z.iso.datetime(),
   updatedAt: z.iso.datetime(),
});

/** An entity as Synergy's API returns it */
export interface Entity extends z.infer<typeof entitySchema> {}
```

In `src/db/schema/entity-index.ts`, delete `ENTITY_STATUSES` and import it instead:

```ts
import { ENTITY_STATUSES } from '../../contracts/entity';
```

Replace `src/contracts/index.ts`:

```ts
/**
 * Synergy's contracts: what the server and the browser share. No database
 * code, so either side may import it (D199).
 */
export {
   SYNERGY_ERROR_CODE,
   SYNERGY_ERROR_STATUS,
   type SynergyErrorCode,
} from './errors';
export {
   ENTITY_STATUSES,
   type EntityStatus,
   entitySchema,
   type Entity,
} from './entity';
```

Create the mapper, `src/api/entity.ts`:

```ts
import type { Entity } from '../contracts/entity';
import type { EntityIndexRow } from '../repository/entities';

/** Maps an entity_index row to the Entity the API returns */
export function toEntity(row: EntityIndexRow): Entity {
   return {
      id: row.id,
      provider: row.provider,
      type: row.type,
      displayName: row.displayName,
      title: row.title ?? undefined,
      status: row.status,
      version: row.version,
      revision: row.revision,
      contentSeq: row.contentSeq,
      editedAt: row.editedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
   };
}
```

Check: `pnpm db:generate --filter=@sidekick/synergy` reports no schema changes.

**What:** the shape a client gets for an entity, separate from the row: no owner, no provenance, ISO strings, `undefined` for a missing title.

### 6b — The route

Create `packages/platform/synergy/src/api/read-entity.ts`:

```ts
import { z } from 'zod';

import { errorResponse, type ApiHandler } from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';

import { SYNERGY_ERROR_CODE } from '../contracts/errors';
import { getEntity } from '../repository/entities';
import { toEntity } from './entity';

/** Next.js's second route-handler argument for `/api/synergy/entities/[id]` */
export interface EntityRouteContext {
   /** The route's dynamic segments */
   params: Promise<{ id: string }>;
}

/**
 * Whether an `If-None-Match` header names this ETag. The header may list
 * several ETags, mark them weak (`W/"4"`) or be `*`.
 */
export function matchesIfNoneMatch(
   ifNoneMatch: string | null,
   etag: string,
): boolean {
   if (!ifNoneMatch) {
      return false;
   }

   return ifNoneMatch
      .split(',')
      .map((tag) => tag.trim().replace(/^W\//, ''))
      .some((tag) => tag === '*' || tag === etag);
}

/**
 * `GET /api/synergy/entities/:id`: an entity's index fields with
 * `ETag: "<content_seq>"`, or 304 with no body when the caller's
 * `If-None-Match` already names it (D210). Another user's id, a deleted
 * entity and an id that never existed all answer 404 (D209).
 */
export const readEntity: ApiHandler<EntityRouteContext> =
   async function readEntity({ tx, req, ctx }) {
      const { id } = await ctx.params;
      if (z.uuid().safeParse(id).error) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      const row = await getEntity(tx, id, { includeDeleted: false });
      if (!row) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      const etag = `"${row.contentSeq}"`;
      // private: only the caller's browser may store it; no-cache: it must ask
      // (cheaply, with If-None-Match) before reusing it
      const headers = { 'ETag': etag, 'Cache-Control': 'private, no-cache' };

      if (matchesIfNoneMatch(req.headers.get('if-none-match'), etag)) {
         return new Response(null, {
            status: HTTP_STATUS.NOT_MODIFIED,
            headers,
         });
      }

      return Response.json(toEntity(row), { headers });
   };
```

`src/api/read-entity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { matchesIfNoneMatch } from './read-entity';

describe('matchesIfNoneMatch', () => {
   it.each([
      ['the same ETag', '"4"', true],
      ['a different ETag', '"3"', false],
      ['one of several ETags', '"2", "4"', true],
      ['a weak ETag', 'W/"4"', true],
      ['any ETag', '*', true],
   ])('matches %s: %s', (_, header, expected) => {
      expect(matchesIfNoneMatch(header, '"4"')).toBe(expected);
   });

   it('matches nothing without the header', () => {
      expect(matchesIfNoneMatch(null, '"4"')).toBe(false);
   });
});
```

The finished `src/server.ts`:

```ts
import 'server-only';

/**
 * Synergy's server entry point: the repository providers call inside their
 * withRLS transaction. server-only makes a browser bundle that imports it
 * fail to build (D199).
 */
export {
   getEntity,
   registerEntity,
   saveEntityContent,
   type Actor,
   type EntityIndexRow,
   type GetEntityOptions,
   type RegisterEntityPayload,
   type SaveEntityContentPayload,
} from './repository/entities';
export { synergyErrorResponse } from './api/error-response';
export { SynergyError } from './repository/errors';
export { identifyActor } from './api/actor';
export { toEntity } from './api/entity';
export { readEntity, type EntityRouteContext } from './api/read-entity';
```

Mount it:

```bash
pnpm --filter @sidekick/app add '@sidekick/synergy@workspace:*'
```

`apps/app/src/app/api/synergy/entities/[id]/route.ts`:

```ts
import { withApiGuard } from '@sidekick/core/api';
import { readEntity } from '@sidekick/synergy/server';

/** Reads an entity's index fields, with an ETag and 304 (see readEntity) */
export const GET = withApiGuard(readEntity);
```

Check:

```bash
pnpm turbo typecheck lint test build --force
```

Synergy's unit tests: `Tests  9 passed (9)`; the app lists `ƒ /api/synergy/entities/[id]`.

**What:** a page asks "has my entity changed?" for one indexed read and no body (D210).

**How:**

1. The first `GET` sends no `If-None-Match` and gets the entity with `ETag: "<content_seq>"`.
2. Later it sends `If-None-Match: "<that ETag>"`: unchanged is 304 with no body, changed is 200 with the new ETag.
3. `Cache-Control: private, no-cache`: only the user's browser may keep it, and it must ask before reusing it.
4. No feature gate and no lock: Synergy isn't a feature, and a read never waits.

The roll-up of outgoing references waits for links (lesson 6), and a status change not moving the ETag is lesson 5's to fix.

Commits: `feat(synergy): add the Entity contract and its mapper`, `feat(synergy): read an entity with an ETag and 304`.

## Step 7 — The tasks routes

The notes recipe with a `done` flag instead of a body. Add the `./contracts` and `./server` exports and the `server-only` and `zod` dependencies to the tasks `package.json`, then:

`packages/features/_sandbox/tasks/src/contracts.ts`:

```ts
import { z } from 'zod';

// What the tasks sandbox's API accepts and returns. Shared by its routes and,
// later, its UI; no database code.

/** What `POST /api/sandbox/tasks` accepts */
export const createTaskRequestSchema = z.object({
   // Client-generated, so the client knows the id before the first save
   id: z.uuid(),
   title: z.string().trim().min(1).max(200),
   done: z.boolean().default(false),
});

/** What `POST /api/sandbox/tasks` accepts */
export interface CreateTaskRequest extends z.infer<
   typeof createTaskRequestSchema
> {}

/** A task as the API returns it */
export const taskSchema = z.object({
   // The task's id, which is also its entity's id
   id: z.uuid(),
   title: z.string(),
   done: z.boolean(),
   // The entity's content_seq: the baseline the next save sends
   contentSeq: z.int(),
   createdAt: z.iso.datetime(),
   updatedAt: z.iso.datetime(),
});

/** A task as the API returns it */
export interface Task extends z.infer<typeof taskSchema> {}

/** What `PUT /api/sandbox/tasks/:id` accepts */
export const saveTaskRequestSchema = z.object({
   title: z.string().trim().min(1).max(200),
   done: z.boolean(),
   // The contentSeq the client started from: a save based on anything older
   // is stale and answers 409
   baselineContentSeq: z.int().nonnegative(),
   // The author flags a version; every other save is a revision
   bump: z.enum(['version', 'revision']).default('revision'),
   // An optional note logged with a version bump
   changeNote: z.string().trim().max(500).optional(),
});

/** What `PUT /api/sandbox/tasks/:id` accepts */
export interface SaveTaskRequest extends z.infer<
   typeof saveTaskRequestSchema
> {}
```

`packages/features/_sandbox/tasks/src/server.ts`:

```ts
import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
   errorResponse,
   parseRequestBody,
   type ApiHandler,
} from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';
import { SYNERGY_ERROR_CODE } from '@sidekick/synergy/contracts';
import {
   identifyActor,
   registerEntity,
   saveEntityContent,
   synergyErrorResponse,
} from '@sidekick/synergy/server';

import {
   createTaskRequestSchema,
   saveTaskRequestSchema,
   type Task,
} from './contracts';
import { sandboxTasks } from './db/schema';
import { ENTITY_TYPE, FEATURE_KEY } from './index';

/**
 * `POST /api/sandbox/tasks`: creates a task and registers its entity with
 * Synergy, in the guard's transaction. Answers 201 with the task.
 */
export const createTask: ApiHandler<unknown> = async function createTask({
   tx,
   req,
   caller,
}) {
   const parsed = await parseRequestBody(req, createTaskRequestSchema);
   if (!parsed.ok) {
      return parsed.response;
   }
   const { id, title, done } = parsed.data;

   // Order of operations, synergy's registerEntity or entity's own mutation,
   // doesn't matter for correctness: any error response or throw rolls
   // back both writes (D268).
   const entity = await registerEntity(tx, {
      id,
      provider: FEATURE_KEY,
      type: ENTITY_TYPE.TASK,
      displayName: title,
      title,
      actor: identifyActor(caller),
   });

   const [timestamps] = await tx
      .insert(sandboxTasks)
      .values({
         id,
         userId: caller.userId,
         title,
         done,
      })
      .returning({
         createdAt: sandboxTasks.createdAt,
         updatedAt: sandboxTasks.updatedAt,
      });

   const task: Task = {
      id,
      title,
      done,
      contentSeq: entity.contentSeq,
      createdAt: timestamps.createdAt.toISOString(),
      updatedAt: timestamps.updatedAt.toISOString(),
   };

   return Response.json(task, { status: HTTP_STATUS.CREATED });
};

/** Next.js's second route-handler argument for `/api/sandbox/tasks/[id]` */
export interface TaskRouteContext {
   /** The route's dynamic segments */
   params: Promise<{ id: string }>;
}

/**
 * `PUT /api/sandbox/tasks/:id`: saves a task's title and done flag and bumps its
 * entity in Synergy. Answers 200 with the task, 404 when there's no such task
 * for the caller, or 409 `stale_content` when someone saved since the
 * editor's baseline.
 */
export const saveTask: ApiHandler<TaskRouteContext> = async function saveTask({
   tx,
   ctx,
   req,
   caller,
}) {
   // An id that isn't a uuid can't name a task: not found, never a 500
   const { id } = await ctx.params;

   if (z.uuid().safeParse(id).error) {
      return errorResponse(SYNERGY_ERROR_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const parsed = await parseRequestBody(req, saveTaskRequestSchema);
   if (!parsed.ok) {
      return parsed.response;
   }

   const { title, done, baselineContentSeq, bump, changeNote } = parsed.data;

   let updatedContentSeq: number;
   try {
      const entity = await saveEntityContent(tx, {
         id,
         baselineContentSeq,
         bump,
         changeNote,
         displayName: title,
         title,
         actor: identifyActor(caller),
      });

      updatedContentSeq = entity.contentSeq;
   } catch (error) {
      return synergyErrorResponse(error);
   }

   const [timestamps] = await tx
      .update(sandboxTasks)
      .set({
         title,
         done,
         updatedAt: sql`now()`,
      })
      .where(eq(sandboxTasks.id, id))
      .returning({
         createdAt: sandboxTasks.createdAt,
         updatedAt: sandboxTasks.updatedAt,
      });

   // The entity is live but the task isn't: answer not found, and the
   // rollback (D268) undoes the entity's bump
   if (!timestamps) {
      return errorResponse(SYNERGY_ERROR_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return Response.json(
      {
         id,
         title,
         done,
         contentSeq: updatedContentSeq,
         createdAt: timestamps.createdAt.toISOString(),
         updatedAt: timestamps.updatedAt.toISOString(),
      } satisfies Task,
      { status: HTTP_STATUS.OK },
   );
};
```

```bash
pnpm --filter @sidekick/app add '@sidekick/sandbox-tasks@workspace:*'
```

`apps/app/src/app/api/sandbox/tasks/route.ts`:

```ts
import { withApiGuard } from '@sidekick/core/api';
import { FEATURE_KEY } from '@sidekick/sandbox-tasks';
import { createTask } from '@sidekick/sandbox-tasks/server';

/** Creates a task and its Synergy entity (see createTask) */
export const POST = withApiGuard(createTask, {
   feature: FEATURE_KEY,
   lockUser: true,
});
```

`apps/app/src/app/api/sandbox/tasks/[id]/route.ts`:

```ts
import { withApiGuard } from '@sidekick/core/api';
import { FEATURE_KEY } from '@sidekick/sandbox-tasks';
import { saveTask } from '@sidekick/sandbox-tasks/server';

/** Saves a task, refusing a stale save with 409 (see saveTask) */
export const PUT = withApiGuard(saveTask, {
   feature: FEATURE_KEY,
   lockUser: true,
});
```

Check: `pnpm turbo typecheck lint build --force`; the app lists both tasks routes. After mirroring, search the new files for "note": every hit must be gone. A copied `type: 'note'` type-checks and would register every task as a note; step 9's tests catch it.

Commits: `feat(sandbox): create and save tasks through Synergy`, `refactor(sandbox): name each provider's entity types with ENTITY_TYPE`.

## Step 8 — Try it by hand

1. Apply the sandbox migrations to dev:

```bash
pnpm db:migrate
```

2. Preview, then grant both features to the account you sign in with:

```bash
pnpm ops:entitlements:grant --email <your email> --feature sandbox-notes --feature sandbox-tasks
```

```bash
pnpm ops:entitlements:grant --email <your email> --feature sandbox-notes --feature sandbox-tasks --apply
```

3. In one terminal, `pnpm dev`, sign in at `http://localhost:3000/login`, and copy the `Cookie` request header from any request in DevTools → Network. In another:

```bash
export SK_COOKIE='<the cookie value>'
```

```bash
export NOTE_ID=$(uuidgen | tr 'A-Z' 'a-z')
```

4. Run each request and compare:

| Request | Expected |
| ------- | -------- |
| `curl -i -X POST http://localhost:3000/api/sandbox/notes -H "Cookie: $SK_COOKIE" -H 'Content-Type: application/json' -d "{\"id\":\"$NOTE_ID\",\"title\":\"First note\",\"body\":{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}}"` | `201`, the note with `"contentSeq":0` |
| `curl -i http://localhost:3000/api/synergy/entities/$NOTE_ID -H "Cookie: $SK_COOKIE"` | `200`, `ETag: "0"`, `"type":"note"` |
| the same with `-H 'If-None-Match: "0"'` | `304`, no body |
| `curl -i -X PUT http://localhost:3000/api/sandbox/notes/$NOTE_ID -H "Cookie: $SK_COOKIE" -H 'Content-Type: application/json' -d '{"title":"First note, edited","body":{"type":"doc","content":[]},"baselineContentSeq":0}'` | `200`, `"contentSeq":1` |
| the same `PUT` again (a stale baseline) | `409`, `{"code":"stale_content"}`, nothing written |
| the conditional `GET` with `If-None-Match: "0"` again | `200`, `ETag: "1"` |
| a `PUT` with `"title":""` | `400`, `validation_failed` with `path: ["title"]` |

A `403` with `FEATURE_DISABLED` on the first request means the grant went to a different account than the one you're signed in with: the dev log's `api.denied` line names the user id. Never paste the cookie into chat or a file.

## Step 9 — Prove it

### 9a — A test setup for notes

The finished notes `package.json` (adds `test:integration`, `@sidekick/test-utils` and `vitest`):

```json
{
   "name": "@sidekick/sandbox-notes",
   "version": "0.0.0",
   "private": true,
   "license": "MIT",
   "type": "module",
   "exports": {
      ".": "./src/index.ts",
      "./contracts": "./src/contracts.ts",
      "./server": "./src/server.ts"
   },
   "scripts": {
      "db:generate": "drizzle-kit generate",
      "db:migrate": "drizzle-kit migrate",
      "lint": "eslint .",
      "test:integration": "vitest run tests/integration",
      "typecheck": "tsc -p tsconfig.json --noEmit"
   },
   "dependencies": {
      "@sidekick/core": "workspace:*",
      "@sidekick/synergy": "workspace:*",
      "drizzle-orm": "^0.45.4",
      "server-only": "^0.0.1",
      "zod": "^4.6.7"
   },
   "devDependencies": {
      "@sidekick/test-utils": "workspace:*",
      "@types/node": "^24.19.2",
      "drizzle-kit": "^0.31.11",
      "vitest": "^5.1.0"
   }
}
```

Copy Synergy's plumbing:

```bash
mkdir -p packages/features/_sandbox/notes/tests/stubs packages/features/_sandbox/notes/tests/integration
```

```bash
cp packages/platform/synergy/vitest.config.ts packages/features/_sandbox/notes/
```

```bash
cp packages/platform/synergy/tests/stubs/server-only.ts packages/features/_sandbox/notes/tests/stubs/
```

Create `packages/features/_sandbox/notes/tests/helpers.ts`:

```ts
import { vi } from 'vitest';

import { createServerClient } from '@sidekick/core/supabase/server';

/**
 * Makes the next requests arrive signed in as this user. The test file must
 * mock `@sidekick/core/supabase/server` first, so the guard's real
 * resolveApiCaller reads this stand-in session instead of Supabase Auth.
 */
export function signInAs(userId: string): void {
   const session = {
      auth: {
         getUser: async () => ({ data: { user: { id: userId } }, error: null }),
      },
   };

   // The one cast in our tests: a stand-in for Supabase's client, which has
   // hundreds of members; resolveApiCaller only ever calls auth.getUser().
   vi.mocked(createServerClient).mockResolvedValue(
      session as unknown as Awaited<ReturnType<typeof createServerClient>>,
   );
}
```

In `eslint.config.js`, in the `import-x/no-extraneous-dependencies` `devDependencies` list, after `'**/*.spec.tsx',`:

```js
                  // Test helpers next to the tests (signInAs and the like)
                  '**/tests/**',
```

Run `pnpm install`.

**What:** route tests that go through everything a real request does except Supabase Auth.

**How:** a test file mocks `@sidekick/core/supabase/server` (a public entry point); `signInAs(userId)` makes its `getUser()` return that user, so the guard's real `resolveApiCaller`, transaction, lock, entitlement check and rollback all run. The one cast is explained in the helper: Supabase's client type has hundreds of members.

### 9b — The notes tests

`packages/features/_sandbox/notes/tests/integration/notes.test.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { ENTITY_TYPE, FEATURE_KEY } from '../../src';
import { noteSchema } from '../../src/contracts';
import { createNote, saveNote } from '../../src/server';
import { signInAs } from '../helpers';

// Proves the notes routes end to end: the real guard, handlers, Synergy and
// database, with only the Supabase session faked (see signInAs). Runs inside
// pnpm test:integration, on a database built from every package's migrations.
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const otherEntitled = randomUUID();
const notEntitled = randomUUID();

// The same guard options as apps/app's route files
const POST = withApiGuard(createNote, { feature: FEATURE_KEY, lockUser: true });
const PUT = withApiGuard(saveNote, { feature: FEATURE_KEY, lockUser: true });

const NOTE_BODY = { type: 'doc', content: [{ type: 'paragraph' }] };

function create(id: string, title = 'First note') {
   return POST(
      new Request('http://localhost/api/sandbox/notes', {
         method: 'POST',
         body: JSON.stringify({ id, title, body: NOTE_BODY }),
      }),
      undefined,
   );
}

function save(id: string, title: string, baselineContentSeq: number) {
   return PUT(
      new Request(`http://localhost/api/sandbox/notes/${id}`, {
         method: 'PUT',
         body: JSON.stringify({
            title,
            body: NOTE_BODY,
            baselineContentSeq,
         }),
      }),
      { params: Promise.resolve({ id }) },
   );
}

// Reads as postgres, which bypasses RLS, so a check doesn't depend on the code under test
async function storedNote(id: string) {
   const [row] = await testAdminDb`
      SELECT 
         notes.title, 
         entity.provider, 
         entity.type, 
         entity.content_seq,
         entity.display_name,
         entity.title AS entity_title,
         entity.actor_kind,
         entity.actor_id
      FROM 
         sandbox_notes notes JOIN entity_index entity 
      ON
         notes.id = entity.id
      WHERE
         notes.id = ${id}
   `;

   return row;
}

beforeAll(async () => {
   await testAuthDb`
      INSERT INTO
         auth.users (id, email)
      VALUES
         (${owner}, 'owner@example.com'),
         (${otherEntitled}, 'entitled@example.com'),
         (${notEntitled}, 'not_entitled@example.com')
   `;

   await testAdminDb`
      INSERT INTO
         user_feature_entitlements
         (user_id, feature_key)
      VALUES
         (${owner}, ${FEATURE_KEY}),
         (${otherEntitled}, ${FEATURE_KEY})
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

describe('notes routes', () => {
   it('creates a note and registers it with Synergy as a sandbox note', async () => {
      signInAs(owner);
      const id = randomUUID();

      const response = await create(id);

      expect(response.status).toBe(201);
      const note = noteSchema.parse(await response.json());
      expect(note).toMatchObject({ id, title: 'First note', contentSeq: 0 });
      expect(await storedNote(id)).toEqual({
         title: 'First note',
         provider: FEATURE_KEY,
         type: ENTITY_TYPE.NOTE,
         content_seq: 0,
         // Synergy shows the provider's title, and records who created it
         display_name: 'First note',
         entity_title: 'First note',
         actor_kind: 'human',
         actor_id: owner,
      });
   });

   it('saves from the current baseline and moves content_seq', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);

      const response = await save(id, 'Edited', 0);

      expect(response.status).toBe(200);
      expect(noteSchema.parse(await response.json()).contentSeq).toBe(1);
      expect(await storedNote(id)).toMatchObject({
         title: 'Edited',
         display_name: 'Edited',
         content_seq: 1,
      });
   });

   it('refuses a stale save with 409 and writes nothing', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);
      await save(id, 'First tab', 0);

      // The second tab still started from 0
      const response = await save(id, 'Second tab', 0);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ code: 'stale_content' });
      expect(await storedNote(id)).toMatchObject({
         title: 'First tab',
         content_seq: 1,
      });
   });

   it('refuses a user without the feature with 403 and writes nothing', async () => {
      signInAs(notEntitled);
      const id = randomUUID();

      const response = await create(id);

      expect(response.status).toBe(403);
      expect(await storedNote(id)).toBeUndefined();
   });

   it('answers 404 for another user’s note, the same as a missing one', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);

      signInAs(otherEntitled);
      const response = await save(id, 'Not mine', 0);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 'not_found' });
      expect(await storedNote(id)).toMatchObject({ title: 'First note' });
   });

   it('answers 400 for invalid input and writes nothing', async () => {
      signInAs(owner);
      const id = randomUUID();

      const response = await create(id, '   ');

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
         code: 'validation_failed',
         issues: [{ path: ['title'] }],
      });
      expect(await storedNote(id)).toBeUndefined();
   });
});
```

Check (always from the root; running a package's script directly fails with "`TEST_AUTH_DATABASE_URL` is not set"):

```bash
pnpm test:integration
```

`@sidekick/sandbox-notes:test:integration` ends with `Tests  6 passed (6)`. Change the handler to `type: 'task'` and the create test fails; put it back.

Commit: `test(sandbox): prove the notes routes end to end`.

### 9c — The tasks tests

The same setup under `packages/features/_sandbox/tasks/` (its finished `package.json` mirrors notes), then `tests/integration/tasks.test.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { ENTITY_TYPE, FEATURE_KEY } from '../../src';
import { taskSchema } from '../../src/contracts';
import { createTask, saveTask } from '../../src/server';
import { signInAs } from '../helpers';

// Proves the tasks routes end to end: the real guard, handlers, Synergy and
// database, with only the Supabase session faked (see signInAs). Runs inside
// pnpm test:integration, on a database built from every package's migrations.
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const otherEntitled = randomUUID();
const notEntitled = randomUUID();

// The same guard options as apps/app's route files
const POST = withApiGuard(createTask, { feature: FEATURE_KEY, lockUser: true });
const PUT = withApiGuard(saveTask, { feature: FEATURE_KEY, lockUser: true });

function create(id: string, title = 'First task') {
   return POST(
      new Request('http://localhost/api/sandbox/tasks', {
         method: 'POST',
         body: JSON.stringify({ id, title }),
      }),
      undefined,
   );
}

function save(
   id: string,
   title: string,
   done: boolean,
   baselineContentSeq: number,
) {
   return PUT(
      new Request(`http://localhost/api/sandbox/tasks/${id}`, {
         method: 'PUT',
         body: JSON.stringify({
            title,
            done,
            baselineContentSeq,
         }),
      }),
      { params: Promise.resolve({ id }) },
   );
}

// Reads as postgres, which bypasses RLS, so a check doesn't depend on the code under test
async function storedTask(id: string) {
   const [row] = await testAdminDb`
      SELECT 
         tasks.title,
         tasks.done, 
         entity.provider, 
         entity.type, 
         entity.content_seq,
         entity.display_name,
         entity.title AS entity_title,
         entity.actor_kind,
         entity.actor_id
      FROM 
         sandbox_tasks tasks JOIN entity_index entity 
      ON
         tasks.id = entity.id
      WHERE
         tasks.id = ${id}
   `;

   return row;
}

beforeAll(async () => {
   await testAuthDb`
      INSERT INTO
         auth.users (id, email)
      VALUES
         (${owner}, 'owner@example.com'),
         (${otherEntitled}, 'entitled@example.com'),
         (${notEntitled}, 'not_entitled@example.com')
   `;

   await testAdminDb`
      INSERT INTO
         user_feature_entitlements
         (user_id, feature_key)
      VALUES
         (${owner}, ${FEATURE_KEY}),
         (${otherEntitled}, ${FEATURE_KEY})
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

describe('tasks routes', () => {
   it('creates a task and registers it with Synergy as a sandbox task', async () => {
      signInAs(owner);
      const id = randomUUID();

      const response = await create(id);

      expect(response.status).toBe(201);
      const task = taskSchema.parse(await response.json());
      expect(task).toMatchObject({
         id,
         title: 'First task',
         done: false,
         contentSeq: 0,
      });
      expect(await storedTask(id)).toEqual({
         title: 'First task',
         done: false,
         provider: FEATURE_KEY,
         type: ENTITY_TYPE.TASK,
         content_seq: 0,
         // Synergy shows the provider's title, and records who created it
         display_name: 'First task',
         entity_title: 'First task',
         actor_kind: 'human',
         actor_id: owner,
      });
   });

   it('saves from the current baseline and moves content_seq', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);

      const response = await save(id, 'Edited', true, 0);

      expect(response.status).toBe(200);
      expect(taskSchema.parse(await response.json()).contentSeq).toBe(1);
      expect(await storedTask(id)).toMatchObject({
         title: 'Edited',
         display_name: 'Edited',
         done: true,
         content_seq: 1,
      });
   });

   it('refuses a stale save with 409 and writes nothing', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);
      await save(id, 'First tab', true, 0);

      // The second tab still started from 0
      const response = await save(id, 'Second tab', true, 0);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ code: 'stale_content' });
      expect(await storedTask(id)).toMatchObject({
         title: 'First tab',
         content_seq: 1,
      });
   });

   it('refuses a user without the feature with 403 and writes nothing', async () => {
      signInAs(notEntitled);
      const id = randomUUID();

      const response = await create(id);

      expect(response.status).toBe(403);
      expect(await storedTask(id)).toBeUndefined();
   });

   it('answers 404 for another user’s task, the same as a missing one', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);

      signInAs(otherEntitled);
      const response = await save(id, 'Not mine', true, 0);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 'not_found' });
      expect(await storedTask(id)).toMatchObject({ title: 'First task' });
   });

   it('answers 400 for invalid input and writes nothing', async () => {
      signInAs(owner);
      const id = randomUUID();

      const response = await create(id, '   ');

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
         code: 'validation_failed',
         issues: [{ path: ['title'] }],
      });
      expect(await storedTask(id)).toBeUndefined();
   });
});
```

`pnpm test:integration`: tasks `Tests  6 passed (6)`; with `type: 'note'` in the handler, the create test fails.

Commit: `test(sandbox): prove the tasks routes end to end`.

### 9d — Synergy's read route

```bash
cp packages/features/_sandbox/notes/tests/helpers.ts packages/platform/synergy/tests/
```

`packages/platform/synergy/tests/integration/read-entities.test.ts`:

```ts
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { readEntity } from '../../src/api/read-entity';
import { entitySchema } from '../../src/contracts';
import {
   registerEntity,
   saveEntityContent,
} from '../../src/repository/entities';
import { signInAs } from '../helpers';

// Proves GET /api/synergy/entities/:id end to end: the real guard, handler
// and database, with only the Supabase session faked (see signInAs).
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const stranger = randomUUID();

// The same guard options as apps/app's route file: none
const GET = withApiGuard(readEntity);

function read(id: string, ifNoneMatch?: string) {
   return GET(
      new Request(`http://localhost/api/synergy/entities/${id}`, {
         headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {},
      }),
      { params: Promise.resolve({ id }) },
   );
}

// Registers a fresh entity for the owner, straight through the repository
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

describe('GET /api/synergy/entities/:id', () => {
   it('returns the entity with its content_seq as the ETag', async () => {
      signInAs(owner);
      const id = await newEntity();

      const response = await read(id);

      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).toBe('"0"');
      expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
      // The response keeps its own contract
      expect(entitySchema.parse(await response.json())).toMatchObject({
         id,
         provider: 'sandbox-notes',
         type: 'note',
         contentSeq: 0,
      });
   });

   it('answers 304 with no body while the ETag still matches', async () => {
      signInAs(owner);
      const id = await newEntity();

      const response = await read(id, '"0"');

      expect(response.status).toBe(304);
      expect(response.headers.get('ETag')).toBe('"0"');
      expect(await response.text()).toBe('');
   });

   it('answers 200 with the new ETag once someone has saved', async () => {
      signInAs(owner);
      const id = await newEntity();
      await withRLS(owner, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'revision',
            displayName: 'Edited',
            actor: { kind: 'human', id: owner },
         }),
      );

      const response = await read(id, '"0"');

      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).toBe('"1"');
      expect(await response.json()).toMatchObject({ displayName: 'Edited' });
   });

   it('answers 404 for another user’s entity, the same as a missing one', async () => {
      signInAs(owner);
      const id = await newEntity();

      signInAs(stranger);
      const response = await read(id);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 'not_found' });
   });

   it('answers 404 for a deleted entity', async () => {
      signInAs(owner);
      const id = await newEntity();
      // As postgres: deleting isn't a route yet (lesson 11)
      await testAdminDb`UPDATE entity_index SET deleted_at = now() WHERE id = ${id}`;

      const response = await read(id);

      expect(response.status).toBe(404);
   });

   it('answers 404, never 500, for an id that isn’t a uuid', async () => {
      signInAs(owner);

      const response = await read('not-a-uuid');

      expect(response.status).toBe(404);
   });
});
```

`pnpm test:integration`: Synergy `Tests  21 passed (21)`. With `includeDeleted: true` in `readEntity`, the deleted-entity test fails.

Commit: `test(synergy): prove the entity read route end to end`.

### 9e — The catalog test

`packages/foundation/core/tests/integration/catalog.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';

import { createTestAdminDb } from '@sidekick/test-utils/db';

// Reads Postgres's own catalog to check that every table carries the RLS and
// triggers its delete model needs (D264). Every package migrates into this
// one test database, so it sees every table, whichever package owns it. It
// catches what a review would miss: a forgotten FORCE, trigger or policy
// term on a new table. Runs inside pnpm test:integration.

/** The four delete models in Delete Models (D264) */
type DeleteModel =
   'hard delete' | 'tombstones hidden' | 'tombstones visible' | 'append-only';

/**
 * Every table in the database and its delete model, mirroring the table list
 * in Delete Models. A new table fails the inventory test until it's added here
 * (and there).
 */
const TABLES: Readonly<Record<string, DeleteModel>> = {
   profiles: 'hard delete',
   user_feature_entitlements: 'hard delete',
   entity_index: 'tombstones visible',
   version_log: 'append-only',
   sandbox_notes: 'tombstones hidden',
   sandbox_tasks: 'tombstones hidden',
};

const testAdminDb = createTestAdminDb();

afterAll(async () => {
   await testAdminDb.end();
});

/**
 * Every table in the public schema, except the throwaway `*_probe` tables
 * other packages' tests create and drop while this one runs in parallel
 */
async function publicTables(): Promise<string[]> {
   const rows = await testAdminDb<{ name: string }[]>`
      SELECT relname AS name
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
         AND relkind = 'r'
         AND relname NOT LIKE '%\_probe'
      ORDER BY relname`;
   return rows.map(({ name }) => name);
}

/** A table's RLS flags, the functions its triggers call and its policies' USING terms */
async function security(table: string) {
   const [flags] = await testAdminDb<{ enabled: boolean; forced: boolean }[]>`
      SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class
      WHERE oid = ${`public.${table}`}::regclass`;
   const triggers = await testAdminDb<{ fn: string }[]>`
      SELECT p.proname AS fn
      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = ${`public.${table}`}::regclass AND NOT t.tgisinternal`;
   const policies = await testAdminDb<{ using: string }[]>`
      SELECT qual AS using
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ${table}`;
   const [privileges] = await testAdminDb<
      { canUpdate: boolean; canDelete: boolean }[]
   >`
      SELECT
         has_table_privilege('app_runtime', ${`public.${table}`}, 'UPDATE') AS "canUpdate",
         has_table_privilege('app_runtime', ${`public.${table}`}, 'DELETE') AS "canDelete"`;

   return {
      ...flags,
      triggerFunctions: triggers.map(({ fn }) => fn),
      policyUsing: policies.map(({ using }) => using),
      ...privileges,
   };
}

describe('the database catalog', () => {
   it('lists every table with its delete model', async () => {
      expect(await publicTables()).toEqual(Object.keys(TABLES).sort());
   });

   describe.each(Object.entries(TABLES))('%s (%s)', (table, model) => {
      it('has row-level security enabled and forced', async () => {
         const { enabled, forced } = await security(table);

         expect(enabled).toBe(true);
         expect(forced).toBe(true);
      });

      it('has the triggers and policy its delete model needs', async () => {
         const { triggerFunctions, policyUsing, canUpdate, canDelete } =
            await security(table);
         const hidesTombstones = policyUsing.some((using) =>
            using.includes('deleted_at IS NULL'),
         );

         switch (model) {
            case 'hard delete':
               expect(triggerFunctions).not.toContain('enforce_soft_delete');
               break;
            case 'tombstones hidden':
               expect(triggerFunctions).toContain('enforce_soft_delete');
               expect(triggerFunctions).toContain('block_update_on_deleted');
               expect(hidesTombstones).toBe(true);
               break;
            case 'tombstones visible':
               expect(triggerFunctions).toContain('enforce_soft_delete');
               // A restore-aware update trigger, never core's, which refuses restores
               expect(triggerFunctions).not.toContain(
                  'block_update_on_deleted',
               );
               expect(hidesTombstones).toBe(false);
               break;
            case 'append-only':
               expect(triggerFunctions).toContain('enforce_soft_delete');
               expect(canUpdate).toBe(false);
               expect(canDelete).toBe(false);
               break;
         }
      });
   });
});
```

`pnpm test:integration`: core `Tests  33 passed (33)`. Declare `sandbox_tasks` as `'tombstones visible'` and its trigger check fails; put it back.

**What:** a reviewer for every future table: forget FORCE, a trigger or the `deleted_at` term, and CI fails. A new table must be added here and in [[03-system-design/non-functional/database/delete-models|Delete Models]].

**How:** it reads `pg_class` (RLS flags), `pg_trigger` and `pg_proc` (trigger functions), `pg_policies` (the `USING` clause) and `has_table_privilege` (`app_runtime`'s rights), and checks each against the table's delete model. It skips `*_probe` tables, which other packages' tests create while it runs in parallel.

Commits: `test(sandbox): check the entity fields the create handlers copy`, `test(core): check every table's RLS and triggers against its delete model`.

## Exit check

```bash
pnpm prettier:check && pnpm turbo lint typecheck build test --force && pnpm test:integration
```

All green: core 33, Synergy 21, notes 6, tasks 6 integration tests. Step 8 by hand on dev.

## Where the build differs from the brief

- **Step order:** the error map came before the routes, and validation, status constants and D268 were steps of their own.
- **The lock opens the lesson,** and reaches the guard: routes never call `withRLS` themselves.
- **Route logic lives in the feature packages,** mounted in one line per route; tests sit with the tables they prove.
- **The error map is split** between core (the `{ code }` shape) and Synergy (its codes' statuses).
- **Table names are `sandbox_notes` and `sandbox_tasks`.**
- **No roll-up** in the entity response until links (lesson 6).
- **Additions:** the relative-import lint rule, shared columns in core, `HTTP_STATUS`, `ENTITY_TYPE` and `SYNERGY_ERROR_CODE`, D267 to D270, the catalog test.
