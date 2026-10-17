---
publish: true
id: build.pre-2
title: Pre-2 walkthrough
created: 2026-10-16
updated: 2026-10-17
kind: guidance
version: 1.1.1
tags:
   - build
   - walkthrough
   - pre-2
   - rls
   - supabase
   - drizzle
   - postgresql
   - testing
   - eslint
status: completed
applies_to:
   - "[[04-plans/pre-2-foundation-hardening-complete]]"
---

# Pre-2 Walkthrough — Foundation Hardening

This guide walks through reproducing Pre-2 step by step. It assumes you have completed Phase 1.1: `app_runtime` exists, migrations `0000`–`0003` are applied, `withRLS` wraps queries in a transaction, and `DATABASE_URL` connects as `app_runtime` through the transaction pooler.

Pre-2 makes that foundation reproducible on a fresh database, proves it with automated tests, and enforces its boundaries with tools — before Phase 2 writes the first API guard.

Every step explains what you are doing and why. Follow the reasoning, not just the commands.

---

## Task Pre-2.1 — Create `app_runtime` in a Migration

> **What and why:** `app_runtime` was created by hand in the SQL editor, so a fresh database fails at migration `0001`'s first `GRANT … TO app_runtime`. The migration must create the role itself — without committing a password.

Drizzle runs every migration whose journal `when` is newer than the newest one already applied; it never re-runs an applied migration. So a block added to the top of `0001` runs on fresh databases and is skipped everywhere `0001` already ran — where the role already exists. Editing an applied migration is normally forbidden because databases could diverge; this block is a no-op wherever it would not run, so none can.

1. Add this block to the top of `packages/core/src/db/migrations/0001_app_runtime_grants.sql`, above the first `GRANT`:

```sql
-- Create the app_runtime role if it does not exist yet.
--
-- Deliberately breaks the rule of not editing applied migrations: without this block, a fresh database fails at the GRANTs below because nothing creates the role.
-- Safe because Drizzle never re-runs an applied migration, and on any database where the role already
-- exists this block does nothing — so no two databases can end up different. On a fresh database it creates
-- the role before the GRANTs below need it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime
      -- create role without login capability to avoid committing a password to source control.
      -- admin can enable login by setting a password manually before setting up connection strings in the app.
      -- ALTER ROLE app_runtime WITH LOGIN PASSWORD '<strong-password>';
      NOLOGIN
      NOSUPERUSER
      NOBYPASSRLS
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;
```

PostgreSQL has no `CREATE ROLE IF NOT EXISTS`, so a `DO` block (PL/pgSQL) checks `pg_roles` first. `NOLOGIN` means a fresh database gets the whole permission boundary but nobody can connect as `app_runtime` until a person sets a password — fail closed.

2. Do not touch `meta/_journal.json`: changing `0001`'s `when` would make Drizzle treat it as new.

3. On every new database, after `pnpm db:migrate`, enable login once in the Supabase SQL editor — never in Git:

```sql
ALTER ROLE app_runtime WITH LOGIN PASSWORD 'your-strong-password';
```

---

## Task Pre-2.2 — Configure `postgres.js` for the Transaction Pooler

> **What and why:** `DATABASE_URL` uses Supavisor's transaction mode (port 6543), which can hand each transaction a different Postgres connection. A named prepared statement lives on one Postgres connection, so `postgres.js` would later reference a statement the new connection never saw.

1. Rename the raw client file (Pre-2.4 builds on this name):

```bash
git mv packages/core/src/db/index.ts packages/core/src/db/unsafe.ts
```

2. Create the client with `prepare: false`:

```ts
const client = postgres(url, { prepare: false });
```

> **Do not add `max_pipeline: 0`.** It stops `postgres.js` from ever reserving a connection for a transaction, so every transaction — including `withRLS` — fails with `UNSAFE_TRANSACTION`.

The full file appears in Pre-2.4.

---

## Task Pre-2.3 — Version the Profile Trigger and Add the Foreign Key

> **What and why:** The trigger that creates a `profiles` row on signup existed only in the live database, and `profiles.id` had no foreign key to `auth.users`. A fresh database got neither.

### Add the foreign key through the Drizzle schema

Declaring it in TypeScript keeps Drizzle's snapshot in sync with the database; a hand-written constraint would be invisible to future `drizzle-kit generate` runs.

1. Update `packages/core/src/db/schema/profiles.ts`:

```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';

export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

`drizzle-orm/supabase` ships a definition of `auth.users`, so you can reference it without defining that table yourself. `onDelete: 'cascade'` lets account deletion erase the profile.

2. Generate the migration:

```bash
pnpm --filter @sidekick/core db:generate --name=profiles_auth_users_fk
```

`0004_profiles_auth_users_fk.sql` should contain exactly one statement:

```sql
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
```

### Version the trigger as a custom migration

3. Create an empty migration for hand-written SQL:

```bash
pnpm --filter @sidekick/core db:generate --custom --name=profile_creation_trigger
```

4. Replace the contents of `0005_profile_creation_trigger.sql`:

```sql
-- Creates a public.profiles row whenever Supabase Auth creates a user.
--
-- Originally created by hand in the Supabase SQL editor; versioned here so
-- fresh databases get it. Idempotent: on databases that already have the
-- function and trigger, this replaces them with identical behavior plus the
-- search_path fix below.
--
-- SECURITY DEFINER: runs as the function owner (postgres), not as Supabase
-- Auth's role. The insert succeeds despite FORCE ROW LEVEL SECURITY on
-- profiles only because postgres has BYPASSRLS — no user context exists
-- during signup.
--
-- search_path = '': a privileged function must not resolve names through a
-- caller-controlled search path. Every object is therefore schema-qualified.
--
-- Known limit: auth.users.email is nullable but profiles.email is NOT NULL,
-- so phone or anonymous sign-ins would fail here. Email signup only for now.
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_new_user();
```

`supabase_auth_admin` — the role that inserts into `auth.users` — has neither `INSERT` on `public.profiles` nor `BYPASSRLS`. `SECURITY DEFINER` runs the function as its owner instead. Because that borrows privilege, `search_path` is pinned to `''` and every name is schema-qualified.

5. Before applying, confirm no orphans would break the foreign key (in the Supabase SQL editor):

```sql
SELECT count(*) FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
```

It must return `0`. Then apply:

```bash
pnpm --filter @sidekick/core db:migrate
```

---

## Task Pre-2.4 — Make `withRLS` the Only Public Database Entry Point

> **What and why:** The raw Drizzle client was exported as freely as `withRLS`. As `app_runtime` it fails closed (zero rows), but a forgotten `withRLS` returns silently empty results, and the admin client bypasses RLS entirely. Make the safe path the only easy one.

1. Install `server-only`:

```bash
pnpm --filter @sidekick/core add server-only
```

2. `packages/core/src/db/unsafe.ts`:

```ts
import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('Missing DATABASE_URL environment variable');
}

