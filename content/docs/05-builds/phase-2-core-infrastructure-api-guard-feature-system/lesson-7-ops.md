---
publish: true
id: build.phase-2.lesson-7
title: "Phase 2 lesson 7 walkthrough: the ops package and entitlements grant"
created: 2026-10-24
updated: 2026-10-24
kind: guidance
version: 1.0.0
tags:
   - build
   - walkthrough
   - phase-2
   - feature-system
   - database
   - postgresql
   - cli
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-10]]"
---

# Phase 2 Lesson 7 Walkthrough — The `ops` Package and `entitlements grant`

This guide reproduces lesson 7 of [[04-plans/phase-2-core-infrastructure-api-guard-feature-system|Phase 2]] step by step: task 2.10, "a seed script to enable all features for your own account". It builds that seed as the first command of a new `packages/ops` package for privileged scripts. It assumes lesson 6 is merged ([[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-6-health|lesson 6 walkthrough]]).

The result shipped as [sidekick#23](https://github.com/mehtapratik/sidekick/pull/23). The design is recorded in [[contracts#Ops|contracts]] (version 2.8.0).

The brief planned a script in `packages/features-registry/scripts/`. The lesson started by asking what the script is for, and that moved it into its own package. Step 1 explains why. Every step explains what you are doing and why.

---

## Step 1 — Decide What the Script Is For, and Where It Lives

> **What and why:** A feature is on for an account only if `user_feature_entitlements` has a row for it. Before writing the script, be clear about who is allowed to write that row, because that decides where the code may live.

1. **Who can write entitlements.** Lesson 3 gave `app_runtime` (the app's role, `DATABASE_URL`) only `SELECT` on the table, so nobody can grant themselves a feature. Only the privileged `postgres` role (`DATABASE_DIRECT_URL`), which bypasses RLS, can insert a row.

2. **Why a script at all.** Once Phase 4 wraps Taxila's routes in `withApiGuard(…, { feature: 'taxila' })`, your own dev account gets `403 FEATURE_DISABLED` until that row exists. Until an admin UI or admin API exists, something has to play the admin. The script is that "grant" button. `ALL_FEATURES` is empty today, so the script has nothing to grant until Phase 4. It's built now so the path is proven before it's needed.

3. **Why not the registry's `scripts/` folder.** The registry is the only package that knows every feature key, which made it the brief's choice. But it would have given the registry a database driver, needed a lint ban to keep that driver out of `src/` (which `apps/web` imports), and had to move once a second privileged script arrived. The options weighed:

| Option                          | For                                                | Against                                                                         |
| ------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Registry `scripts/`             | knows every key                                    | the registry gains a database driver                                            |
| Core `scripts/`, keys as flags  | core already has the driver and the schema         | core can't import the registry, so `--all` is impossible and typos go unchecked |
| SQL snippet in the SQL editor   | no code                                            | manual, repeated per feature, keys drift from the registry                      |
| **A dedicated `ops` package**   | may import both registry and core; nothing may import it | a new package and a lint rule                                             |

Pratik chose the dedicated package: one home for **dev seeds, provisioning backdoors and break-glass scripts**, each retired when an admin UI, the public API or the CLI covers it.

4. **Why not a CLI dispatcher yet.** A `pnpm ops <noun> <verb>` entry point with `--help` was considered and deferred. With one command it solves a discovery problem that doesn't exist yet, and Phase 9 has CLI design as its own learning payoff. The script follows CLI conventions from day one, so a dispatcher later wraps it rather than rewriting it.

5. **Why `ops` code won't move into the Phase 9 CLI.** Phase 9's `apps/cli` is an API client: it authenticates with a user's API key and goes through `withApiGuard` and RLS. `ops` connects as `postgres` and bypasses both. When an `ops` command is retired, its logic moves into an admin API endpoint and the CLI calls that endpoint. What carries over is the interface: command names, flags, output and exit codes.

6. **The conventions every `ops` script follows:**
   1. Top level declares: `main()` runs only `if (import.meta.main)`, and env reads and connections happen inside it.
   2. Flags come from `node:util`'s `parseArgs` in strict mode.
   3. Dry run by default; writes need `--apply`. A script run against the wrong database prints a plan and changes nothing.
   4. Results on stdout, errors on stderr; exit 0 ok, 1 failed, 2 usage error.
   5. The header comment names what replaces the script.

7. Branch from an up-to-date `main`:

```bash
git switch main
git pull origin main
git switch -c feature/P2L7-ops
```

---

## Step 2 — Create the Package

> **What and why:** A folder under `packages/` joins the workspace and ESLint's TypeScript project list automatically. The choices are what the package exposes, what it depends on, and what runs it.

1. Create `packages/ops/package.json`:

```json
{
  "name": "@sidekick/ops",
  "private": true,
  "license": "MIT",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@sidekick/core": "workspace:*",
    "@sidekick/features-registry": "workspace:*",
    "drizzle-orm": "^0.45.4",
    "postgres": "^3.4.9"
  },
  "devDependencies": {
    "@types/node": "^24.19.2",
    "tsx": "^4.23.15"
  }
}
```

- **No `exports`.** Nothing should import `ops`, so it publishes no entry point. That's a hint; Step 3's lint rule is the guard.
- **No `build` and no `test` script.** `tsx` runs the source directly, and Turbo skips a task in packages that don't define it (as `@sidekick/copy` does). `vitest run` with no test files exits with an error, so `test` comes with the first test.
- **`dependencies` vs `devDependencies`:** what `src/` imports is a dependency (`import-x/no-extraneous-dependencies` requires it outside test files); tools are dev dependencies, like `drizzle-kit` in core. Nothing is deployed, so the split documents intent.
- **The versions match core's,** so pnpm links one copy of `drizzle-orm` and `postgres`. Two copies of Drizzle can make TypeScript reject one copy's tables in the other's queries.
- **`workspace:*`** links the local package instead of fetching it from npm.

2. Create `packages/ops/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"]
}
```

- **`types: ["node"]` is required on TypeScript 6.0,** whose default for `types` is `[]`: it no longer loads every installed `@types/*` package. Without it, typecheck fails with `Cannot find name 'process'`. Core passes without it only because Next.js's types pull Node's in. Being explicit also says what this package runs in.

3. Run `pnpm install` from the root. The lockfile gains `@sidekick/ops`, and `packages/ops/node_modules/drizzle-orm` points at the same `drizzle-orm@0.45.4_postgres@3.4.9` folder as core's.

4. **Why `tsx`, not Node's built-in TypeScript.** Node 24 runs `.ts` files by stripping the types, but it doesn't add file extensions to imports. Try it:

```bash
cd packages/core
node --input-type=module -e "await import('@sidekick/core/db/schema')"
```

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/packages/core/src/db/schema/profiles' imported from …/schema/index.ts
```

`schema/index.ts` imports `./profiles` without `.ts`, which bundlers and our `moduleResolution: "bundler"` tsconfig accept and Node doesn't. `tsx` resolves imports the way the tsconfig does, so `ops` can use core's Drizzle schema, and a renamed column fails at typecheck. Feature manifests would hit the same wall in Phase 4. Node's stripping also rejects anything that generates JavaScript (an `enum` fails with a syntax error), which `tsx` compiles.

From `packages/ops`, confirm `tsx` loads both:

```bash
pnpm exec tsx -e "Promise.all([import('@sidekick/core/db/schema'), import('@sidekick/features-registry')]).then(([s, r]) => console.log(Object.keys(s), r.ALL_FEATURES))"
```

```text
[ 'profiles', 'userFeatureEntitlements' ] []
```

`tsx -e` compiles to CommonJS, so it has no top-level `await`; the `.then` avoids it. Real files in a `"type": "module"` package are ESM and can use it.

---

## Step 3 — Teach Lint What `ops` Is

> **What and why:** `eslint-plugin-boundaries` assigns each file to the first element whose pattern matches. Without a new element, `packages/ops` falls into the `foundation` catch-all, and foundation may import nothing, so its registry import would fail.

In `eslint.config.js`:

1. Add an element above the catch-all:

```js
        { type: 'tooling', pattern: 'packages/eslint-plugin-sidekick' },
        // Privileged scripts (dev seeds, provisioning, break-glass); nothing imports them
        { type: 'ops', pattern: 'packages/ops' },
        // core, ui, copy
        { type: 'foundation', pattern: 'packages/*' },
```

2. Add a policy to `boundaries/dependencies`:

```js
            {
              from: { element: { type: 'ops' } },
              allow: { to: { element: { type: ['foundation', 'registry'] } } },
            },
```

3. Allow `console.log` in the package:

```js
  // ops scripts are command-line tools: their results are their stdout.
  {
    files: ['packages/ops/**/*.ts', 'packages/ops/**/*.tsx'],
    rules: {
      'no-console': ['error', { allow: ['log', 'warn', 'error'] }],
    },
  },
```

- **The policy is one-way.** `ops` may import the registry and the foundation packages. No policy names `ops` as a target, and `default: 'disallow'` does the rest, so an app or package importing `ops` fails lint.
- **`foundation` means `core`, `ui` and `copy`.** Narrowing it to `core` would need captured element names; nothing in `ops` would want React, so it isn't worth it.
- **No `feature` in the allow list.** `ops` reaches features through `ALL_FEATURES`, never one package at a time.
- **The `console.log` exception is config, not an inline `eslint-disable`,** the same policy as lesson 5's `log.ts`. Errors already go to stderr through `console.error`, which every file may use.
- **Rejected: classing `ops` as `app`.** The app policy would let it import feature packages directly, and the config would say it's deployed.
- **What stays banned:** the `**/unsafe` and Supabase admin-client import bans still apply in `ops`. A future script that needs the Supabase admin API (creating a user, say) gets a reviewed per-file exception.

---

## Step 4 — `withPrivilegedDb`

> **What and why:** Every `ops` script needs the same thing: one connection as the privileged role, closed when the work ends, whether it succeeds or throws. That's a wrapper with the same shape as `withRLS`.

Create `packages/ops/src/lib/db.ts`:

```ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@sidekick/core/db/schema';

export type PrivilegedDb = PostgresJsDatabase<typeof schema>;

export type PrivilegedDbHandler<T> = (db: PrivilegedDb) => Promise<T>;

// Runs fn on a connection as the privileged role (DATABASE_DIRECT_URL: postgres,
// bypasses RLS), then closes it. Only ops scripts use this role; the app never does.
export async function withPrivilegedDb<T>(fn: PrivilegedDbHandler<T>): Promise<T> {
  const url = process.env.DATABASE_DIRECT_URL;

  if (!url) {
    throw new Error(
      'Missing DATABASE_DIRECT_URL. Set it in the root .env.local (see .env.example).',
    );
  }

  // Supavisor session mode (port 5432) keeps one Postgres connection per client,
  // so prepared statements work and a script needs only one connection.
  const client = postgres(url, { max: 1 });

  try {
    return await fn(drizzle(client, { schema }));
  } finally {
    await client.end();
  }
}
```

- **`return await` inside `try` is load-bearing.** `return fn(…)` hands back the promise at once, so `finally` runs and `client.end()` closes the connection mid-query. With `await`, `finally` waits for `fn` to settle.
- **Without `client.end()` the script never exits.** postgres.js keeps idle connections open (`idle_timeout: 0` by default), and an open socket keeps Node's event loop alive. The script would print its result and hang.
- **The env var is read when called, not at import** (lesson 6: top level declares). Typecheck, lint and any future test import the file without a database. The error says where to fix it.
- **`max: 1` and no `prepare: false`.** `unsafe.ts` needs `prepare: false` because transaction mode (port 6543) can move you between Postgres connections. Session mode pins one, so prepared statements are safe, and a script runs its queries one at a time.
- **The schema is core's public `@sidekick/core/db/schema`,** the same tables migrations use.
- **Two `type`s, no `interface`:** function types and generic aliases stay `type` (lesson 1). `PrivilegedDbHandler<T>` mirrors `RlsTxHandler<T>`.
- **Rejected: a privileged client exported from core.** Every importer of core could reach a role that bypasses RLS. Inside `ops`, the boundary rule is the guard.

**Prove the boundary.** Plant `packages/features-registry/src/probe.ts`:

```ts
export { withPrivilegedDb } from '../../ops/src/lib/db';
```

```bash
cd packages/features-registry && pnpm lint
```

```text
error  There is no policy allowing dependencies from elements of type "registry" to elements of type "ops"  boundaries/dependencies
```

Delete `probe.ts`. `pnpm --filter @sidekick/ops lint` and `typecheck` pass.

---

## Step 5 — Flags and the Entry Point

> **What and why:** The command's interface is what outlives it, so parse strictly, reject typos before touching the database, and report failures with exit codes a caller can branch on.

Create `packages/ops/src/scripts/entitlements-grant.ts` with the flag parsing and the entry point. Step 6 adds `grantEntitlements` and the imports it needs.

```ts
import { parseArgs } from 'node:util';

import { ALL_FEATURES } from '@sidekick/features-registry';

// Gives one account features: all of them (--all) or the ones named (--feature, repeatable).
// Prints the plan; writes only with --apply.
// Replaced by: an admin entitlements API, called from the admin UI and the CLI.

const USAGE =
  'Usage: entitlements grant --email <email> (--all | --feature <key> [--feature <key>…]) [--apply]';

class UsageError extends Error {}

interface GrantRequest {
  email: string;
  featureKeys: string[];
  apply: boolean;
}

function parseGrantArgs(args: string[]): GrantRequest {
  let email, feature, apply, all;
  try {
    const { values } = parseArgs({
      args: args,
      strict: true,
      options: {
        email: { type: 'string' },
        all: { type: 'boolean', default: false },
        feature: { type: 'string', multiple: true, default: [] },
        apply: { type: 'boolean', default: false },
      },
    });
    ({ email, feature, apply, all } = values);
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }

  if (!email) {
    throw new UsageError('--email is required.');
  }

  // XOR -> false === false -> error | true === true -> error | false === true -> ok | true === false -> ok
  if (all === feature.length > 0) {
    throw new UsageError('Pass either --all or at least one --feature, not both.');
  }

  const knownKeys = ALL_FEATURES.map(({ key }) => key);
  const unknownKeys = feature.filter((key) => !knownKeys.includes(key));

  if (unknownKeys.length > 0) {
    throw new UsageError(
      `Unknown feature key: ${unknownKeys.join(', ')}. Known keys: ${knownKeys.join(', ') || '(none)'}.`,
    );
  }

  return {
    email,
    featureKeys: all ? knownKeys : [...new Set(feature)],
    apply,
  };
}

async function main(args: string[]): Promise<number> {
  let request: GrantRequest;
  try {
    request = parseGrantArgs(args);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`${error.message}\n${USAGE}`);
      return 2;
    }
    throw error;
  }

  return grantEntitlements(request);
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
```

- **`parseArgs` with `strict: true`** is built into Node. An unknown flag (`--aply`) or a stray word is an error, never silently ignored: a misspelled `--apply` must not read as "no `--apply`, carry on".
- **`multiple: true` means repeat the flag:** `--feature a --feature b`. It doesn't take a list: `--feature a b` makes `b` a stray word (strict mode: "Unexpected argument 'b'"), and `--feature a,b` is one value, `"a,b"`. That's why the flag is singular, like `git -c`, `docker -e` and `curl -H`.
- **`parseArgs` has no `required` option.** Its options are `type`, `multiple`, `short` and `default` (`@types/node`'s `ParseArgsOptionDescriptor`). A `required: true` type-checks, because `parseArgs` infers its config through a generic and skips the excess-property check, but does nothing. The `if (!email)` check is what enforces it.
- **The `default`s** make `all` and `feature` never `undefined`. **`let email, feature, apply, all`** declares the names outside `try` so they're usable after it; TypeScript infers each one's type from the destructuring assignment.
- **`UsageError`** turns `parseArgs`' `TypeError` (code `ERR_PARSE_ARGS_UNKNOWN_OPTION`) into "you typed it wrong", so `main` can tell that apart from "something broke". It's a class because `instanceof` needs one.
- **`all === feature.length > 0`** is an XOR: `>` binds tighter than `===`, so both-passed and neither-passed are the two usage errors.
- **The typo guard walks the requested keys.** `feature_key` has no foreign key, so the database would accept `--feature taxla`. Checking each requested key against `ALL_FEATURES` catches it before any connection opens. (An early draft walked `ALL_FEATURES` instead, which let a typo through and would have reported every other registered feature as unknown.)
- **Exit codes:** 2 means usage error (fix the command; nothing ran), 1 means it ran and failed, 0 means success.
- **`process.exitCode`, not `process.exit()`.** `exit()` stops Node at once, even mid-flush of stdout or mid-close of the connection. With `exitCode`, Node exits when its work is done, which is also why a forgotten `client.end()` shows up as a hang.
- **`import.meta.main`** (new in Node 24, and set under `tsx`) is `true` only for the file Node started, so importing this module never runs `main`.

Run each case from `packages/ops` with `pnpm exec tsx src/scripts/entitlements-grant.ts …`, and check `echo $?`:

| Arguments                                                      | Output                                                   | Exit |
| -------------------------------------------------------------- | -------------------------------------------------------- | ---- |
| `--email a@b.c --aply --all`                                   | `Unknown option '--aply'`                                | 2    |
| `--all`                                                        | `--email is required.`                                   | 2    |
| `--email a@b.c --all --feature x`, or neither `--all` nor `--feature` | `Pass either --all or at least one --feature, not both.` | 2    |
| `--email a@b.c --feature x --feature y`                        | `Unknown feature key: x, y. Known keys: (none).`         | 2    |

---

## Step 6 — Grant the Rows

> **What and why:** Find exactly one profile, then write one row per key idempotently. The insert itself must be the guarantee that running it twice equals running it once.

1. Change the imports at the top of the file:

```ts
import { and, eq, inArray } from 'drizzle-orm';
import { parseArgs } from 'node:util';

import { profiles, userFeatureEntitlements } from '@sidekick/core/db/schema';
import { ALL_FEATURES } from '@sidekick/features-registry';

import { withPrivilegedDb } from '../lib/db';
```

2. Add above `main`:

```ts
async function grantEntitlements(request: GrantRequest): Promise<number> {
  const { email, featureKeys, apply } = request;

  return withPrivilegedDb(async (db) => {
    const matches = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email));

    if (matches.length !== 1) {
      console.error(`Unique profile not found for email ${email} (found ${matches.length}).`);
      return 1;
    }

    const userId = matches[0].id;
    console.log(`Account: ${email} (${userId})`);

    if (featureKeys.length === 0) {
      console.log('No features to grant: ALL_FEATURES is empty.');
      return 0;
    }

    if (!apply) {
      const existing = await db
        .select({ featureKey: userFeatureEntitlements.featureKey })
        .from(userFeatureEntitlements)
        .where(
          and(
            eq(userFeatureEntitlements.userId, userId),
            inArray(userFeatureEntitlements.featureKey, featureKeys),
          ),
        );
      const alreadyEnabled = new Set(existing.map((row) => row.featureKey));
      const toGrant = featureKeys.filter((key) => !alreadyEnabled.has(key));

      console.log(`Already enabled: ${[...alreadyEnabled].join(', ') || '(none)'}`);
      console.log(`To enable:       ${toGrant.join(', ') || '(none)'}`);
      console.log('Dry run: nothing written. Add --apply to grant.');
      return 0;
    }

    const granted = await db
      .insert(userFeatureEntitlements)
      .values(featureKeys.map((featureKey) => ({ userId, featureKey })))
      .onConflictDoNothing()
      .returning({ featureKey: userFeatureEntitlements.featureKey });

    console.log(`Granted: ${granted.map(({ featureKey }) => featureKey).join(', ') || '(none)'}`);

    return 0;
  });
}
```

- **Typed against core's schema.** `profiles.email` and `userFeatureEntitlements.featureKey` are checked against the real columns: a rename is a `tsc` error, not a Postgres error.
- **Exactly one profile.** `profiles.email` has no unique constraint (Supabase Auth keeps emails unique; our table doesn't promise it), so "one" is checked, not assumed. Zero means you haven't signed up in this database; more than one is a data problem a script shouldn't guess at. The match is exact, so type the email as Supabase stored it.
- **The lookup runs even with nothing to grant.** With `ALL_FEATURES` empty, `--all` still proves the connection, the role and the email, which is what lets you run it against dev today.
- **`--apply` is one statement: `INSERT … ON CONFLICT DO NOTHING RETURNING`.** The composite primary key `(user_id, feature_key)` from lesson 3 turns a duplicate into a conflict, `onConflictDoNothing()` skips it, and `RETURNING` reports only the rows actually inserted. A second run returns nothing: "Granted: (none)". That's idempotence, and it holds even if another run inserts the same row at the same moment.
- **No pre-check on `--apply` (Pratik's simplification).** The first draft read the existing rows before inserting, to print what would change. Pratik asked whether that was needed, and it wasn't: the insert's own result says what changed. The read moved into the dry run, which must not write and so can't ask the insert. `--apply` is one query, with no gap between a read and a write to reason about.
- **The dry run is a forecast.** If someone grants the same feature between your dry run and your `--apply`, "To enable" was wrong; `--apply` still reports what really happened.
- **The empty-list early return is load-bearing:** Drizzle throws if `.values()` gets an empty array.
- **No transaction.** Each statement stands alone and the insert is idempotent. In `withRLS` the transaction is what scopes `app.current_user_id`; here there's nothing to scope.
- **Rejected: a dry run as an insert inside a rolled-back transaction.** It would forecast exactly, but it takes row locks and needs a throw-to-roll-back trick.

---

## Step 7 — The Command

> **What and why:** One package script that loads the environment and runs the file, and one root shortcut that preserves the exit code.

1. In `packages/ops/package.json`, add to `scripts`:

```json
    "entitlements:grant": "dotenv -e ../../.env.local -- tsx src/scripts/entitlements-grant.ts"
