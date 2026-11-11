---
publish: false
id: notes.phase-3.lesson-2
title: "Synergy Lesson 2 Notes: Per-Package Migrations"
created: 2026-11-11
updated: 2026-11-11
kind: notes
version: 1.0.0
tags:
   - phase-3
   - database
   - drizzle
   - testing
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-2-per-package-migrations/00-brief]]"
---

These notes record what lesson 2 taught: the mental models, the surprises and the corrections worth remembering. The steps to reproduce it are in [[04-phases/03-synergy/00-lessons/lesson-2-per-package-migrations/01-walkthrough|the walkthrough]].

## Mental models

- **A migrations table is a high-water mark, not a checklist.** drizzle-orm's `pg-core/dialect.js` reads the single newest `created_at` and applies every journal entry whose `when` is later, all in one transaction. So two packages can't share a table (one's older migration would be skipped silently), and a missing or renamed table makes drizzle think nothing was applied: it re-runs `0000`, fails on the first `CREATE TABLE` and rolls back. Loud and safe.
- **Ownership is independent; order is not** (Pratik's point). Each package has its own config, journal and table, but its migrations may bind core's functions or reference core's tables, exactly like its code imports core. A package can ship alone as long as what it depends on is migrated first. Postgres guards one direction (`DROP FUNCTION` is refused while a trigger uses it); `CREATE OR REPLACE` guards nothing, so a shared SQL function is public API. Recorded in the agent guide, the database standard and the Migration spec.
- **`^task` versus `pkg#task`.** `^db:migrate` is relative: each package resolves it against its own dependencies. `@sidekick/core#db:migrate` is absolute: every package inherits it, core included, so core waited for itself. With the boundaries rule (dependencies only point down), `^` gives layer order with no list to maintain.
- **Turbo filters the environment; it doesn't create it.** Strict env mode gives a task only what it declares (`env`, `passThroughEnv`) plus basics like `PATH`. The root's `dotenv -e .env.local` puts every value into Turbo's process; Turbo hands each task its declared subset. Things outside Turbo aren't filtered: Next.js reads `.env*` files itself, and `pnpm -C pkg script` skips Turbo.
- **Restore and edit are separate statements, not separate transactions** (Pratik's question: can one `UPDATE` restore a Taxila post and change its text?). With this trigger it can, because only `deleted_at` is checked. It shouldn't: an edit must go through the save path (`content_seq` stale check, version log), a restore re-checks the rules that held at delete time (lesson 11), and a pure restore is idempotent. If the UI wants "undo and edit" as one action, the API runs restore then save in one transaction; the trigger fixes the order, the transaction makes it all-or-nothing.
- **Define once, bind many.** A trigger function is defined once (core's soft-delete functions) and each table binds it with a three-line `CREATE TRIGGER`; `TG_TABLE_NAME` says which table fired, and `TG_ARGV` can carry arguments (`EXECUTE FUNCTION f('allow_restore')`). Pratik asked whether shared database logic could be parameterized; the answer went to lesson 3's Handover, where the first repetition appears.
- **`PUBLIC` the role group is not `public` the schema.** `PUBLIC` means every role; `public` is the default schema. `0009` takes away the grant to `PUBLIC` for every function `postgres` creates, in any schema. The owner can always execute; anyone else needs `GRANT EXECUTE` (and `USAGE` on a non-`public` schema). Triggers don't check `EXECUTE`.
- **One database, many suites.** Wrapping each package's `test:integration` would have started two clusters on one port in parallel and run Turbo inside Turbo per package. Wrapping once at the root migrates once and lets core's Data API test guard every package's functions.

## Surprises

- **The first shared test run found a Phase 1.1 bug.** `0008`'s `ALTER DEFAULT PRIVILEGES ... IN SCHEMA public REVOKE ... ON FUNCTIONS FROM PUBLIC` did nothing: per-schema defaults only add to the global ones. Reproduced on a scratch PostgreSQL 17 before writing the fix: schema-only revoke, `anon` can execute (`true`); with the global revoke, it can't (`false`). It stayed hidden because no function was created after `0008` until Synergy's.
- **Turbo's strict env mode would have migrated dev from the tests.** The obvious script (`export DATABASE_DIRECT_URL=<test>; turbo run db:migrate`) loses the variable at Turbo, and each package's `dotenv -e .env.local` then fills it from dev. CI has no `.env.local`, so CI would only have failed; locally it would have been silent. Confirmed with `--dry=json` (`"envMode": "strict"`) before writing step 4.
- **TypeScript 6 defaults `types` to `[]`.** A package that uses `process` needs `"types": ["node"]`. Core never noticed because Next's types bring Node's along; `ops` already set it.
- **`pnpm add` without a version took `@types/node` 26.** It must stay on 24 for Node 24 (Renovate holds it).
- **zsh expands `*`.** `pnpm add @sidekick/test-utils@workspace:*` fails with "no matches found"; quote the spec.
- **drizzle-kit always says "migrations applied successfully",** even when nothing was pending, and Turbo always says "cache bypass" for an uncached task. The proof that nothing ran is the migrations table, not the log.
- **`drizzle-kit generate --custom` works with an empty schema** (`export {};`); checked in a scratch folder before step 1.

## Corrections during the lesson

- The scripts first read `../../../env.local` (no dot); a missing dot reads no file and fails with `Missing DATABASE_DIRECT_URL`.
- Table names were first singular (`__drizzle_migration_core`); plural matches drizzle's default and the rename SQL. The name in the config and the name in the `ALTER TABLE` must match exactly.
- `@sidekick/core` first landed in core's own `dependencies` (a self-dependency, the second cycle Turbo reported).
- The function's message first read `in $ (id: %)`; one placeholder for two arguments fails `CREATE FUNCTION`.
- Drizzle-kit's placeholder line stayed merged into `0009`'s first comment; removed before it was applied, because an applied migration is never edited.
- Text pasted from chat brought a curly apostrophe and trailing spaces into the script header.
- Core's `package.json` was re-sorted twice by the editor (`unional.vscode-sort-package-json`, see lesson 1's notes): `version` moved up, scripts alphabetised, `peerDependencies` moved last. Harmless, but it hides the real change in a diff.

## Checks that proved it

- `pnpm turbo run db:migrate --dry=json`: Synergy waits for core; core waits for nothing.
- `pnpm turbo run db:migrate --filter=@sidekick/core` with no env fails with `Missing DATABASE_DIRECT_URL`; `--dry=json` shows `DATABASE_DIRECT_URL` under `passThroughEnv`.
- `pnpm test:integration`: core 17 and Synergy 4 against one database; with the restore clause removed, the restore test fails.
- Lint probes: test-utils imported from Synergy's `src` fails the devDependency rule; test-utils importing core fails boundaries and the devDependency rule.
- `pnpm turbo run lint typecheck test --force` (21 of 21, 0 cached), `pnpm prettier:check`, `pnpm check:content`.
- Dev: 9 rows before the rename; after `pnpm db:migrate`, `10 | 1 | false` (core rows, Synergy rows, `anon` can execute Synergy's function); a second migrate applied nothing.