// DATABASE_URL points at Supavisor in transaction mode (port 6543), which does
// not keep you on one Postgres connection between transactions, so named
// prepared statements must be off (Supabase requirement).
// Do NOT set max_pipeline: 0 — postgres.js then never reserves a connection
// for a transaction, and every transaction (including withRLS) fails with
// UNSAFE_TRANSACTION. Caught by tests/integration/rls.test.ts.
const client = postgres(url, { prepare: false });

// UNSAFE: queries on this client run without a user context. As app_runtime
// they fail closed (RLS returns zero rows), but nothing ties them to a caller.
// Only for building safe wrappers such as withRLS — ESLint enforces this, and
// the package `exports` map deliberately does not expose this file.
export const unsafeDb = drizzle(client, { schema });
```

3. `packages/core/src/db/rls.ts`:

```ts
import { sql } from 'drizzle-orm';

import { unsafeDb } from './unsafe';

export type RlsTx = Parameters<Parameters<typeof unsafeDb.transaction>[0]>[0];

export async function withRLS<T>(userId: string, fn: (tx: RlsTx) => Promise<T>): Promise<T> {
  return unsafeDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
```

4. A new `packages/core/src/db/index.ts`:

```ts
// Safe entry point: every user-data query runs inside withRLS.
export { withRLS, type RlsTx } from './rls';
```

5. Add `import 'server-only';` as the first line of `packages/core/src/supabase/admin.ts`.

6. In `packages/core/package.json` `exports`, remove `"./db/rls"`. Keep `"./db"` and `"./db/schema"`, and never add `unsafe`: a path missing from `exports` cannot be imported from another package at all.

7. Ban the raw and admin clients in the root `eslint.config.js`. Define the bans once, above `export default`:

```js
// `paths` match an import's exact text; `patterns` take globs. Both match the
// text as written, not the resolved file — so `**/unsafe` (not `**/db/unsafe`)
// is needed to also catch `./unsafe` and `../unsafe` from inside db/.
const adminClientMessage =
  'The Supabase admin client bypasses RLS. If this is truly needed, add a reviewed per-file exception in eslint.config.js.';

const adminClientPathBan = {
  name: '@sidekick/core/supabase/admin',
  message: adminClientMessage,
};

const adminClientPatternBan = {
  group: ['**/supabase/admin'],
  message: adminClientMessage,
};

const unsafeDbPatternBan = {
  group: ['**/unsafe'],
  message:
    'The raw database client runs queries without a user context. Use withRLS from "@sidekick/core/db" instead.',
};
```

Extend the existing `no-restricted-imports` block (which already bans CSS-in-JS via a shared `cssInJsBans` array), and add the one-file exception after it:

```js
  {
    // Restricted imports across the whole codebase:
    // - CSS-in-JS libraries (use CSS modules)
    // - the raw database client (use withRLS) and the RLS-bypassing admin client
    // Flat config replaces, not merges, a rule's options per block — any later
    // block that sets no-restricted-imports must repeat every ban it keeps.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...cssInJsBans, adminClientPathBan],
          patterns: [unsafeDbPatternBan, adminClientPatternBan],
        },
      ],
    },
  },
  {
    // The single file allowed to import the raw database client: withRLS is
    // built on it. Every other ban still applies here.
    files: ['packages/core/src/db/rls.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...cssInJsBans, adminClientPathBan],
          patterns: [adminClientPatternBan],
        },
      ],
    },
  },
```

8. Verify the bans fire:

```bash
printf "import '../db/unsafe';\nimport './unsafe';\nimport '../supabase/admin';\n" | pnpm exec eslint --stdin --stdin-filename packages/core/src/api/x.ts
```

All three imports must be reported.

---

## Task Pre-2.5 — Prove RLS with an Integration Test

> **What and why:** Every earlier check inspected configuration. This test runs the real `withRLS` against a real database built from the migrations alone, as `app_runtime`, and proves isolation and fail-closed behavior on every run.

### Prerequisites

PostgreSQL 17 tools — the same major version as Supabase:

```bash
brew install postgresql@17
```

### The throwaway database

1. `packages/core/tests/supabase-stub.sql` — stand-ins for what Supabase provides:

```sql
-- Stand-ins for the Supabase-managed pieces our migrations depend on, so the
-- RLS proof test can run against a throwaway local Postgres. Mirrors what we
-- verified on the live project (2026-10-14): postgres is NOT a superuser but
-- has CREATEROLE and BYPASSRLS; supabase_auth_admin owns auth.users and has
-- neither. Run as the throwaway cluster's superuser, before migrations.

-- Supabase's migration role
CREATE ROLE postgres LOGIN CREATEROLE BYPASSRLS;
ALTER DATABASE postgres OWNER TO postgres;  -- lets it create objects in public

-- Supabase Auth's role and its users table (only the columns we use)
CREATE ROLE supabase_auth_admin LOGIN NOBYPASSRLS;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
ALTER TABLE auth.users OWNER TO supabase_auth_admin;

-- Same rights Supabase gives postgres, so migrations 0004/0005 can add the
-- foreign key and the trigger
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT REFERENCES, TRIGGER ON auth.users TO postgres;
```

2. `packages/core/tests/with-test-db.sh` — builds the database, runs a command, deletes the database:

```bash
#!/usr/bin/env bash
# Runs a command against a throwaway Postgres built from our migrations:
#   tests/with-test-db.sh <command...>
# Starts a temporary cluster, applies the Supabase stand-ins and all
# migrations, enables app_runtime login, exports connection URLs, runs the
# command, then deletes the cluster — even if the command fails.
# Requires initdb, pg_ctl and psql of the PostgreSQL major version in PG_MAJOR.
set -euo pipefail

# macOS Postgres refuses to start without a locale; Linux (CI) has a usable default
if [[ "$(uname)" == "Darwin" ]]; then
  export LC_ALL="${LC_ALL:-en_US.UTF-8}"