```

2. In the root `package.json`, after `db:migrate`:

```json
    "ops:entitlements:grant": "pnpm -C packages/ops entitlements:grant",
```

- **`dotenv -e ../../.env.local --`** is how Sidekick scripts load env ([[06-decisions/technical/dotenv-cli|dotenv-cli decision]]); core's `db:*` scripts do the same. The path is relative to `packages/ops`, where pnpm runs the package's scripts. Tested behaviour: a missing file is skipped (our own "Missing DATABASE_DIRECT_URL…" error takes over), a variable set in the shell beats the file (so a later break-glass run can point elsewhere without editing files), an empty value (`DATABASE_DIRECT_URL=`) also beats the file, and the script's exit code comes back unchanged. Node's own `--env-file-if-exists`, passed as a `tsx` flag, behaves the same; the lesson first used it, then switched to match the decision.
- **`pnpm -C packages/ops`, not `--filter`.** `--filter` is a recursive run, built for many packages, and reports any failure as exit 1 with an extra `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` block. `-C` (`--dir`) runs pnpm as if from that folder, so the script's 2 stays 2:

| Command                                                  | Exit for a usage error |
| -------------------------------------------------------- | ---------------------- |
| `pnpm entitlements:grant --all` (in `packages/ops`)      | 2                      |
| `pnpm --filter @sidekick/ops entitlements:grant --all`   | 1                      |
| `pnpm -C packages/ops entitlements:grant --all`          | 2                      |

- **Root scripts exist only at the root.** Run from `packages/ops`, `pnpm ops:entitlements:grant` finds no such script there, falls back to running it as a shell command, and fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL … Command "ops:entitlements:grant" not found`. Inside the package, use the local name, `pnpm entitlements:grant`.
- **The `ops:` prefix** marks a privileged tool wherever it's seen; the rest is noun and verb, so a later `pnpm ops entitlements grant` maps one-to-one.
- **No Turbo task.** Turbo runs tasks across packages and caches them; this runs in one package and must never be cached.

