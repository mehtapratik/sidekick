---
publish: true
id: build.phase-3.lesson-2
title: "Synergy Lesson 2 Walkthrough: Per-Package Migrations"
created: 2026-11-11
updated: 2026-11-11
kind: guidance
version: 1.0.0
tags:
   - build
   - walkthrough
   - phase-3
   - database
   - drizzle
   - testing
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-2-per-package-migrations/00-brief]]"
---

# Synergy Lesson 2 Walkthrough — Per-Package Migrations

This guide reproduces [[04-phases/03-synergy/00-lessons/lesson-2-per-package-migrations/00-brief|lesson 2]] of [[04-phases/03-synergy/00-plan|Phase 3]] step by step. Every package that owns tables gets its own Drizzle config, migrations folder and migrations table; `pnpm db:migrate` runs them in dependency order; and one throwaway test database is built from every package's migrations, the same way. Synergy ships its first migration, the restore-aware update trigger function. It implements [[03-system-design/non-functional/database/migration|Migration]] 1.1.0 (D262) and [[03-system-design/non-functional/testing/testing-layers|Testing layers]] 1.3.0 (D261).

It shipped as [sidekick#53](https://github.com/mehtapratik/sidekick/pull/53), one squash-merged PR. What was learned along the way is in [[04-phases/03-synergy/00-lessons/lesson-2-per-package-migrations/02-notes|the notes]].

Run everything from the Sidekick repo root unless a step says otherwise.

## Where the build differs from the brief

- **Core's migrations table is renamed too.** The brief kept core on drizzle's default name. Pratik pointed out that one package without a `migrations.table` would puzzle every later reader, so every package is `__drizzle_migrations_<package>`, and each existing database gets a one-time `ALTER TABLE ... RENAME` before its next migrate (step 6).
- **Only the root reads `.env.local` (new step 4a).** Turbo runs tasks in strict env mode, so a test URL exported before `turbo run db:migrate` would be stripped, and a package-level `dotenv -e .env.local` would then have migrated dev. Package `db:*` scripts are now plain `drizzle-kit`, and `turbo.json` passes `DATABASE_DIRECT_URL` through.
- **The root wraps `test:integration` once, not each package.** Per-package wrapping would start two clusters on the same port in parallel, and run Turbo inside Turbo once per package. One database for every package matches [[03-system-design/non-functional/testing/testing-layers|Testing layers]]: test files use random per-file user ids so they share one database.
- **`@sidekick/test-utils` imports nothing in the workspace.** The brief expected it to import `core`. Only `db.ts` and `http.ts` are generic; core's `mocks.ts` is built from core's own types and stays in core. Core's tests depend on test-utils, so an import of core would have made a cycle.
- **A bug fix in core: migration `0009`.** The first shared test run showed Synergy's new function executable by the Data API roles. `0008`'s per-schema default privilege can't revoke the global `PUBLIC` `EXECUTE`; `0009` revokes it globally. See the post note in [[04-phases/01-front-door/01-row-level-security/01-walkthrough#Post note — Lock Out Supabase's Data API Roles (added 2026-10-23)|Phase 1.1]].
- **Synergy's test proves behaviour, not only existence.** It binds the function to a probe table and checks that a live update and a restore pass and a tombstone edit fails.

---

## Step 1 — Synergy's Drizzle config

> **What and why:** drizzle-kit records applied migrations in a table, one row per migration with a hash and the journal's `when` timestamp. Its migrator doesn't compare names or hashes: it takes the newest `created_at` and applies every journal entry whose `when` is later. So the table is a high-water mark. Two packages sharing one would hide each other's older migrations, silently.

```bash
git switch -c feat/per-package-migrations
```