fi

# PostgreSQL major version must match production (Supabase). Bump in one place
# here — and in .github/workflows/ci.yml — when Supabase upgrades.
PG_MAJOR=17

# Use that version's tools from the usual install locations if present
# (Homebrew on Apple Silicon or Intel, Debian/Ubuntu packages), else PATH.
for dir in "/opt/homebrew/opt/postgresql@$PG_MAJOR/bin" \
           "/usr/local/opt/postgresql@$PG_MAJOR/bin" \
           "/usr/lib/postgresql/$PG_MAJOR/bin"; do
  if [[ -x "$dir/initdb" ]]; then
    PATH="$dir:$PATH"
    break
  fi
done

found="$(initdb --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
if [[ "$found" != "$PG_MAJOR" ]]; then
  echo "with-test-db.sh: PostgreSQL $PG_MAJOR tools required (found: ${found:-none})." >&2
  echo "  macOS: brew install postgresql@$PG_MAJOR" >&2
  exit 1
fi

PORT="${TEST_DB_PORT:-54329}"            # avoids a local Postgres on 5432
HERE="$(cd "$(dirname "$0")" && pwd)"
CORE="$(cd "$HERE/.." && pwd)"
DATA="$(mktemp -d)"

cleanup() {
  pg_ctl -D "$DATA" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$DATA"
}
trap cleanup EXIT

url() { echo "postgresql://$1@127.0.0.1:$PORT/postgres"; }

# Local-only cluster: trust auth, TCP on 127.0.0.1, no Unix socket
initdb -D "$DATA" -U admin --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" \
  -l "$DATA/server.log" -w start >/dev/null

psql "$(url admin)" -v ON_ERROR_STOP=1 -q -f "$HERE/supabase-stub.sql"
(cd "$CORE" && DATABASE_DIRECT_URL="$(url postgres)" drizzle-kit migrate >/dev/null)

# The out-of-band step from the app_runtime decision note
psql "$(url admin)" -v ON_ERROR_STOP=1 -q \
  -c "ALTER ROLE app_runtime WITH LOGIN PASSWORD 'test-only'"

export DATABASE_URL="postgresql://app_runtime:test-only@127.0.0.1:$PORT/postgres"
export TEST_AUTH_DATABASE_URL="$(url supabase_auth_admin)"

"$@"
```

`"$@"` must be the last line: an `export` only affects commands that run after it.

3. Make it executable and check it:

```bash
chmod +x packages/core/tests/with-test-db.sh
```

```bash
pnpm --filter @sidekick/core exec tests/with-test-db.sh bash -c 'psql "$DATABASE_URL" -qtAc "select current_user, (select count(*) from public.profiles)"'
```

Expected output: `app_runtime|0`.

### Vitest

4. Install Vitest:

```bash
pnpm --filter @sidekick/core add -D vitest
```

5. `packages/core/tests/stubs/server-only.ts`:

```ts
// Test-only stand-in for the `server-only` package. The real package throws
// unless it's resolved with Next.js's "react-server" condition, which a test
// runner doesn't use. vitest.config.ts points `server-only` here instead.
export {};
```

6. `packages/core/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
```

7. Type-check tests but keep them out of the build. `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "tests", "drizzle.config.ts", "vitest.config.ts"]
}
```

New `packages/core/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["src"],
  "exclude": ["src/**/*.test.{ts,tsx}"]
}
```

8. Add `'**/vitest.config.*'` to the `devDependencies` allowlist of `import/no-extraneous-dependencies` in `eslint.config.js`.

### The test

9. `packages/core/tests/integration/rls.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withRLS } from '../../src/db';
import { profiles } from '../../src/db/schema';

// Proves row-level security on the runtime connection. Runs inside
// tests/with-test-db.sh, which builds a fresh database from our
// migrations and exports these connection URLs:
// - DATABASE_URL: app_runtime, the role the app and withRLS use
// - TEST_AUTH_DATABASE_URL: supabase_auth_admin, which creates users the way
//   Supabase Auth does

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set; run this test through tests/with-test-db.sh`);
  }

  return value;
}

const authDb = postgres(requireEnv('TEST_AUTH_DATABASE_URL'), { max: 1 });
const runtimeDb = postgres(requireEnv('DATABASE_URL'), { max: 1 });

const userA = randomUUID();
const userB = randomUUID();

beforeAll(async () => {
  await authDb`INSERT INTO auth.users
      (id, email)
   VALUES
      (${userA}, 'a@example.com'),
      (${userB}, 'b@example.com')
   `;
});

afterAll(async () => {
  await authDb.end();
  await runtimeDb.end();
});

describe('RLS on profiles', () => {
  it.each([
    ['userA', userA],
    ['userB', userB],
  ])('shows %s only their own profile', async (userKey, userId) => {
    const rows = await withRLS(userId, (tx) => tx.select().from(profiles));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(userId);
  });

  it('returns zero rows without a user context when run as app_runtime', async () => {
    const userProfilesVisibleToUserA = await withRLS(userA, (tx) => tx.select().from(profiles));
    expect(userProfilesVisibleToUserA).toHaveLength(1);

    const rows = await runtimeDb`SELECT 1 FROM profiles`;
    expect(rows).toHaveLength(0);
  });
});
```

Users are created through `auth.users` as `supabase_auth_admin`, so the trigger from Pre-2.3 is tested too. The first assertion of the last test guards against a vacuous pass: "zero rows" means nothing unless rows exist.

### Wire it up

10. `packages/core/package.json` scripts:

```json
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run src --passWithNoTests",
    "test:integration": "tests/with-test-db.sh vitest run tests/integration"
```

11. Root `package.json` scripts:

```json
    "test": "turbo test",
    "test:integration": "turbo test:integration"
```

12. `turbo.json` tasks — tests read source, not build output, so `test` has no dependencies; the security proof must really run every time, so it is never cached:

```json
    "test": {},
    "test:integration": {
      "cache": false
    }
```

13. Run it:

```bash
pnpm test && pnpm test:integration && pnpm build
```

Expected: `Tests  3 passed (3)`.

14. Prove the test can fail: temporarily replace `${userId}` in `rls.ts`'s `set_config` with `${'00000000-0000-0000-0000-000000000000'}`, run `pnpm test:integration`, confirm both user cases fail, then undo.

---

## Task Pre-2.6 — Add CI