---

## Step 8 — Run It Against Dev

> **What and why:** Prove each path against the real database, including the write and the second write, then leave the database as you found it.

From the repo root, with your sign-up email:

| Run                                                                     | Output                                                                         | Exit |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- |
| `pnpm ops:entitlements:grant --email <you> --all`                       | `Account: <you> (<uuid>)`, `No features to grant: ALL_FEATURES is empty.`      | 0    |
| `pnpm ops:entitlements:grant --email nobody@example.com --all`          | `Unique profile not found for email nobody@example.com (found 0).`             | 1    |
| `DATABASE_DIRECT_URL= pnpm ops:entitlements:grant --email <you> --all`  | `Missing DATABASE_DIRECT_URL. Set it in the root .env.local (see .env.example).` | 1    |

Then add a temporary manifest to `ALL_FEATURES` in `packages/features-registry/src/index.ts`:

```ts
export const ALL_FEATURES: readonly FeatureManifest[] = [
  { key: 'seed-probe', name: 'Seed probe', description: 'Temporary, for lesson 7' },
];
```

| Run                                   | Output                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `--email <you> --all`                 | `Already enabled: (none)`, `To enable: seed-probe`, `Dry run: nothing written…` |
| `--email <you> --all --apply`         | `Granted: seed-probe`                                                        |
| `--email <you> --all --apply` again   | `Granted: (none)`                                                            |
| `--email <you> --feature seed-probe`  | `Already enabled: seed-probe`, `To enable: (none)`                           |