`packages/platform/synergy/drizzle.config.ts`:

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
   // Each package records its applied migrations in its own table:
   // drizzle-kit applies only migrations newer than the newest row, so a shared
   // table would skip one package's older migrations.
   migrations: {
      table: '__drizzle_migrations_synergy',
   },
   dbCredentials: {
      url: directUrl,
   },
});
```

Core's `drizzle.config.ts` gets the same `migrations` block with `table: '__drizzle_migrations_core'`. Both tables sit in drizzle's default `drizzle` schema.

`packages/platform/synergy/src/db/schema/index.ts` — drizzle-kit reads `schema` even for a custom migration, and an empty module is enough:

```ts
// Synergy's Drizzle tables. Lesson 3 adds the first ones; until then the
// schema is empty and every migration is custom SQL.
export {};
```

Dependencies, quoted because zsh expands `*`:

```bash
pnpm -C packages/platform/synergy add -D drizzle-kit@^0.31.11 @types/node@^24.19.2
```

`@types/node` must stay on 24 (Node 24); without a version, pnpm installs the latest major. In Synergy's `tsconfig.json`, add `"compilerOptions": { "types": ["node"] }` and include `drizzle.config.ts`. TypeScript 6 defaults `types` to an empty list, so `process` is unknown until Node's types are named; core only had them because Next's types pull them in.

## Step 2 — Order by the package graph

> **What and why:** in `turbo.json`, `"dependsOn": ["^db:migrate"]` means "run `db:migrate` in every package this one depends on first". Lint only lets a package depend on layers below it, so every edge points down, and Turbo runs foundation, then platform, then features. Siblings in one layer can't depend on each other, so their migrations may run in parallel.

```json
"db:migrate": {
   "cache": false,
   "dependsOn": ["^db:migrate"]
},
```

Synergy needs the edge. A plain dependency, since lesson 3's code imports core at runtime:

```bash
pnpm -C packages/platform/synergy add '@sidekick/core@workspace:*'
```

Prove the order without a database:

```bash
pnpm turbo run db:migrate --dry=json | jq '.tasks[] | {taskId, dependencies}'
```

Synergy's task lists `@sidekick/core#db:migrate`; core's lists nothing. Packages without the script appear as empty placeholders.

A named dependency (`"@sidekick/core#db:migrate"`) is not the same thing: every package inherits it, core included, so core would wait for itself, and Turbo reports a cycle.

## Step 3 — Synergy's first migration

```bash
pnpm db:generate --filter=@sidekick/synergy -- --custom --name=restore_aware_update_trigger_fn
```

(During the lesson this ran inside the package; after step 4a the root form above is the one that works.) Replace drizzle-kit's placeholder line with:

```sql
-- Synergy's version of core's block_update_on_deleted: refuses every update to
-- a soft-deleted row except the one that restores it (deleted_at back to NULL).
-- Lesson 3 binds it to Synergy's tables with:
--   CREATE TRIGGER no_update_deleted_[table]
--     BEFORE UPDATE ON [table]
--     FOR EACH ROW EXECUTE FUNCTION synergy_block_update_on_deleted();
CREATE FUNCTION synergy_block_update_on_deleted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot update a soft-deleted row in % (id: %). Restore it first.',
      TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN NEW;
END;
$$;
```

- It refuses the one case "deleted and still deleted"; a live row and a restore pass ([[03-system-design/functional-design/04-synergy/tombstone-visibility|D66]]). Core's `block_update_on_deleted` refuses every update to a tombstone on purpose: ordinary tables follow D11 and never show a tombstone to restore.
- Plain `CREATE FUNCTION`, not `CREATE OR REPLACE`: a first definition should fail loudly if another package owns the name. The `synergy_` prefix names the owner in Postgres' shared `public` namespace.
- PL/pgSQL counts `RAISE` placeholders against arguments when it compiles the function, so a mistyped `%` fails the migration itself.

Add the generated `meta/` folders to `.prettierignore` with one glob, `packages/**/src/db/migrations/meta/`; drizzle-kit rewrites those files on every `generate`.

## Step 4a — Load `.env.local` once, at the root

> **What and why:** Turbo 2 runs tasks in **strict env mode** (`--dry=json` shows `"envMode": "strict"`): a task sees only the variables `turbo.json` declares for it. Turbo filters; it doesn't create, so the root still loads the file, and each task receives only what it declares.

`turbo.json`:

```json
"db:migrate": {
   "cache": false,
   "dependsOn": ["^db:migrate"],
   "passThroughEnv": ["DATABASE_DIRECT_URL"]
},
"db:generate": {
   "cache": false,
   "passThroughEnv": ["DATABASE_DIRECT_URL"]
},
```

Root `package.json`:

```json
"db:generate": "dotenv -e .env.local -- turbo db:generate",
"db:migrate": "dotenv -e .env.local -- turbo db:migrate",
```

Core's and Synergy's `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
```

`passThroughEnv` rather than `env`: `env` would also put the URL into the cache key, and these tasks are never cached. Prove it fails safe:

```bash
pnpm turbo run db:migrate --filter=@sidekick/core
pnpm turbo run db:migrate --dry=json | jq '.tasks[] | select(.taskId=="@sidekick/synergy#db:migrate") | .environmentVariables.specified'
```

The first fails with `Missing DATABASE_DIRECT_URL`: nothing loaded the file, so nothing reached the task. The second shows the variable under `passThroughEnv`.

## Step 4b — One test database for every package

```bash
mkdir -p scripts/test-db
git mv packages/foundation/core/tests/with-test-db.sh scripts/test-db/with-test-db.sh
git mv packages/foundation/core/tests/supabase-stub.sql scripts/test-db/supabase-stub.sql
```

In `scripts/test-db/with-test-db.sh`, update the header comment, replace `CORE=...` with `ROOT="$(cd "$HERE/../.." && pwd)"`, and replace the single `drizzle-kit migrate` line with:

```bash
# Every package's migrations, in dependency order. turbo.json passes
# DATABASE_DIRECT_URL through to db:migrate, and no package reads .env.local,
# so this can only reach the throwaway database.
(cd "$ROOT" && DATABASE_DIRECT_URL="$(url postgres)" \
  pnpm turbo run db:migrate --output-logs=errors-only)
```

Root `package.json`: `"test:integration": "scripts/test-db/with-test-db.sh turbo test:integration"`. Core's becomes `"test:integration": "vitest run tests/integration"`. The URLs now cross Turbo, so the task declares them:

```json
"test:integration": {
   "cache": false,
   "passThroughEnv": ["DATABASE_URL", "TEST_AUTH_DATABASE_URL", "TEST_ADMIN_DATABASE_URL"]
}
```

```bash
pnpm test:integration
```

The first run failed core's Data API test: `synergy_block_update_on_deleted` was executable by `anon` and `authenticated`. That is a core bug, fixed next.

### 4c — Core `0009`: revoke function `EXECUTE` globally

> **What and why:** Postgres keeps default privileges at two levels: global, and per schema on top. A per-schema rule can only add; it can't take back a global grant. The built-in global default lets `PUBLIC` (every role) execute every new function, so `0008`'s `IN SCHEMA public` revoke left new functions executable. Nothing noticed until Synergy created the first function after `0008`.

```bash
pnpm db:generate --filter=@sidekick/core -- --custom --name=revoke_function_execute_from_public
```

```sql
-- 0008 revoked EXECUTE on future functions with ALTER DEFAULT PRIVILEGES ... IN SCHEMA
-- public, but a per-schema default can only add to the global defaults, never take away
-- from them. The global default lets PUBLIC (every role, anon and authenticated included)
-- execute every new function, so functions created after 0008 were still executable
-- through the Data API. Revoke it globally for the role that runs migrations: functions
-- postgres creates from now on, in any schema, are executable only by roles granted
-- EXECUTE explicitly. Triggers don't need EXECUTE to fire, so trigger functions still work.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
```

Step 2's ordering makes a core fix enough: core's `0009` always runs before Synergy's `0000`. `pnpm test:integration` is green again.

## Step 5 — Shared test helpers in `@sidekick/test-utils`

### 5a — The package

`packages/test-utils/package.json`:

```json
{
   "name": "@sidekick/test-utils",
   "private": true,
   "license": "MIT",
   "version": "0.0.0",
   "type": "module",
   "exports": {
      "./db": "./src/db.ts",
      "./http": "./src/http.ts"
   },
   "scripts": {
      "lint": "eslint .",
      "typecheck": "tsc -p tsconfig.json --noEmit"
   },
   "dependencies": {
      "postgres": "^4.0.0"
   },
   "devDependencies": {
      "@types/node": "^24.19.2"
   }
}
```

`packages/test-utils/tsconfig.json` extends `../../tsconfig.base.json` with `"types": ["node"]` and `"include": ["src"]`.