> **What and why:** Run every check, including the RLS proof, on every push and pull request — on pinned versions, so CI behaves the same next month.

1. `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

# A newer push to the same branch cancels the older, still-running check
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

# Read-only token: CI only needs to check out code
permissions:
  contents: read

jobs:
  checks:
    # Pinned, not ubuntu-latest: -latest moves to new images silently, and the
    # preinstalled tools inside it (Node, PostgreSQL, …) change with it
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc

      # pnpm version and hash come from package.json "packageManager"
      - name: Enable Corepack
        run: corepack enable

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - run: pnpm prettier:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test
      # Production (Supabase) runs PostgreSQL 17; the runner image ships 16.
      # Install 17's tools from the official PostgreSQL apt repository (PGDG).
      # tests/with-test-db.sh finds them in /usr/lib/postgresql/17/bin.
      - name: Install PostgreSQL 17 tools
        run: |
          sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
          sudo apt-get install -y --no-install-recommends postgresql-17
      - run: pnpm test:integration
```

`.nvmrc` is created in Pre-2.12. CI needs no secrets: `next build` succeeds without environment variables, and the integration test brings its own database.

2. Push and open the repository's **Actions** tab. The job named `checks` must pass; its name is the status check Pre-2.13 requires.

---

## Task Pre-2.7 — Reconcile `.env.example`

> **What and why:** `.env.example` still used Supabase's old key names and lacked `DATABASE_DIRECT_URL`, so a new environment following it got a broken app and broken migrations.

1. Replace the Supabase section of `.env.example`:

```bash
# Found in: Supabase Dashboard → Connect (project URL, keys, connection strings)

# Project URL. Public.
# https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_URL=

# Publishable key (sb_publishable_…). Public by design; replaces the legacy
# anon key. RLS, not this key, protects user data.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Secret key (sb_secret_…). SERVER-ONLY — bypasses RLS. Replaces the legacy
# service_role key. Never commit it; never give it a NEXT_PUBLIC_ prefix.
SUPABASE_SECRET_KEY=

# Runtime connection — used by the app (packages/core/src/db/unsafe.ts).
# Role: app_runtime (non-superuser, RLS enforced). SERVER-ONLY.
# Supavisor transaction mode, port 6543: requires prepare: false.
# postgresql://app_runtime.<project-ref>:<app_runtime-password>@<region>.pooler.supabase.com:6543/postgres
DATABASE_URL=

# Migration connection — used only by drizzle-kit (pnpm db:generate / db:migrate).
# Role: postgres (schema owner, bypasses RLS). SERVER-ONLY; never set in Vercel.
# Supavisor session mode, port 5432 — despite the name, NOT Supabase's "Direct
# connection" (db.<project-ref>.supabase.co:5432), which is IPv6-only unless the
# IPv4 add-on is enabled. Session mode keeps one Postgres connection per client,
# so it is safe for migrations.
# postgresql://postgres.<project-ref>:<database-password>@<region>.pooler.supabase.com:5432/postgres
DATABASE_DIRECT_URL=
```

Next.js copies every `NEXT_PUBLIC_*` value into the browser bundle — never give a secret or a database URL that prefix.

2. Check that every `process.env.X` read in `apps/` and `packages/` appears in the file with the same name.

---

## Task Pre-2.8 — Enforce Package Boundaries

> **What and why:** All packages shared one boundary type, so nothing stopped `core` from importing a feature package. Model the documented direction — apps → registry → features → foundation — as separate element types.

1. Fix `packages/copy` so it is linted and type-checked at all. In its `tsconfig.json`, change `extends` to `"../../tsconfig.base.json"`, and add scripts to its `package.json`:

```json
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
```

2. In `eslint.config.js`, add `'packages/features/*/tsconfig.json'` to the import resolver's `project` list. Without it, imports inside feature packages cannot be resolved, so boundaries cannot classify them.

3. Replace the elements and the deprecated `boundaries/element-types` rule, and set the root path. Element patterns match relative to `boundaries/root-path`, which defaults to the current directory — but `pnpm lint` runs ESLint from inside each package (`cwd = packages/core`), where every file would be "unknown" and **nothing would be enforced**:

```js
      // Element patterns are matched relative to this root. `pnpm lint` runs
      // ESLint from inside each package (cwd = packages/core, …), where the
      // default root (cwd) makes every file "unknown" and boundaries silently
      // enforces nothing — so the repo root is set explicitly.
      'boundaries/root-path': import.meta.dirname,
      // A file belongs to the first element whose pattern matches, so specific
      // patterns come before the catch-all `packages/*`.
      'boundaries/elements': [
        { type: 'app', pattern: 'apps/*' },
        { type: 'feature', pattern: 'packages/features/*' },
        { type: 'registry', pattern: 'packages/features-registry' },
        { type: 'tooling', pattern: 'packages/eslint-plugin-sidekick' },
        // core, ui, copy
        { type: 'foundation', pattern: 'packages/*' },
      ],
```

```js
      // Dependency direction: apps → registry → features → foundation.
      // Everything not allowed here is disallowed. Imports within one package
      // are never checked. Foundation packages (core, ui, copy) and tooling
      // import no other workspace package; loosen deliberately with a new rule.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: { type: 'app' },
              allow: { to: { type: ['feature', 'registry', 'foundation'] } },
            },
            {
              from: { type: 'registry' },
              allow: { to: { type: ['feature', 'foundation'] } },
            },
            {
              from: { type: 'feature' },
              allow: { to: { type: 'foundation' } },
            },
          ],
        },
      ],
```

4. Verify **from inside the package**, the way `pnpm lint` runs — a probe run from the repo root passes even when the root path is wrong. This must report `boundaries/dependencies`:

```bash
cd packages/core && printf "import '../../copy/src/app';\n" | pnpm exec eslint --stdin --stdin-filename src/x.ts; cd ../..
```

---

## Task Pre-2.9 — Guard Every Request Entry Point

> **What and why:** The proxy does not authenticate `/api` routes; `withApiGuard` will. A route handler exported without it is public. Next.js can also serve requests through Server Actions, the Pages Router, and a changed `pageExtensions` — so close those too, then verify what the build actually serves.

### A custom rule for route handlers

1. `packages/eslint-plugin-sidekick/src/rules/require-api-guard.ts`:

```ts
import type { Rule, Scope } from 'eslint';
import type * as ESTree from 'estree';

/**
 * Requires every Next.js App Router route handler to be wrapped in withApiGuard.
 *
 * The proxy deliberately does not authenticate /api routes; withApiGuard is
 * the only place authentication, feature entitlement, API-key scopes and the
 * RLS context are applied. A handler exported any other way is publicly
 * reachable, so this rule fails closed: anything it cannot verify is reported.
 *
 * Allowed:
 *   export const GET = withApiGuard(handler, options);
 *   (withApiGuard must be an imported binding, not a local look-alike)
 *
 * Reported:
 *   export async function GET() {}           function declaration
 *   export const GET = handler;               not wrapped
 *   export let GET = withApiGuard(handler);   reassignable
 *   export { handler as GET };                cannot be verified
 *   export * from './handlers';               cannot be verified
 *
 * Non-method exports (e.g. `export const dynamic = 'force-dynamic'`) are ignored.
 * Wired up only for app/**\/route.* files via eslint.config.js.
 */
