---
publish: true
id: build.phase-3.lesson-4
title: "Synergy Lesson 4 Walkthrough: Sandbox Providers and the First Routes"
created: 2026-11-22
updated: 2026-11-22
kind: guidance
version: 1.0.0
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

Lesson 4 built the first two feature packages, the sandbox notes and tasks providers, and the first routes into Sidekick's data: create and save for each provider, and Synergy's `GET /api/synergy/entities/:id` with an ETag and 304. Along the way it moved the user lock to the start of every write transaction, made an error response roll back, and gave the API one way to validate input and one way to answer errors. Pratik typed the code; the steps below are the order it landed in ([sidekick#64](https://github.com/mehtapratik/sidekick/pull/64)).

The notes behind it (questions, design calls, surprises) are in [[04-phases/03-synergy/00-lessons/lesson-4-sandbox-providers/02-notes|the lesson notes]].

## How a request flows

The map Pratik asked for once the pieces were in place, for `PUT /api/sandbox/notes/:id`:

1. **Route file** (`apps/app/src/app/api/sandbox/notes/[id]/route.ts`): wiring only. A URL and method, a handler, and the guard's options.
2. **Guard** (`withApiGuard`, `@sidekick/core/api`): who are you (401), open the transaction, set the user, take the user lock, do you have the feature (403), run the handler, then commit, or roll back on a throw or an error response (D268), and log.
3. **Handler** (`saveNote`, `@sidekick/sandbox-notes/server`): validate the input against the contract (400), ask Synergy to record the save (404, 409), write the feature's own table, shape the response.
4. **Feature contract** (`@sidekick/sandbox-notes/contracts`): the request schemas and response types, with no database code, so a UI imports the same file.
5. **Synergy's repository** (`saveEntityContent`, `@sidekick/synergy/server`): what every entity has in common, the stale check, the revision or version bump and the version log. It speaks in error codes, never HTTP.
6. **Synergy's contract** (`@sidekick/synergy/contracts`): `Entity`, the error codes and their statuses.
7. **Schemas** (`src/db/schema/` in each package): the tables as TypeScript, the source of every migration and every RLS policy.
8. **Postgres**: RLS, soft-delete triggers, the deferred foreign key and the transaction, whatever the code above does.

Where does a new piece go? Shared with the browser: a contract. Needs the database: `/server`, behind a handler. About one URL: a route file. About every request: the guard.

## Where the build differs from the brief

- **Step order.** The brief's error map (its step 6) came before the routes, because the save route needs it, and request validation, status constants and the rollback on error responses (D268) were added as steps of their own.
- **The lock opens the lesson.** Pratik's idea from lesson 3's handover became step 1, and it reached the guard: routes never call `withRLS` themselves.
- **The route logic lives in the feature packages,** and `apps/app` mounts it with one line per route. The tests sit in the feature packages, next to the tables they prove.
- **The error map is split** between core (the `{ code }` shape) and Synergy (its codes' statuses), not placed in `apps/app` or only in Synergy.
- **The sandbox tables are named `sandbox_notes` and `sandbox_tasks`,** not `notes` and `tasks`, since every package shares one `public` schema.
- **No roll-up yet** in the entity response: it needs links (lesson 6).
- **Unplanned additions:** a lint rule against relative imports into other packages, shared timestamp columns in core, `HTTP_STATUS`, per-package `ENTITY_TYPE` and error-code constants, a lint rule that keeps the App's UI off the data layer (D269), D267 and D270, and a catalog test.

## Step 1 — The user lock at the start of a transaction

Lesson 3 left a deadlock waiting for lesson 10: a provider writes its own row before calling Synergy, so the user lock wasn't first in the transaction. Pratik's idea: let `withRLS` take the lock right after it sets the user.

### 1a — Two wrappers inside `withRLS`

The first version was a flag on `withRLS` that called a moved `lockCurrentUser`. Pratik asked how a higher-order style (`withUserLock`, `withUserOnlyData`) compared, then proposed building `withRLS` itself from the two wrappers. That's what landed in `packages/foundation/core/src/db/rls.ts`:

```ts
export function withUserLock<Args extends unknown[], Result>(
   work: RlsTxWork<Args, Result>,
): RlsTxWork<Args, Result> {
   return async function lockedWork(tx, ...args) {
      await tx.execute(
         sql`select pg_advisory_xact_lock(hashtextextended(current_setting('app.current_user_id'), 0))`,
      );
      return work(tx, ...args);
   };
}

// Not exported: withRLS stays the only public way into user data.
function withUserOnlyData<T>(fn: RlsTxHandler<T>): (userId: string) => Promise<T> {
   return async function userOnlyData(userId) {
      return getUnsafeDb().transaction(async (tx) => {
         await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
         return fn(tx);
      });
   };
}

export async function withRLS<T>(userId: string, fn: RlsTxHandler<T>, options: RlsOptions = {}): Promise<T> {
   const work = options.lockUser ? withUserLock(fn) : fn;
   return withUserOnlyData(work)(userId);
}
```

`@sidekick/core/db` exports `withRLS`, `withUserLock`, `RlsTx`, `RlsTxWork` and `RlsOptions`.

### 1b — The guard passes `lockUser` through

`GuardOptions` gained `lockUser?: boolean`, and `authorizeAndHandle` passes `{ lockUser: opts.lockUser }` to `withRLS`. The unit test that asserted `withRLS`'s arguments got the third argument, and a new test checks the flag is forwarded.

### 1c — Synergy uses core's lock

`git rm packages/platform/synergy/src/repository/lock.ts`; `entities.ts` imports `withUserLock` from `@sidekick/core/db`. The lint rule `require-user-lock` only checks that `withUserLock` is imported, so it kept working.

### 1d — Prove it

`packages/foundation/core/tests/integration/user-lock.test.ts` reads `pg_locks`: no advisory lock without the flag, one with it, and a second locked transaction for the same user waits (`vi.waitFor` until `pg_locks` shows an ungranted advisory lock) while another user's runs straight through. Pratik named the promises `lock`, `unlock`, `waitForLock`, `waitForUnlock`, and asked why the other user's call asserted nothing: it only failed through a timeout, so the test now records `'userB ran'` and checks the order `['userB ran', 'first done', 'second ran']`. The file was first saved as `user-lock.ts`, which Vitest ignores; it must end in `.test.ts`. With `withRLS` ignoring the flag, two tests fail.

## Step 2 — The sandbox packages

### 2a — Make room for `_sandbox`

`pnpm-workspace.yaml` gained `packages/features/_sandbox/*`, `eslint.config.js` its tsconfig glob, and a boundaries element `packages/features/_sandbox/*` listed before `packages/features/*`, so each sandbox provider is its own feature.

### 2b to 2d — Two packages and the registry

`@sidekick/sandbox-notes` and `@sidekick/sandbox-tasks` each export `FEATURE_KEY` and a plain `MANIFEST`. Where the `FeatureManifest` type should live came up first: a feature can't import the registry. Pratik proposed that each feature export its key and the registry compose the type, and asked to avoid type casts. The type stays in the registry:

```ts
export const ALL_FEATURES: readonly FeatureManifest[] = [sandboxNotes.MANIFEST, sandboxTasks.MANIFEST];

export type FeatureKey = typeof sandboxNotes.FEATURE_KEY | typeof sandboxTasks.FEATURE_KEY;
```

The union comes from the constants, because a key inside a plain object widens to `string`. The manifest's `name` and `description` are written inline, not in `@sidekick/copy`: only the ops script reads them today. The notes package first landed in `packages/features/notes/` and was moved under `_sandbox/`.

### 2e — Watch lint refuse a feature-to-feature import

A `probe.ts` in notes importing `@sidekick/sandbox-tasks` failed `pnpm lint` with "no policy allowing dependencies from elements of type feature to elements of type feature". Without the `_sandbox/*` element, the same import passed.

## Step 3 — The tables

### 3a — Refuse relative imports into another package

When the session ended on step 2, the tasks folder had turned into `_sandbox/notes copy`, and the editor rewrote the registry's import to `../../features/_sandbox/notes copy/src`. Lint said nothing: the registry may import features, so boundaries allowed the direction. `import-x/no-relative-packages` now refuses any relative path into another package; a planted `../../tasks/src` import fails.

### 3b — The notes table

1. **Package setup:** `db:generate` and `db:migrate` scripts, dependencies on core, Synergy and `drizzle-orm`, and a `drizzle.config.ts` with its own migrations table, `__drizzle_migrations_sandbox_notes`. Pratik pointed the schema at `./src/db/schema/index.ts` to match the other packages. Turbo migrates core, then Synergy, then notes.
2. **Shared columns:** Pratik asked why the table repeated Synergy's column helpers. `utcTimestamp`, `timestamps` and `tombstone` moved to `@sidekick/core/db/columns`; provenance stayed in Synergy, because provider rows don't carry it. drizzle-kit reported no schema changes for core or Synergy.
3. **The schema** (`src/db/schema/notes.ts`): `sandbox_notes` with `id` (the entity's id), `user_id`, `title`, `body` (`jsonb`), the shared timestamps and tombstone, and an own-live-rows policy whose `USING` adds `deleted_at IS NULL`.
4. **Generated migration** `0000_sandbox_notes`: the table, `ENABLE ROW LEVEL SECURITY`, the `user_id` foreign key and the policy.
5. **Hand-written migration** `0001_force_rls_soft_delete_and_entity_fk`: FORCE RLS, core's `enforce_soft_delete` and `block_update_on_deleted`, and

```sql
ALTER TABLE sandbox_notes
   ADD CONSTRAINT sandbox_notes_id_entity_index_id_fk
   FOREIGN KEY (id) REFERENCES entity_index (id)
   DEFERRABLE INITIALLY DEFERRED;
```

Postgres checks a deferred key at commit, so a note may be written before its index row, but never committed without one.

Pratik asked whether a SQL procedure could apply each table's policy and triggers from parameters. It was recorded as **D267**: each table writes its own ownership check, a central function is deferred, and the catalog test (step 9e) is the safety net.

### 3c — The tasks table

The same recipe: `sandbox_tasks` with `title` and `done` (default `false`).

## Step 4 — Synergy's entry points

`@sidekick/synergy` exports `/server` (the repository and `SynergyError`, behind `server-only`), `/contracts` (the error codes) and an empty `/react` (D199); the empty `.` entry went. Pratik asked why not `/client`: both sides import `/contracts`.

## Step 5 — Errors, validation and the notes routes

### 5a — The error map

Pratik asked where Synergy's boundary is. The answer moved the shape to core and kept the meaning in Synergy:

- `@sidekick/core/api`: `errorResponse(code, status)` and `ApiErrorBody`, a body of `{ code }`.
- `@sidekick/synergy/contracts`: `SYNERGY_ERROR_CODE` (an inventory Pratik asked for) and `SYNERGY_ERROR_STATUS`, `not_found` to 404 and `stale_content` to 409.
- `@sidekick/synergy/server`: `synergyErrorResponse(error)`, which rethrows anything that isn't a `SynergyError`.

### 5b — Request validation

`@sidekick/core/api` gained `parseRequestBody(req, schema)`. Pratik rewrote the first version in their own words; the review kept that structure and fixed a missing `status: 400`, a `path` field named `input`, and the key prefix (`common.validation.*`, per D252), and replaced `parseBody` plus `validationFailedResponse` with one function that returns `ValidBody` or `InvalidBody`:

```ts
const parsed = await parseRequestBody(req, createNoteRequestSchema);
if (!parsed.ok) return parsed.response;
```

`validationFailedResponse` stays private, so handlers never see zod's errors. An editor auto-import (`import { InvalidBody, ValidBody } from './validation'`) passed typecheck and lint but failed `build` under `verbatimModuleSyntax`.

### 5c and 5d — The notes contract and the create handler

`src/contracts.ts` holds `noteBodySchema` (a `looseObject` with `type: 'doc'`, so Tiptap's attributes survive), `createNoteRequestSchema`, `saveNoteRequestSchema`, and `noteSchema` with `Note` inferred from it, so a client can parse a response instead of trusting it. `src/server.ts` holds `createNote`: validate, `registerEntity`, insert the note, answer 201 with the note and its `contentSeq`. Synergy gained `identifyActor(caller)`, Pratik's name for the session-or-key mapping.

### 5e — `HTTP_STATUS`

`@sidekick/core/http` exports a frozen `HTTP_STATUS` and, from Pratik's refactor, `HttpStatus`, the union of its values. It's its own entry point with no imports, because Synergy's browser-safe `/contracts` uses it. Pratik also tried an `HTTP_ERROR_CODE` constant that constrained every error code; it was undone, since one status carries many codes and core can't list Synergy's.

### 5f — An error response rolls back (D268)

Pratik noticed that the parser returns a ready 400 while the handler builds its own success. Discussing it surfaced a footgun: the guard committed whenever a handler returned, even with a 409. Now the guard throws a private `ErrorResponseRollback` inside the transaction for any status of 400 or above, Drizzle rolls back, and the guard returns the handler's response outside it. The core integration test that pinned the old behavior now asserts the rollback; with the old guard it fails. The guard doc, the decisions log and the harness record D268, and the Phase 2 rule "handlers validate before they write" is retired.

### 5g — The save handler

`saveNote` reads the id from `ctx.params` (404 if it isn't a uuid), validates, calls `saveEntityContent` with the baseline (409 `stale_content`, 404 `not_found` through `synergyErrorResponse`), updates the note, and answers 200 with the new `contentSeq`.

### 5h — The routes, and keeping the UI off the data layer

```ts
export const POST = withApiGuard(createNote, { feature: FEATURE_KEY, lockUser: true });
```

in `apps/app/src/app/api/sandbox/notes/route.ts`, and `PUT` with `saveNote` in `[id]/route.ts`. Pratik asked whether the API should be its own app at its own address. It stays in `apps/app` until Phase 9 (**D270**), and a lint rule makes the main benefit real now (**D269**): in `apps/app`, only `src/app/api/**/route.ts` may import `@sidekick/core/db`, `@sidekick/core/api` or a package's `/server`.

## Step 6 — Synergy's read route

`/contracts` gained `entitySchema`, `Entity`, and `ENTITY_STATUSES` with `EntityStatus` (moved from the schema so the browser can use them); `/server` gained `toEntity` and `readEntity`, mounted at `GET /api/synergy/entities/[id]` with no feature gate and no lock. It answers with `ETag: "<content_seq>"` and `Cache-Control: private, no-cache`, and 304 with no body when `If-None-Match` names the current ETag. Another user's id, a deleted entity and a malformed id all answer 404.

## Step 7 — The tasks routes

Pratik mirrored the notes contract and server for tasks, and a first review found what the typecheck couldn't: `type: 'note'` in `registerEntity`, a save handler still named `saveNote`, and a missing `server-only`. Each package then got an `ENTITY_TYPE` constant (`NOTE: 'note'`, `TASK: 'task'`) instead of a central list, because types belong to their provider (D200).

## Step 8 — Try it by hand

1. `pnpm db:migrate` applied notes' and tasks' `0000` and `0001` to dev.
2. `pnpm ops:entitlements:grant --email <email> --feature sandbox-notes --feature sandbox-tasks`, then again with `--apply`.
3. With `pnpm dev` running and the session cookie in `SK_COOKIE`, `curl` created a note (201), read its entity (200, `ETag: "0"`), read it conditionally (304), saved it (200, `contentSeq` 1), saved again from the old baseline (409, nothing written), and sent a blank title (400).

The first `curl` answered 403 `FEATURE_DISABLED`: the dev database has two accounts, and the grant had gone to the other one. The guard was right.

## Step 9 — Prove it

### 9a and 9b — Notes, end to end

The notes package got `vitest.config.ts`, the `server-only` stub and a `test:integration` script. `tests/helpers.ts` holds `signInAs(userId)`, which makes the mocked `@sidekick/core/supabase/server` client return that user, so the guard's real `resolveApiCaller` runs; it holds the tests' one cast, explained in a comment. `eslint.config.js` lets files under `tests/` import devDependencies. `notes.test.ts` builds `POST` and `PUT` like the route files and proves create (registered as a sandbox note, with its display name, title and actor), save, a stale save's 409, 403 without the feature, 404 for another user's note and 400 for bad input, reading the database as `postgres` after each and parsing every success with `noteSchema`.

Integration tests only run through the root `pnpm test:integration`, which builds the database. Pratik's first run used a filter that pnpm took for itself and failed with "`TEST_AUTH_DATABASE_URL` is not set".

### 9c — Tasks

The same setup and six tests, written by the coach at Pratik's request. With `type: 'note'` in the handler, the create test fails.

### 9d — Synergy's read route

`read-entities.test.ts` proves the ETag, the 304 with an empty body, the new ETag after a save, and the three 404s. The tombstone is set as `postgres`, since deleting isn't a route until lesson 11.

### 9e — The catalog test

`packages/foundation/core/tests/integration/catalog.test.ts` lists every table with its delete model and reads Postgres's catalog: every table has RLS enabled and forced, tombstones hidden has core's triggers and a `deleted_at IS NULL` policy term, tombstones visible doesn't use core's frozen-row trigger, and append-only denies `app_runtime` updates and deletes. A new table fails the inventory until it's listed. It skips `*_probe` tables, which other packages' tests create while it runs.

## Exit check

- `pnpm prettier:check`, `lint`, `typecheck`, `build` and `test` green uncached; `pnpm test:integration` green: core 33, Synergy 21, notes 6, tasks 6.
- Step 8 by hand on dev, as above.