```bash
mkdir -p packages/test-utils/src
git mv packages/foundation/core/tests/helpers/db.ts packages/test-utils/src/db.ts
git mv packages/foundation/core/tests/helpers/http.ts packages/test-utils/src/http.ts
pnpm -C packages/foundation/core add -D '@sidekick/test-utils@workspace:*'
```

In `db.ts`, the comments and the error point at `pnpm test:integration` instead of the old script path. Core's imports of `../helpers/db` and `../helpers/http` (and `../../tests/helpers/http` in `src/api/*.test.ts`) become `@sidekick/test-utils/db` and `@sidekick/test-utils/http`. `mocks.ts` stays in core.

Typecheck, tests and integration tests pass; `pnpm lint` fails: boundaries doesn't know `packages/test-utils`.

### 5b — Lint

In `eslint.config.js`, a new element and one policy:

```js
{ type: 'test-utils', pattern: 'packages/test-utils' },
```

```js
// Shared test helpers (D261, Synergy lesson 2): any layer's tests may import
// @sidekick/test-utils. Packages list it as a devDependency, so
// import-x/no-extraneous-dependencies keeps it out of product code.
// test-utils itself imports no workspace package.
{
   from: {
      element: {
         type: ['app', 'registry', 'feature', 'platform', 'foundation'],
      },
   },
   allow: { to: { element: { type: 'test-utils' } } },
},
```

Boundaries can't tell a test file from product code; the existing devDependency rule can, because it lets only test and config files import devDependencies. Add test-utils to Synergy too (`pnpm -C packages/platform/synergy add -D '@sidekick/test-utils@workspace:*'`), then prove both limits:

1. `import '@sidekick/test-utils/http';` in `packages/platform/synergy/src/index.ts` fails `import-x/no-extraneous-dependencies` ("should be listed in the project's dependencies, not devDependencies").
2. `import '@sidekick/core';` in `packages/test-utils/src/db.ts` fails `boundaries/dependencies` (no policy from `test-utils` to `foundation`) and the extraneous-dependency rule. The editor also shows TypeScript's "Cannot find module": pnpm only links a workspace package that is declared.

Remove both; `pnpm lint` is green.

## Step 6 — Prove it

### 6a — Synergy's integration test

`packages/platform/synergy/tests/integration/restore-aware-trigger.test.ts` checks that the function exists, then binds it to a probe table (`public.synergy_trigger_probe`, created in `beforeAll` and dropped in `afterAll` through `createTestAdminDb()`) and proves three things in order: updating a live row passes, updating a deleted row that stays deleted is refused with "Cannot update a soft-deleted row", and restoring the deleted row passes. Synergy gets `"test:integration": "vitest run tests/integration"` and `"tests"` in its tsconfig `include`.

```bash
pnpm test:integration
```

Core 17 and Synergy 4 pass against one database. Break it: remove `AND NEW.deleted_at IS NOT NULL` from the migration, and "allows restoring a deleted row" fails. Editing an unapplied migration is fine because the test database is rebuilt on every run; once dev applies it, it is frozen.

### 6b — Dev

In the Supabase SQL editor, check `SELECT count(*) FROM drizzle.__drizzle_migrations;` (9), then rename it:

```sql
ALTER TABLE drizzle.__drizzle_migrations RENAME TO __drizzle_migrations_core;
```

```bash
pnpm db:migrate
```

Core applies only `0009`, Synergy only its `0000`. Check:

```sql
SELECT (SELECT count(*) FROM drizzle.__drizzle_migrations_core)    AS core,
       (SELECT count(*) FROM drizzle.__drizzle_migrations_synergy) AS synergy,
       has_function_privilege('anon', 'synergy_block_update_on_deleted()', 'EXECUTE') AS anon_can_execute;
```

`10 | 1 | false`. A second `pnpm db:migrate` applies nothing: Turbo still prints "cache bypass" (the task is never cached, since only the database knows what's pending), drizzle's `CREATE ... IF NOT EXISTS` notices show it found both tables, and its "migrations applied successfully" is printed even when nothing was applied.

**Exit check:** `pnpm turbo run lint typecheck test --force`, `pnpm test:integration`, `pnpm prettier:check`, dev migrated, CI green on [sidekick#53](https://github.com/mehtapratik/sidekick/pull/53).