Clean up: `git checkout -- packages/features-registry/src/index.ts`, and in the Supabase SQL editor:

```sql
delete from user_feature_entitlements where feature_key = 'seed-probe';
```

**Disabling a feature** is the same `DELETE` with a `user_id` and the key. There's no `revoke` command yet: a row's presence is the entitlement, and the privileged role deletes it. A `revoke` belongs with the next `ops` command, or with the admin API.

**Prove the role matters.** Point the command at the runtime role:

```bash
(set -a; source .env.local; set +a; DATABASE_DIRECT_URL="$DATABASE_URL" pnpm -s ops:entitlements:grant --email <you> --all)
```

```text
Unique profile not found for email <you> (found 0).
```

`app_runtime` can't even see your profile: with no `app.current_user_id`, RLS hides every row. A direct insert as `app_runtime` (`psql "$DATABASE_URL" -c "insert into user_feature_entitlements …"`) fails with `permission denied for table user_feature_entitlements`, from lesson 3's `REVOKE`.

---

## Step 9 — Fix `.env.example`

> **What and why:** The file lists who uses each connection. One line was stale since lesson 6, and this lesson made another one false.

```bash
# Runtime connection — used by the app (packages/core/src/db/unsafe.ts).
```

```bash
# Privileged connection — used only by drizzle-kit (pnpm db:generate / db:migrate)
# and the ops scripts (packages/ops, pnpm ops:…).
```