const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const GUARD_NAME = 'withApiGuard';

function isImportedGuardCall(
  init: ESTree.Expression | null | undefined,
  scope: Scope.Scope,
): boolean {
  if (init?.type !== 'CallExpression') return false;
  if (init.callee.type !== 'Identifier' || init.callee.name !== GUARD_NAME) return false;

  let current: Scope.Scope | null = scope;
  while (current) {
    const variable = current.set.get(GUARD_NAME);
    if (variable) return variable.defs.some((def) => def.type === 'ImportBinding');
    current = current.upper;
  }
  return false;
}

export const requireApiGuard: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: `Require route handlers to be exported as \`export const METHOD = ${GUARD_NAME}(...)\`.`,
    },
    messages: {
      notGuarded: `Route handler {{method}} must be exported as \`export const {{method}} = ${GUARD_NAME}(handler, options)\`, with ${GUARD_NAME} imported. Unguarded API routes are publicly reachable.`,
      unverifiable:
        'Route files may only export handlers as `export const METHOD = withApiGuard(...)`. This export form cannot be verified as guarded.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      ExportAllDeclaration(node: ESTree.ExportAllDeclaration) {
        context.report({ node, messageId: 'unverifiable' });
      },
      ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
        for (const specifier of node.specifiers) {
          const exported =
            specifier.exported.type === 'Identifier'
              ? specifier.exported.name
              : String(specifier.exported.value);
          if (HTTP_METHODS.has(exported)) {
            context.report({ node: specifier, messageId: 'unverifiable' });
          }
        }

        const declaration = node.declaration;
        if (!declaration) return;

        if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
          const method = declaration.id?.name;
          if (method && HTTP_METHODS.has(method)) {
            context.report({ node: declaration, messageId: 'notGuarded', data: { method } });
          }
          return;
        }

        if (declaration.type !== 'VariableDeclaration') return;

        const scope = context.sourceCode.getScope(node);
        for (const declarator of declaration.declarations) {
          if (declarator.id.type !== 'Identifier') continue;
          const method = declarator.id.name;
          if (!HTTP_METHODS.has(method)) continue;

          const guarded =
            declaration.kind === 'const' && isImportedGuardCall(declarator.init, scope);
          if (!guarded) {
            context.report({ node: declarator, messageId: 'notGuarded', data: { method } });
          }
        }
      },
    };
  },
};
```

2. Register it in `packages/eslint-plugin-sidekick/src/index.ts` as `'require-api-guard': requireApiGuard`.

3. Test the rule itself with ESLint's `RuleTester` running under Vitest:

```bash
pnpm --filter @sidekick/eslint-plugin-sidekick add -D vitest
```

Add `"test": "vitest run"` to the plugin's `package.json`, and create `src/rules/require-api-guard.test.ts` with `RuleTester.describe = describe`, `RuleTester.it = it` and `RuleTester.afterAll = afterAll`. Cover every allowed form and every bypass listed in the rule's comment — a security rule that silently accepts a bypass is worse than none.

### Ban the other entry points

4. In `eslint.config.js`, define three selectors above `export default`:

```js
// Composed per block: flat config replaces no-restricted-syntax per block.
const serverActionBan = {
  selector: 'ExpressionStatement[directive="use server"]',
  message:
    'Server Actions are not allowed: each one is a public POST endpoint outside withApiGuard. Go through the public API instead (see the server-actions note).',
};

const pagesRouterBan = {
  selector: 'Program',
  message:
    'The Pages Router is not used: any file under pages/api becomes an unguarded endpoint. Use an App Router route handler with withApiGuard.',
};

const pageExtensionsBan = {
  selector: 'Property[key.name="pageExtensions"], Property[key.value="pageExtensions"]',
  message:
    'pageExtensions changes which files Next.js serves as routes, so sidekick/require-api-guard would miss them. Keep the default.',
};
```

5. Wire the rule and the bans:

```js
  {
    // Every App Router route handler must be wrapped in withApiGuard: the proxy
    // does not authenticate /api routes, so an unguarded handler is public.
    // Matches Next.js route files in every app — not utilities such as
    // utils/route.ts. Covers both app/ and src/app/ layouts.
    files: ['apps/*/src/app/**/route.{ts,tsx,js,jsx}', 'apps/*/app/**/route.{ts,tsx,js,jsx}'],
    plugins: { sidekick: sidekickPlugin },
    rules: {
      'sidekick/require-api-guard': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-syntax': ['error', serverActionBan],
    },
  },
  {
    files: ['apps/*/pages/**', 'apps/*/src/pages/**'],
    rules: {
      'no-restricted-syntax': ['error', serverActionBan, pagesRouterBan],
    },
  },
  {
    files: ['apps/*/next.config.*'],
    rules: {
      'no-restricted-syntax': ['error', serverActionBan, pageExtensionsBan],
    },
  },
```

### Verify what the build serves

6. `apps/web/scripts/verify-endpoints.mjs`:

```js
// Verifies, after `next build`, that every endpoint Next.js will serve enters
// through an App Router route handler — the only files the
// sidekick/require-api-guard lint rule checks for withApiGuard.
//
// Lint rules check what we wrote; this checks what Next.js built, so it also
// catches entry points nobody anticipated. It fails the build on:
//   - any Server Action (each is a public POST endpoint outside withApiGuard)
//   - any Pages Router entry beyond Next.js's built-in error pages
//   - any App Router route with no route.* source file (e.g. a code-generated
//     metadata route such as sitemap.ts). Static files such as favicon.ico
//     are allowed: they serve a file and run no code.
import console from 'node:console';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const appDir = process.cwd();
const serverDir = join(appDir, '.next', 'server');
const sourceRoot = [join(appDir, 'src', 'app'), join(appDir, 'app')].find((dir) => existsSync(dir));

