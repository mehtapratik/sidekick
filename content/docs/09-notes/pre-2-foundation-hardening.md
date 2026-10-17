---
publish: false
id: notes.pre-2-foundation-hardening
created: 2026-10-16
updated: 2026-10-16
kind: notes
version: 1.1.0
tags:
   - plan
   - pre-2
   - rls
   - database
   - supabase
   - drizzle
   - postgresql
   - security
   - testing
   - eslint
status: completed
applies_to:
   - "[[04-plans/pre-2-foundation-hardening-complete]]"
---

These notes record what Pre-2 taught, task by task: the mental models, the surprises, and the mistakes worth remembering. Pre-2 turned a foundation that worked on one machine into one that is reproducible, proven by tests, and enforced by tools.

The thread running through every task: **prefer a mechanism that enforces over a document that advises, and prove each mechanism by watching it fail.**

---

## Supabase connection modes (Pre-2.2, 2.7)

Supabase offers three ways to reach the same database:

| Mode | Address | Behavior |
| --- | --- | --- |
| Direct | `db.<ref>.supabase.co:5432` | Straight to Postgres. IPv6-only unless the IPv4 add-on is enabled. |
| Session pooler | `<region>.pooler.supabase.com:5432` | Supavisor keeps one Postgres connection for the whole client session. |
| Transaction pooler | `<region>.pooler.supabase.com:6543` | Supavisor hands out a Postgres connection per transaction. |

`DATABASE_URL` (the app, as `app_runtime`) uses the transaction pooler so many serverless instances can share few Postgres connections. `DATABASE_DIRECT_URL` (migrations, as `postgres`) uses the session pooler — despite its name, not the direct connection, because most networks are IPv4-only.

**The rule transaction mode imposes:** nothing may outlive a transaction. That is why `withRLS` uses `set_config(..., true)` inside a transaction (Phase 1.1), and why named prepared statements must be off.

### Prepared statements

Postgres compiles every query. `prepare: true` only *saves* the compiled statement under a name **on one Postgres connection**. `postgres.js` remembers "connection A has statement s1" — but behind Supavisor, connection A's next transaction may run on a different Postgres connection that has never seen `s1`. Hence `prepare: false`. The cost is re-parsing a simple query: a fraction of a millisecond against a network round trip of many.

### Pipelining — and a mistake

Pipelining sends further queries down a busy connection before earlier replies arrive. It saves a round trip per query, but it is not parallel execution: Postgres still runs them in order, and `postgres.js` matches replies purely by position. It only happens when every pooled connection is busy, and a pipelined query is committed to that connection even if another frees up first (head-of-line blocking).

**Mistake:** `max_pipeline: 0` was added as a precaution. In `postgres.js`, the callback that reserves a connection for a transaction sits after `sent.length < max_pipeline` in an `&&` chain, so with `0` it never runs — and every transaction fails with `UNSAFE_TRANSACTION`. It type-checked and linted; it was never run. The RLS proof test in Pre-2.5 caught it. **Lesson: verify behavior, not just types and lint.**

### Environment variables

- Supabase renamed its keys: **anon → publishable** (`sb_publishable_…`, public by design) and **service_role → secret** (`sb_secret_…`, bypasses RLS, server-only).
- Next.js inlines every `NEXT_PUBLIC_*` value into the browser bundle. A secret or database URL must never carry that prefix.
- An unset variable (`undefined`) and an empty one (`''`) differ; `.env.local` leaves unused sections out rather than writing `KEY=`.

---

## Migrations and roles (Pre-2.1, 2.3)

### Drizzle runs migrations by timestamp

Drizzle does not track migrations by name. It reads the newest `created_at` it has applied and runs every journal entry whose `when` is later. Consequences:

- An already-applied migration is never re-run, even if its file changes.
- A fresh database runs everything in journal order.

That made it safe to **edit applied migration `0001`** to create `app_runtime` when missing: the added block is a no-op on every database that already applied `0001` (the role exists there), and on a fresh database it runs before the `GRANT`s that need the role. The usual rule — never edit an applied migration — exists to stop databases diverging; here none can.

### `NOLOGIN` and the out-of-band password

The migration creates `app_runtime NOLOGIN` with every security attribute spelled out (`NOSUPERUSER`, `NOBYPASSRLS`, …). A fresh database gets the full permission boundary but cannot be logged into until someone runs `ALTER ROLE app_runtime WITH LOGIN PASSWORD '…'` — fail closed, and the secret never enters Git.

PostgreSQL has no `CREATE ROLE IF NOT EXISTS`; the idiom is a `DO $$ … $$` block (PL/pgSQL) that checks `pg_roles` first.

Since PostgreSQL 16, a non-superuser with `CREATEROLE` who creates a role is granted `ADMIN OPTION` on it. A membership has three switches: **admin** (manage the role), **inherit** (use its privileges automatically), **set** (`SET ROLE` to it). `postgres` has admin on `app_runtime` but neither inherit nor set.

### `SECURITY DEFINER` and `search_path`

