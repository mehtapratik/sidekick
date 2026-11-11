---
publish: true
id: system-design.non-functional.database.migration
title: Migration
created: 2026-09-19
updated: 2026-11-11
kind: spec
version: 1.1.0
tags:
   - system-design
   - database
   - drizzle
   - pnpm
---

1. Every feature (aka. package) will have its own `schema.ts`, `drizzle.config.ts`, and `migration` scripts There is NO global `drizzle-orm` config.
   1. This is to support [[isolation|feature level isolation]] and to support independent feature deployments in future.
2. With help of [[corepack]], `pnpm db:migrate` will orchestrate package (feature) discovery, running migration scripts in right order and failing fast on errors.
3. Having each package own its own database migration config eliminates the issues of schema drift, inconsistent environments, and hidden migration dependencies.

## How it works (Synergy lesson 2)

**D262** `decision` #database #drizzle #turborepo: Each package that owns tables records its applied migrations in its own table, `drizzle.__drizzle_migrations_<package>`, and Turbo runs the packages' migrations in dependency order.

- **Its own config:** `drizzle.config.ts` in the package, with its own `out` folder (`src/db/migrations`) and `migrations.table`. Core's table was renamed from drizzle's default (`__drizzle_migrations`) to `__drizzle_migrations_core` so every package follows one pattern; each existing database gets a one-time `ALTER TABLE drizzle.__drizzle_migrations RENAME TO __drizzle_migrations_core;` before its next migrate.
- **Why one table per package:** drizzle's migrator doesn't compare names or hashes. It takes the newest `created_at` in its table and applies every journal entry whose `when` is later. A table shared by two packages would skip one package's migration generated before the other's newest, silently.
- **Order:** `db:migrate` has `dependsOn: ["^db:migrate"]`, so a package's migrations run after those of every package it depends on. Dependencies only point down a layer, so that is foundation, then platform, then features. Siblings in one layer can't depend on each other, so their migrations may run in parallel.
- **One transaction:** every pending migration of a package runs in one transaction. A missing or misnamed migrations table re-runs `0000`, fails on the first `CREATE TABLE` and rolls back.
- **Environment:** only the root scripts load `.env.local`; `turbo.json` passes `DATABASE_DIRECT_URL` through to `db:migrate` and `db:generate`. The test database (`scripts/test-db/with-test-db.sh`) runs the same `turbo run db:migrate` with its own URL.
- **Applied migrations never move or change.** A migration belongs to the package that applied it; a fix is a new migration.

## Consequences

- **Ownership is independent, order is not.** A package's migrations may bind functions or reference tables of the packages below it (Synergy's triggers, core's `profiles`), the same way its code imports them. It can ship on its own as long as the packages it depends on are migrated first.
- **Shared SQL functions are public API.** Postgres refuses `DROP FUNCTION` while a trigger uses it, but `CREATE OR REPLACE` changes a function for every package that binds it, with no error. Change a shared function only in a way every caller survives. A first definition uses plain `CREATE FUNCTION`, so a name clash with another package fails loudly; a package's own functions carry its name (`synergy_…`).
- **Default privileges are global.** Core's `0009` revokes `EXECUTE` from `PUBLIC` on every function `postgres` creates, in any schema; a role that must call one directly gets an explicit `GRANT EXECUTE`. Triggers don't need it.

## Decision History

- 2026-09-19 · accepted · Migration
- 2026-11-11 · accepted · One migrations table per package, run in dependency order (D262), Synergy lesson 2