const BUILT_IN_PAGES = new Set(['/404', '/500', '/_app', '/_document', '/_error']);
const ROUTE_SOURCES = ['route.ts', 'route.tsx', 'route.js', 'route.jsx'];
const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function readManifest(name) {
  return JSON.parse(readFileSync(join(serverDir, name), 'utf8'));
}

function isStaticFile(path) {
  return existsSync(path) && statSync(path).isFile() && !CODE_FILE.test(path);
}

const problems = [];

const actions = readManifest('server-reference-manifest.json');
const actionCount = Object.keys(actions.node ?? {}).length + Object.keys(actions.edge ?? {}).length;
if (actionCount > 0) {
  problems.push(`${actionCount} Server Action(s) found. Server Actions are not allowed.`);
}

for (const route of Object.keys(readManifest('pages-manifest.json'))) {
  if (!BUILT_IN_PAGES.has(route)) {
    problems.push(`Pages Router entry "${route}". The Pages Router is not used.`);
  }
}

for (const [route, output] of Object.entries(readManifest('app-paths-manifest.json'))) {
  if (!route.endsWith('/route')) continue; // pages render HTML; not API entry points

  const segmentPath = output.replace(/^app\/?/, '').replace(/\/?route\.js$/, '');
  const source = join(sourceRoot, segmentPath);
  const hasRouteFile = ROUTE_SOURCES.some((file) => existsSync(join(source, file)));

  if (!hasRouteFile && !isStaticFile(source)) {
    problems.push(
      `"${route}" is served but has no route.* source file, so withApiGuard is not lint-checked.`,
    );
  }
}