The profile trigger runs when Supabase Auth inserts into `auth.users`. Auth's role, `supabase_auth_admin`, has neither `INSERT` on `public.profiles` nor `BYPASSRLS`, so the function is `SECURITY DEFINER`: it runs as its owner, `postgres`, like `sudo`. That borrowed privilege makes `search_path` dangerous — a function resolving names through a caller-controlled path can be redirected to lookalike objects. So it pins `SET search_path = ''` and schema-qualifies everything (`public.profiles`). Supabase sets `search_path=auth` for `supabase_auth_admin`, which is why an unqualified `profiles` would have resolved to `auth.profiles`.

The trigger runs in the same transaction as the signup: if it fails, the `auth.users` row is rolled back too.

### Three ways RLS is bypassed

1. A role with `BYPASSRLS` (Supabase's `postgres` and `service_role` — not superusers, but exempt from RLS).
2. A `SECURITY DEFINER` function owned by such a role.
3. Foreign-key actions: referential checks and `ON DELETE CASCADE` always bypass RLS, so constraints stay consistent.

RLS protects against ordinary queries from roles without these privileges — exactly `app_runtime`. Every other path is a deliberate, privileged exception.

> **Correction to the Phase 1.1 walkthrough:** it calls Supabase's `postgres` role and service role "superusers". Verified on the live project (PostgreSQL 17.6): `postgres` has `rolsuper = false` and `rolbypassrls = true`. The Phase 1.1 conclusions still hold — `BYPASSRLS` skips every RLS policy — but the mechanism is the `BYPASSRLS` attribute, not superuser status.

### Erasure and soft deletes

`profiles.id → auth.users(id) ON DELETE CASCADE` lets account deletion remove the profile. GDPR (right to erasure) and CCPA-style laws require that closing an account can erase personal data, and a soft-deleted row still holds that data. Soft deletes serve "undo"; account closure needs a hard delete or anonymization across every store — including Storage, embeddings, and third parties that no foreign key reaches.

### Fix forward, then prove a rebuild

Resetting the database would not have saved the work: the same migrations are needed either way, and the drift came from SQL-editor changes, which a reset does not prevent. Fixing forward is the only option once real users exist. The rebuild is still valuable — as a test, which Pre-2.5 now runs on every integration run.

---

## The safe database path (Pre-2.4)

- **A package `exports` map is an allowlist.** `src/db/unsafe.ts` is not listed, so no other package can import the raw client — a hard error, not a lint warning.
- **`no-restricted-imports` matches the import text as written, not the resolved file.** `**/db/unsafe` misses `./unsafe` and `../unsafe`; `**/unsafe` plus a one-file exception (`rls.ts`) closes the gap. `paths` take exact names; only `patterns` take globs.
- **Flat config replaces a rule's options per block.** A later block setting the same rule must repeat every ban it keeps.
- **`server-only`** is an empty file under Next.js's `react-server` export condition and a `throw` everywhere else — a package that works purely through export conditions.

---

## Proving RLS (Pre-2.5)

- **Vitest** is the monorepo's test framework. It uses Vite's module loader only while tests run; it does not tie the build to Vite ([[vitest]]).
- `server-only` throws in a test runner; an alias to an empty stub fixes exactly that one import. `resolve.conditions` alone does not reach externalized packages.
- **`tests/with-test-db.sh`** builds a throwaway PostgreSQL 17 with Supabase stand-ins, runs every migration, then deletes it — the "rebuild from scratch" idea, automated. It is a wrapper: `export`s must come before `"$@"`, because an export only affects commands that run after it.
- **A security test must fail when the protection is removed.** Exact-ID assertions catch "saw the wrong user's row"; a guard that rows exist prevents a vacuous "zero rows" pass; deliberately breaking `withRLS` proved the test detects it.
- `tsconfig.build.json` keeps tests type-checked but out of the production build. A task should depend on `^build` only if it reads build output.

---

## CI and version pinning (Pre-2.6, 2.12)

- **Workflow → job → step; actions are reusable steps.** GitHub reports a status check per job, named after the job (`checks`) — the name the `main` ruleset requires.
- **Pin every version** ([[pin-versions]]): exact through a lockfile or hash where one exists (npm dependencies, pnpm), **major only** for runtimes without a lockfile (Node 22, PostgreSQL 17), matching production. Minor and patch releases are fixes that production applies itself. Third-party actions pin a commit SHA, because tags can move.
- **Fail loudly on a mismatch.** `.nvmrc` feeds nvm and CI; `engines` + `engineStrict` make pnpm refuse other majors; the test script refuses another PostgreSQL major.
- **The pre-commit hook is a convenience; CI is the guarantee.** `lint-staged` formats only staged files and re-stages them — formatting the whole repo would leave the commit unformatted. `--no-verify` skips the hook; CI cannot be skipped.
- **Peer-dependency warnings are worth reading:** one hid an `@eslint/js` 10 / `eslint` 9 mismatch nobody chose. Change dependencies through `pnpm add` so the lockfile stays in sync.

---

## Boundaries and entry points (Pre-2.8, 2.9)

- **`eslint-plugin-boundaries` classifies files by path**, first matching pattern wins, and imports inside one package are never checked. An import it cannot resolve cannot be classified, so the resolver must cover `packages/features/*`.
- **Mistake: boundaries enforced nothing for days.** Element patterns match relative to `boundaries/root-path`, which defaults to the current directory. `pnpm lint` runs ESLint from inside each package, so every file was "unknown" and no boundary was ever checked — while every probe, run from the repo root, passed. Found during the ESLint 10 upgrade; fixed with `'boundaries/root-path': import.meta.dirname`. **Lesson: probe a rule exactly where and how it really runs.**
- **Ask "where can a request enter the server?"**, not "where is the guard used?". In the App Router only `route.*` files become endpoints — but **Server Actions** (`'use server'`) are public POST endpoints whose IDs ship in the browser bundle, the **Pages Router** serves any file under `pages/api`, and **`pageExtensions`** changes which filenames count. Server Actions are banned ([[server-actions]]).
- **Lint checks what you wrote; the build manifests show what Next.js will serve.** `verify-endpoints.mjs` reads them and fails on anything not lint-checked.
- **App Router folders starting with `_` are private and never routed** — a probe named `__probe` silently tested nothing.

---

## Docs portability (Pre-2.10)

`AGENTS.md` and `docs/` are symlinks into the sibling Arkive checkout, so a fresh clone started agents with no instructions. `pnpm install` now runs `scripts/setup-docs.mjs`, which clones Arkive's docs when missing. Docs are deliberately not pinned per commit: plans and specs lead the code, so the latest is correct — pinning is for tools that execute code. A leftover GitHub Pages site was publishing `docs/` and failing since it became a symlink.

---

## Signup confirmation (Pre-2.11)

`supabase.auth.signUp` succeeds with `session: null` when "Confirm email" is on. Checking only `error` treats "awaiting confirmation" as "signed in". For an already-registered address, Supabase returns a fake user and no error, so the page must show the **same** message either way — otherwise the form becomes an account-enumeration oracle. Turning on "Confirm email" also stops people creating accounts with someone else's address; the **Site URL** must point at the real app.

---

## Protecting `main` (Pre-2.13)

- **"Require a pull request" controls how changes arrive; "Restrict updates" controls who may change the branch at all** — turning on the latter would block merging your own PRs.
- Working solo: required approvals **0** (GitHub forbids approving your own PR), squash-only merges (linear history follows), required status check `checks`, deletions and force pushes blocked.
- Renaming the CI job requires updating the ruleset, or every PR waits forever for a check that no longer runs.

---

## ESLint best practices

Type-only imports (`import type`) are enforced by `verbatimModuleSyntax` in the compiler and by `consistent-type-imports` in the editor, so type-only modules never reach the bundle. Type-aware rules (`no-floating-promises`, `no-misused-promises`) read the TypeScript program — and therefore only run on files that belong to a `tsconfig`; a stdin probe pretending to be a file fails at parsing. React Hooks and Next.js rules were installed but never loaded before ([[eslint-best-practice-rules]]).

---

## Upgrading dependencies

- **"Latest" and "free" are different.** Upgrade to the newest version that is stable, supported by production, and supported by the rest of the toolchain. Peer-dependency ranges answer most of it: `eslint-plugin-import` stops at ESLint 9; typescript-eslint stops below TypeScript 6.1. `@types/node` must follow the Node runtime, not `latest` (26).
- **End-of-life dates set deadlines; features only add priority.** ESLint 9 reached end of life on 2026-08-06 (no more security fixes); Node 22 does on 2027-04-30.
- **Do it while the codebase is small.** Migration cost is config (constant) plus fixing what the new versions flag (grows with code).
- **TypeScript 7** is a native Go rewrite (about 10× faster) shipped without a programmatic API. Tools built on the old JavaScript API — typescript-eslint included — keep using TypeScript 6.0 side by side until 7.1's new, different API exists and they adopt it. Oxlint's tsgolint runs on TypeScript 7 already because it is built on the Go compiler's internals.
- **Node majors follow the deployment platform.** Vercel offered 24.x and 22.x; 26 was not offered yet, so 24 was the ceiling.
- **Turbo's cache can hide a broken build.** TypeScript 6 stopped inferring `rootDir` (`TS5011`), but a cached pre-upgrade build reported success. After any toolchain upgrade, verify with `turbo … --force`; CI has no cache and would have failed.
- **A green lint run proves nothing after a plugin migration.** Moving to `eslint-plugin-import-x`, `no-cycle` went silent until `import-x/extensions` included TypeScript. Plant one violation per rule and watch each fire.
- **One upgrade group per PR**, stacked, so a failure points at one change.
- **Renovate encodes the policy:** grouped minor/patch PRs auto-merge once `checks` passes; majors are reviewed; a 3-day minimum release age skips bad or compromised releases; production pins and known blockers are rules with a `description` stating why.
