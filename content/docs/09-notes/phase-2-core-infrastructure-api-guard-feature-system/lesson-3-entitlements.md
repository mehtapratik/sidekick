---
publish: false
id: notes.phase-2.lesson-3
title: "Phase 2 lesson 3 notes: entitlements"
created: 2026-10-23
updated: 2026-10-23
kind: notes
version: 1.0.0
tags:
   - phase-2
   - feature-system
   - database
   - drizzle
   - rls
   - postgresql
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-8and2-9]]"
---

These notes record what lesson 3 taught: the mental models, the surprises and the mistakes worth remembering. The steps to reproduce it are in [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-3-entitlements|the walkthrough]]. The decisions are recorded in [[contracts#Entitlements|contracts]].

The thread running through the lesson: **two walls, each proven by watching it fall.** RLS decides which rows a role sees; grants decide which commands it may run. Either alone looks sufficient, and only breaking each one on purpose showed what the other one adds.

---

## Designing the table

### A composite key beat the planned surrogate `id`

The target design had `id uuid` plus a unique `(user_id, feature_key)`. Pratik's composite primary key does the same job with less: it forbids duplicates, and its index leads with `user_id`, which is the only lookup. A surrogate key pays off when something references one row or an API addresses it by id. Nothing does here.

### `user_id`, not `profile_id`

Pratik proposed naming the column after the table it references (`profile_id`), a real convention (Rails uses it). It lost to consistency: `profiles.id` _is_ the auth user's id, the same value is `userId` in `ApiCaller`, `withRLS` and `app.current_user_id`, and policies read naturally as `user_id = current_user_id`. Pratik's own reason for switching: "everywhere else in code we have userId". A column name gets copied into every policy and query, so it should match the word the rest of the code uses.

### Reference `profiles`, not `auth.users`

Both cascade, because `profiles` already cascades from `auth.users`. `profiles` wins because our tables then reference our tables (no `REFERENCES` grant on Supabase's schema, as `0004` needed) and no entitlement can exist for a user without a profile.

### Erasure vs. retention

The privacy question (what must be kept after a user deletes their account?) got a general answer, not legal advice: GDPR Article 17 and laws like the CCPA give users a right to erasure, with exceptions where law requires keeping records, typically financial ones such as invoices. An entitlement is account state, not a transaction record, so cascade delete is right. Retained billing records will live with the payment provider or their own table (Phase 12), and log retention is Phase 10's question.

### No soft delete

Pratik first added `deleted_at`, then dropped it once cascade delete was settled. Soft delete is for syncable entities clients create offline. Here it would make every read filter `deleted_at IS NULL`, turn re-enabling into an un-delete (because of the primary key), and break `0003`'s triggers, which reference `OLD.id`.

---

## Drizzle

- **Column name vs. key.** `uuid('id')` names the SQL column `id`, whatever the object key says. The first draft created a column called `id` while meaning `user_id`. Mismatches compile, so they only show up in the generated SQL; reading the migration is the check.
- **One `.primaryKey()` per column means one primary key per column.** Two of them declare two primary keys, which Postgres rejects. A composite key goes in `pgTable`'s third argument.
- **The third argument returns an array.** Returning the bare `primaryKey(...)` produced an overload error that blamed `profileId`, because TypeScript reports only the last overload it tried.
- **Export from `schema/index.ts` or nothing happens.** `drizzle.config.ts` points only at that file.
- **Foreign keys come last** in generated SQL, as separate `ALTER TABLE`s, so tables can be created in any order.
- **Never edit an applied migration.** The migrator applies journal entries newer than the last one it recorded, so an edit never re-runs where it was applied and the databases drift. The test script's fresh database is the one place editing is safe, which is what made the break-it exercise possible.

---

## Locking it down

### Default privileges hand out writes

`0001`'s `ALTER DEFAULT PRIVILEGES` grants `app_runtime` full CRUD on every new `public` table, so the moment `0006` ran, users could write entitlements, with no RLS yet. The `REVOKE` in `0007` takes back exactly what `0001` handed out.

### Mistake: copying `0002`'s policy

The first `0007` was `0002` copied: `FOR ALL … WITH CHECK (user_id = current user)`. On `profiles` that's right, because users edit their own profile. Here it would let a user insert a row for themselves, which is a user granting themselves a feature. The fix is `FOR SELECT` with only `USING`. **A copied policy carries the copied table's permissions.**

### RLS denies by default, but not loudly

Once RLS is enabled, any command no policy covers is refused, but the refusal looks different per command:

| Command, with no policy for it | What happens                                              |
| ------------------------------ | --------------------------------------------------------- |
| `INSERT`                       | Error: "new row violates row-level security policy"       |
| `DELETE`, `UPDATE`             | No error. The command sees zero rows and reports success. |
| `SELECT`                       | No error. Zero rows.                                      |

Pratik expected the delete to remove the matching rows. Seeing it "succeed" without deleting anything was the clearest moment of the lesson: **that silent zero is why the `REVOKE` stays.** With it, a forbidden delete fails with "permission denied".

### Who writes, and why it needs no grant

`postgres` writes entitlements (migrations, lesson 7's seed). It owns the table, so it holds every privilege, and it has `BYPASSRLS`, which overrides even `FORCE`. Restricting `UPDATE` for `postgres` isn't possible in any real sense: an owner can grant itself back anything revoked. The boundary is between `app_runtime` (untrusted user requests) and `postgres` (trusted code run on purpose).

### `FORCE`

`FORCE ROW LEVEL SECURITY` applies the policy to the table's owner too. It changes nothing for `postgres` (`BYPASSRLS`). If `app_runtime` ever owned the table, `FORCE` would keep its queries filtered, and without `FORCE` it would see everything. Ownership would also defeat the `REVOKE`, so tables must always be created by the migration role. Pratik answered this check-understanding question correctly.

---

## `getEnabledFeatures(tx)`

- **Why `tx`.** Pratik knew `set_config(…, true)` resets at transaction end, so pooled connections can't leak a user id. The rest: the user is already inside `tx`, RLS filters on it, so there's no `where` and no `userId` argument to disagree with it; a connection without the setting sees nothing; a second `withRLS` costs a second pooled connection.
- **Select only what you return.** `select()` with no arguments fetched three columns to keep one, and the hand-written row type duplicated the schema. Naming the column lets Drizzle infer the type.
- **Functional style.** Pratik is writing more declaratively. The file separates I/O (`selectFeatureKeys`) from a pure transform (`toFeatureKeyArray`) and composes them, which is the useful core of FP. The lines drawn: `await` over `.then` (Node's async stack traces only follow `await`, and lesson 5 logs stacks), extract a helper when its name says more than its body, and no FP libraries on top of Drizzle and Next. Existing core code already fits, so no refactor PR.

---

## Testing

### Mistakes in the first draft

- **Test file under `src/`.** `pnpm test` runs `src/**` without a database, so it would fail CI. Integration tests live in `tests/integration/`.
- **Roles swapped.** The draft read `DATABASE_URL` as `postgres` and `TEST_AUTH_DATABASE_URL` as `app_runtime`. They're `app_runtime` and `supabase_auth_admin`. Neither can seed entitlements, so the script gained `TEST_ADMIN_DATABASE_URL`.
- **No users.** Entitlements need a profile, so users go into `auth.users` first and the `0005` trigger creates profiles.
- **SQL built as strings.** `` `(${a}, ${b})` `` inside a postgres.js tagged template becomes one text parameter. Use the driver's helper, `sql(rows, ...columns)`.
- **A test with no `expect`.** The insert test would have passed whatever happened.
- **The "cascade" test deleted as `app_runtime`,** which the `REVOKE` blocks, and checked through RLS, where zero rows can mean hidden rather than gone. Delete as the auth role, count as `postgres`.
- **A wrong expected count** (1 instead of 2) and a `requireEnv` error that printed the missing value instead of the variable name.
- **`null as unknown as string` into `withRLS`** to fake "no user". A raw query on the runtime connection is the honest version.

### Match the message, not just the rejection

The `REVOKE` and RLS both fail with SQLSTATE 42501. A test that only expects a rejection keeps passing when the `REVOKE` is removed, because RLS still blocks the insert. Matching "permission denied for table …" makes the test belong to one wall.

### Break one thing at a time

After breaking the policy, Pratik broke the `REVOKE` without restoring the policy, and the results mixed: three failures from the policy plus two from the `REVOKE`. Restore before the next break, or the failures can't be attributed.

### Before–after record

| Break                 | Guessed                       | Actually failed                                           |
| --------------------- | ----------------------------- | --------------------------------------------------------- |
| Policy `USING (true)` | both own-rows reads           | those two plus the context-free query (found with a hint) |
| `REVOKE` removed      | insert and delete             | both, insert with an RLS error, delete by not rejecting   |
| `ON DELETE restrict`  | cascade test, the delete line | exactly that, with a foreign key violation                |

---

## Tooling surprises

- **pnpm's `pnpm` field is dead.** pnpm 11+ ignores `pnpm.onlyBuiltDependencies` in `package.json` and warns on every command; `allowBuilds` in `pnpm-workspace.yaml` replaced it. Removed in [sidekick#14](https://github.com/mehtapratik/sidekick/pull/14).
- **Corepack downloads the pinned pnpm** the first time after Renovate bumps `packageManager`, and checks it against the sha512 in the field. Main moved to pnpm 12 during the lesson.
- **Stale `node_modules`** after a dependency bump made `web#build` fail with `Cannot find module …/next/dist/bin/next`. `pnpm install` fixed it.

## Coding standard: `undefined` over `null`

At the end of the lesson, the review surfaced that Pratik's coding standard ("prefer `undefined` over `null`") contradicted the lesson 2 contract, where `resolveApiCaller` returned `null`. Pratik chose the standard, so it now returns `undefined` ([sidekick#16](https://github.com/mehtapratik/sidekick/pull/16)) and contracts, the plan and the lesson 2 notes were updated. The same note had no frontmatter, which broke every arkive build until it got `publish: false` frontmatter.

## How the lesson ran

Pratik wrote every piece except the integration test, which they drafted and then asked the coach to complete. Design questions worked best as concrete either/or choices with a recommendation (`profiles` or `auth.users`, keep `created_at` or not). The open question "who should be able to insert?" got a correct instinct ("app_runtime only SELECT, an admin role writes") that just needed the mechanics: ownership, `BYPASSRLS`, and that nobody needs `UPDATE`. The lesson ran over three sessions.