- Since lesson 6, `db/index.ts` only re-exports `withRLS`; `getUnsafeDb()` in `db/unsafe.ts` creates the client.
- "Migration connection, used only by drizzle-kit" stopped being true when `ops` became the privileged role's second user. `.env.example` is where you'd look before handing that URL to anything.

---

## Step 10 — Verify Like CI and Ship

> **What and why:** CI has no `.env.local`, no secrets and no cache. Run what it runs, the way it runs it.

```bash
pnpm install --frozen-lockfile
pnpm prettier:check
env -u DATABASE_URL -u DATABASE_DIRECT_URL -u NEXT_PUBLIC_SUPABASE_URL \
  -u NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY -u SUPABASE_SECRET_KEY -u NEXT_PUBLIC_APP_URL \
  pnpm turbo lint typecheck build test --force
pnpm test:integration
```

Expected: 23/23 Turbo tasks, including `@sidekick/ops#lint` and `@sidekick/ops#typecheck`, and 17 integration tests. Nothing CI builds or tests imports `DATABASE_DIRECT_URL`: `ops` has no `build` or `test`, and lint and typecheck never run it.

Commit with the editor (`git commit`, no `-m`), push, and open the PR:

```bash
git add .env.example eslint.config.js package.json pnpm-lock.yaml packages/ops
git commit
git push -u origin feature/P2L7-ops
gh pr create --base main --fill
```

Commit title: `feat(ops): add the ops package with entitlements grant`. Put the dev runs from Step 8 in the PR description.

---

## What you have now

- `packages/ops`, the home for privileged scripts, which may import the registry and core, and which nothing may import.
- `withPrivilegedDb`, one connection as the role that bypasses RLS, always closed after use.
- `pnpm ops:entitlements:grant --email <email> (--all | --feature <key>…) [--apply]`: a dry run by default, one idempotent insert with `--apply`, typos rejected before the database, exit codes 0, 1 and 2.
- Proof against dev that a second `--apply` grants nothing and that `app_runtime` can do none of it.

Next: lesson 8, the Phase 2 close-out ([[04-plans/phase-2-core-infrastructure-api-guard-feature-system#Lessons|plan]]).