if (problems.length > 0) {
  console.error('verify-endpoints: unguarded entry points in the build:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('verify-endpoints: every served endpoint is a lint-checked route handler.');
```

7. Run it after every build. In `apps/web/package.json`:

```json
    "build": "dotenv -e ../../.env.local -- next build && node scripts/verify-endpoints.mjs",
```

8. Verify both layers. Temporarily add a Server Action used by a page in a normal folder (not one starting with `_` — App Router folders starting with `_` are private and never built), a `src/pages/api/probe.ts`, and a `src/app/sitemap.ts`. Lint reports the first two; `pnpm --filter web build` fails listing all three. Remove them and rebuild.

---

## Task Pre-2.10 — Set Up the Docs Vault on Install

> **What and why:** `docs/` — and `AGENTS.md`, which links into it — are symlinks to the sibling Arkive checkout. A fresh clone or cloud agent environment started with no instructions at all.

1. `scripts/setup-docs.mjs`:

```js
// Makes docs/ — and AGENTS.md, which links into it — resolve in a fresh clone.
//
// docs/ is a symlink to ../arkive/sources/docs: Sidekick's canonical docs live
// in the public Arkive repo. On a fresh machine or in a cloud agent
// environment that sibling checkout is missing, so agents would start without
// AGENTS.md or the plans. This script clones Arkive next to this repo,
// downloading only sources/docs.
//
// Runs on `pnpm install` (root postinstall); also: `pnpm docs:setup`.
// - Does nothing when docs/ already resolves.
// - Skipped in CI and on Vercel (nothing there reads docs/), or when
//   SIDEKICK_SKIP_DOCS is set.
// - Never fails the install: problems are reported as warnings.
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ARKIVE_REPO = 'https://github.com/mehtapratik/arkive.git';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arkiveDir = resolve(repoRoot, '..', 'arkive');
const vault = join(arkiveDir, 'sources', 'docs');

function done(message) {
  console.log(`setup-docs: ${message}`);
  process.exit(0);
}

function warn(message) {
  console.warn(`setup-docs: ${message}`);
  process.exit(0);
}

if (process.env.CI || process.env.VERCEL) done('skipped in CI (nothing there reads docs/).');
if (process.env.SIDEKICK_SKIP_DOCS) done('skipped (SIDEKICK_SKIP_DOCS is set).');
if (existsSync(vault)) done(`docs/ resolves to ${vault}.`);
if (existsSync(arkiveDir)) {
  warn(`${arkiveDir} exists but has no sources/docs; left untouched, so docs/ will not resolve.`);
}

console.log(`setup-docs: cloning Arkive (sources/docs only) into ${arkiveDir}`);
const git = (args) => spawnSync('git', args, { stdio: 'inherit' }).status === 0;
const cloned =
  git(['clone', '--filter=blob:none', '--sparse', ARKIVE_REPO, arkiveDir]) &&
  git(['-C', arkiveDir, 'sparse-checkout', 'set', 'sources/docs']);

if (!cloned || !existsSync(vault)) {
  warn(
    `could not fetch the docs; the install itself succeeded. Run \`pnpm docs:setup\` later, or clone ${ARKIVE_REPO} next to this repo.`,
  );
}

done('docs/ and AGENTS.md now resolve.');
```

2. Root `package.json` scripts:

```json
    "docs:setup": "node scripts/setup-docs.mjs",
    "postinstall": "node scripts/setup-docs.mjs"
```

3. Delete `.github/workflows/trigger-arkive-deploy.yml`: it watched `docs/**` in this repo, which no longer changes now that `docs/` is a symlink.

4. In the repository's **Settings → Pages**, set **Branch** to **None**. GitHub Pages was publishing `docs/` and has failed since it became a symlink.

5. Document in the README that cloud agent environments must run `pnpm install` before the agent starts.

---

## Task Pre-2.11 — Show a "Check Your Email" State After Signup

> **What and why:** With "Confirm email" on, `signUp` succeeds with `session: null`. Redirecting to `/dashboard` bounced the user to `/login` with no explanation.

1. In the Supabase dashboard, **Authentication → Sign In / Providers → Email**, turn on **Confirm email**, and check that **Authentication → URL Configuration → Site URL** points at the real app.

2. Add copy to `signUpCopies` in `packages/copy/src/auth.ts`:

```ts
  confirmAccountPageTitle: 'Confirm your email',
  confirmEmail: (email: string) =>
    `If this email address is valid, you will receive a confirmation email at ${email}. Please check your inbox and follow the instructions to complete the sign-up process.`,
  alreadyConfirmed: `Already confirmed your email?`,
```

The wording is identical for new and already-registered addresses: Supabase deliberately hides which emails have accounts, and the page must not undo that.

3. In `apps/web/src/app/(auth)/signup/page.tsx`, keep the submitted address in state and branch on the session:

```tsx
  const handleSubmit = async (values: typeof form.values) => {
    const { error, data } = await supabase.auth.signUp(values);

    if (error) {
      notifications.show({
        color: 'red',
        message: genericErrorCopy,
      });
      return;
    }
    if (!data?.session) {
      setUnverifiedEmail(values.email);
      return;
    }
    push('/dashboard');
  };
```

The page component holds `const [unverifiedEmail, setUnverifiedEmail] = useState<string | undefined>(undefined)` and renders an `UnverifiedEmailView` — title, `signUpCopies.confirmEmail(email)`, and a link to `/login` — instead of the form once it is set.

---

## Task Pre-2.12 — Pin Node and Format on Commit

> **What and why:** Node was pinned in CI but not locally, and formatting depended on remembering to run Prettier. Make one file the source of the Node version, refuse other majors, and format staged files on every commit.

1. Update local Node to the latest 22.x (some tools require a recent minor), and enable Corepack for it:

```bash
nvm install 22
```

```bash
nvm alias default 22
```

```bash
corepack enable
```

2. `.nvmrc` in the repo root:

```
22
```

3. Root `package.json`:

```json
  "engines": {
    "node": "22.x"
  },
```

4. `pnpm-workspace.yaml`:

```yaml
# With `engineStrict: true`, pnpm refuses to install when the running Node doesn’t
# satisfy an engines field, ours or a dependency’s.
engineStrict: true
```

5. Align types and companion packages with the runtime:

```bash
pnpm --filter web add -D @types/node@^22
```

```bash
pnpm --filter @sidekick/core add -D @types/node@^22
```

```bash
pnpm add -D -w @eslint/js@^9
```

`pnpm peers check` must report no issues.

6. The pre-commit hook:

```bash
pnpm add -D -w husky lint-staged
```

```bash
pnpm exec husky init
```

Replace the contents of `.husky/pre-commit`:

```sh
pnpm exec lint-staged
```

Add to the root `package.json` — the same pattern as `prettier:check`:

```json
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,md}": "prettier --write"
  }
```

7. `.prettierignore`, so tool-generated files are never hand-formatted:

```
# Generated by tools — never hand-formatted
apps/web/next-env.d.ts
packages/core/src/db/migrations/meta/
```

8. Commit. `lint-staged` formats the staged files and re-stages them. If the hook reports `ERR_PNPM_UNSUPPORTED_ENGINE`, the terminal is still on an old Node: run `nvm use`.

---

## Task Pre-2.13 — Protect `main`

> **What and why:** From here on, changes reach `main` only through pull requests that pass CI.

In the repository's **Settings → Rules → Rulesets**, create a ruleset targeting the default branch, enforcement **Active**:

| Setting | Value |
| --- | --- |
| Restrict deletions | On |
| Restrict creations, Restrict updates | Off — "Restrict updates" would block merging your own PRs |
| Require a pull request before merging | On; required approvals **0** (you cannot approve your own PR); merge method **Squash** |
| Require status checks to pass | On; check **`checks`**; require branches to be up to date |
| Block force pushes | On |
| Bypass list | Empty, or yourself with **For pull requests only** |

Verify with GitHub's API:

```bash
curl -s https://api.github.com/repos/mehtapratik/sidekick/rules/branches/main
```

It lists `pull_request`, `required_status_checks` (`checks`), `deletion` and `non_fast_forward`.

---

## Additional — ESLint Best-Practice Rules

> **What and why:** The config had only the base presets. Type-only imports were unchecked, promises could be silently dropped, and the React Hooks and Next.js rules were installed but never loaded.

1. Install the plugins at the root:

```bash
pnpm add -D -w eslint-plugin-react-hooks @next/eslint-plugin-next@16.2.5
```

```bash
pnpm --filter web remove eslint-config-next
```

2. Add `"verbatimModuleSyntax": true` to `compilerOptions` in `tsconfig.base.json`: the compiler then refuses a type imported as a value.

3. In `eslint.config.js`, import `reactHooks` and `nextPlugin`, and add after the TypeScript strictness block:

```js
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': 'error',
    },
  },
  {
    ...reactHooks.configs.flat.recommended,
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    plugins: { '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Checks links to Pages Router pages only; the Pages Router is banned.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
```

4. Apply the autofixes in each package (`eslint --fix .`), then run Prettier on the changed files.

5. Verify the rules with real temporary files inside a package — type-aware rules only run on files that belong to a `tsconfig`, so a stdin probe fails at parsing.

---

## Additional — Upgrade Every Dependency to the Newest Supported Version

> **What and why:** Migrations are cheaper while the codebase is small. "Newest" means the newest version that is **stable, supported by production, and supported by the rest of the toolchain** — not simply `latest`. ESLint 9 reached end of life on 2026-08-06, and Node 22 reaches it on 2027-04-30.

Check what is behind, and what blocks each major:

```bash
pnpm outdated -r
```

```bash
npm view typescript-eslint peerDependencies --json
```

Peer ranges answer "is this upgrade free?": `eslint-plugin-import` supports ESLint only up to 9, and typescript-eslint supports TypeScript `<6.1.0`. Do one upgrade group per pull request, so a failure points at one change. `main` is protected, so each goes through a branch.

### Minor and patch versions

```bash
git switch -c deps/minor-patch
```

```bash
pnpm up -r --latest '!eslint' '!@eslint/js' '!typescript' '!@types/node' '!eslint-plugin-boundaries'
```

`--latest` also moves exact pins such as `next`; the excluded packages get their own PRs (or follow the Node runtime). Pre-1.0 packages (`@supabase/ssr` 0.10 → 0.12) can break in a minor, so read their release notes, and smoke-test sign-up, sign-in and sign-out — CI does not exercise Supabase Auth.

### Node 22 → 24

Vercel offers 24.x (its default) and 22.x; 26 is not offered yet, so 24 is the newest major that matches production.

```bash
nvm install 24 && nvm alias default 24 && corepack enable
```

Set `.nvmrc` to `24` and `engines.node` to `"24.x"` — CI reads `.nvmrc`, Vercel deploys the `engines` major, and `engineStrict` makes pnpm refuse Node 22. Then:

```bash
pnpm --filter web add -D @types/node@^24
```

```bash
pnpm --filter @sidekick/core add -D @types/node@^24
```

### TypeScript 5.9 → 6.0

TypeScript 7 (the native Go compiler, GA July 2026) ships without a programmatic API; tools such as typescript-eslint keep running on 6.0 until 7.1's new API exists and they adopt it. 6.0 is the bridge.

```bash
pnpm add -D -w typescript@^6.0.3
```

```bash
pnpm --filter web add -D typescript@^6.0.3
```

```bash
pnpm --filter @sidekick/eslint-plugin-sidekick add -D typescript@^6.0.3
```

TypeScript 6 no longer infers `rootDir` when emitting (error `TS5011`). Add `"rootDir": "src"` to `compilerOptions` in every emitting config — `apps/cli/tsconfig.json`, `packages/features-registry/tsconfig.json`, `packages/ui/tsconfig.json`, and `packages/core/tsconfig.build.json` — which keeps TypeScript 5's output layout.

Verify with Turbo's cache bypassed — a cached build from before the upgrade hides `TS5011`:

```bash
pnpm turbo build --force
```

### ESLint 9 → 10

```bash
pnpm remove -w eslint-plugin-import
```

```bash
pnpm add -D -w eslint@^10 @eslint/js@^10 eslint-plugin-import-x@^4 eslint-plugin-boundaries@^7
```

```bash
pnpm --filter web add -D eslint@^10 && pnpm --filter @sidekick/eslint-plugin-sidekick add -D eslint@^10
```

In `eslint.config.js`:

1. Import import-x and the TypeScript resolver factory:

```js
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
```

2. Share the project list, keep `import/resolver` (eslint-plugin-boundaries reads it), and add import-x's settings:

```js
const tsProjects = [
  'tsconfig.base.json',
  'apps/*/tsconfig.json',
  'packages/*/tsconfig.json',
  'packages/features/*/tsconfig.json',
];
```

```js
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: tsProjects,
        },
      },
      // import-x only parses these extensions when following imports (no-cycle,
      // no-duplicates across files); its default omits TypeScript.
      'import-x/extensions': ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.cjs', '.mjs'],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: tsProjects,
        }),
      ],
```

3. Register the plugin as `plugins: { 'import-x': importX }` and rename every `import/…` rule to `import-x/…` (`no-duplicates`, `first`, `newline-after-import`, `no-self-import`, `no-cycle`, `no-extraneous-dependencies`).

4. Boundaries 7: rename `boundaries/no-unknown` to `boundaries/no-unknown-dependencies`, rename the `rules` option to `policies`, and wrap selectors in `element`:

```js
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { type: ['feature', 'registry', 'foundation'] } } },
            },
            {
              from: { element: { type: 'registry' } },
              allow: { to: { element: { type: ['feature', 'foundation'] } } },
            },
            {
              from: { element: { type: 'feature' } },
              allow: { to: { element: { type: 'foundation' } } },
            },
          ],
```

5. Add `'**/next-env.d.ts'` to `ignores` — Next.js generates it, and it imports build output under `.next/`.

6. Prove every migrated rule still fires **from inside a package** with real temporary files — a duplicate import, a `core → copy` import, an import cycle, an undeclared dependency (a real package such as `prettier`), a raw-client import, and a `'use server'` file — then delete them. A green lint run alone proves nothing: a misconfigured plugin passes silently.

### Renovate

After the upgrade PRs merge, `renovate.json` keeps everything current, encoding the same rules:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "timezone": "America/New_York",
  "schedule": ["before 6am on monday"],
  "labels": ["dependencies"],
  "rangeStrategy": "bump",
  "minimumReleaseAge": "3 days",
  "internalChecksFilter": "strict",
  "platformAutomerge": true,
  "postUpdateOptions": ["pnpmDedupe"],
  "lockFileMaintenance": {
    "enabled": true,
    "automerge": true,
    "schedule": ["before 6am on monday"]
  },
  "packageRules": [
    {
      "description": "Minor and patch updates: one grouped PR, merged automatically once the CI `checks` job passes",
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "all minor and patch",
      "automerge": true
    },
    {
      "description": "Majors: one PR each, reviewed by a person, never merged automatically",
      "matchUpdateTypes": ["major"],
      "automerge": false
    },
    {
      "description": "Node is major-only on purpose (.nvmrc `24`, engines `24.x`): minor and patch versions arrive by themselves through nvm, setup-node and Vercel, and an exact version would make pnpm's engineStrict reject every other 24.x. Majors follow production (the newest Vercel offers) and are bumped deliberately (pin-versions).",
      "matchDepNames": ["node"],
      "enabled": false
    },
    {
      "description": "@types/node matches the Node runtime major in .nvmrc",
      "matchPackageNames": ["@types/node"],
      "allowedVersions": "24.x"
    },
    {
      "description": "Blocked: typescript-eslint supports TypeScript <6.1; TypeScript 7 waits for 7.1's API and typescript-eslint support",
      "matchPackageNames": ["typescript"],
      "allowedVersions": "<6.1.0"
    },
    {
      "description": "Third-party GitHub Actions are pinned to a commit SHA; first-party actions/* keep major tags (pin-versions)",
      "matchManagers": ["github-actions"],
      "matchPackageNames": ["!actions/**"],
      "pinDigests": true
    }
  ]
}
```

Validate it:

```bash
npx --yes --package renovate -- renovate-config-validator renovate.json
```

Then, in GitHub:

1. Install the **Renovate** GitHub App for the repository. Because `renovate.json` already exists on `main`, it skips the onboarding PR.
2. In **Settings → General → Pull Requests**, turn on **Allow auto-merge** — `platformAutomerge` uses GitHub's native auto-merge, which still waits for the `main` ruleset's `checks`.

Renovate's **Dependency Dashboard** issue then lists every pending and blocked update.

Check the dashboard's *Detected Dependencies* after the first scan: it shows exactly what Renovate would change. Its first scan proposed rewriting `.nvmrc` and `engines.node` to an exact Node version, which is why the Node rule disables all Node updates, not just majors.

---

## Verify Pre-2

```bash
pnpm prettier:check && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:integration
```

All pass locally and in CI, and `main` accepts changes only through pull requests whose `checks` job is green.
