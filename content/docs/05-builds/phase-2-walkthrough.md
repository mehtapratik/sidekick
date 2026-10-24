---
publish: true
id: build.phase-2
title: Phase 2 walkthrough
created: 2026-10-24
updated: 2026-10-24
kind: guidance
version: 1.0.0
tags:
   - build
   - walkthrough
   - phase-2
   - api-guard
   - feature-system
   - rls
   - authentication
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete]]"
---

# Phase 2 Walkthrough — API Guard and Feature System

Phase 2 built the one door every Sidekick API request goes through. Before it, the database could isolate users (Phase 1.1, Pre-2), but nothing in the app used that: no route existed, and nothing decided who was calling or what they were allowed to use. After it, `withApiGuard` answers three questions for every route, in the same order, every time: who is calling, may they do this, and which rows can they see. Features are catalogued in a registry and switched on per user by a row in a table that users can read but never write.

That matters because every later phase is built behind this door. Phase 3's graph routes, Taxila, Zinsser and the Phase 9 CLI all get authentication, entitlements, RLS, logging and safe errors by wrapping a handler, and the lint rule makes wrapping the only way to ship a route. A feature route can't forget to filter by user, because it never sees an unfiltered connection.

This guide ties the phase's seven lesson walkthroughs into one path. It doesn't repeat their code: each lesson section says what that lesson added and links its walkthrough for the steps. Follow them in order, then read [How a request travels](#how-a-request-travels) to see the result as one system. It assumes Pre-2 is complete ([[pre-2-walkthrough]]), including the post notes listed in [Post notes in earlier walkthroughs](#post-notes-in-earlier-walkthroughs).

The design is recorded in [[contracts]] (version 2.8.1), and the plan in [[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete|the completed Phase 2 plan]].

---

## Lesson 1 — Feature Registry (tasks 2.6, 2.7)

> **What and why:** A feature needs a name the database can store before anything can be switched on for a user. The registry is the catalog: what features exist, described the same way for everyone, changed only by a deploy.

- `packages/features-registry` exports `FeatureManifest` (`key`, `name`, `description`) and an empty, readonly `ALL_FEATURES`.
- The `key` is lowercase and hyphenated, unique and permanent, because entitlement rows store it with no foreign key. A test checks those rules once per rule, so they run on an empty list too.
- Object shapes are `interface`s, enforced by `@typescript-eslint/consistent-type-definitions`.

Shipped as [sidekick#9](https://github.com/mehtapratik/sidekick/pull/9) and [sidekick#10](https://github.com/mehtapratik/sidekick/pull/10). Steps: [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-1-feature-registry|lesson 1 walkthrough]].

## Lesson 2 — `resolveApiCaller` (task 2.1)

> **What and why:** The guard's first question is who is calling. One function answers it, and every uncertain case collapses into one "no caller" value the type system won't let you skip.

- `resolveApiCaller(req)` in `packages/core/src/api/auth.ts` returns a `SessionBasedApiCaller`, a `KeyBasedApiCaller`, or `undefined`.
- The session is verified with `supabase.auth.getUser()`, never trusted from the cookie. Any `Authorization` header resolves to `undefined` before the cookie is read, so an API key can never borrow the browser's session, and keys fail closed until Phase 9.
- "No caller" became `undefined` instead of `null` after lesson 3 ([sidekick#16](https://github.com/mehtapratik/sidekick/pull/16)); the walkthrough shows the current code.

Shipped as [sidekick#13](https://github.com/mehtapratik/sidekick/pull/13). Steps: [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-2-resolve-api-caller|lesson 2 walkthrough]].

## Lesson 3 — Entitlements (tasks 2.8, 2.9)

> **What and why:** A feature is on for a user when a row says so. Users must be able to read their own rows and never write any, so the table has two walls: RLS decides which rows, and grants decide which commands.

- `user_feature_entitlements` (migrations `0006`, `0007`): composite primary key `(user_id, feature_key)`, `user_id` references `profiles` with `ON DELETE CASCADE`, forced RLS with one `FOR SELECT` own-rows policy, and `INSERT`, `UPDATE`, `DELETE` revoked from `app_runtime`.
- `getEnabledFeatures(tx)` in `packages/core/src/features/entitlements.ts` takes the caller's RLS transaction and returns feature keys. It needs no `WHERE`: RLS filters the rows.
- The lesson's grants query found Supabase's Data API roles holding every privilege. Fixed in [sidekick#17](https://github.com/mehtapratik/sidekick/pull/17) as post notes in Phase 1.1 and Pre-2 (below).

Shipped as [sidekick#15](https://github.com/mehtapratik/sidekick/pull/15). Steps: [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-3-entitlements|lesson 3 walkthrough]].

## Lesson 4 — `withApiGuard` (tasks 2.2, 2.3)

> **What and why:** The wrapper that ties lessons 2 and 3 to `withRLS`. Cheap checks run before expensive ones, the database is touched only when needed, and each request gets exactly one transaction.

- `withApiGuard(handler, opts)` in `packages/core/src/api/guard.ts`, exported from `@sidekick/core/api`. Handlers receive `{ tx, caller, req, ctx }` and read `caller.userId`.
- `feature` and `requireScope` are optional. With no `feature`, the entitlements query is skipped.
- A throw rolls the transaction back and becomes a generic 500. A handler that writes and then returns an error response commits, so handlers validate before they write.
- Shared test helpers live in `packages/core/tests/helpers/` ([sidekick#18](https://github.com/mehtapratik/sidekick/pull/18)).

Shipped as [sidekick#19](https://github.com/mehtapratik/sidekick/pull/19). Steps: [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-4-with-api-guard|lesson 4 walkthrough]]. Lesson 5 reshapes `guard.ts`; the walkthrough's post note says how.

## Lesson 5 — Request and Auth-Failure Logging (tasks 2.4, 2.5)

> **What and why:** A log is a second API with its own readers. The guard is the one place that logs, so every request produces the same, safe lines.

- `packages/core/src/observability/log.ts`: `logEvent` writes one JSON line per event (`api.request`, `api.denied`, `api.error`) at the matching console level, and `toLoggedError` keeps Drizzle's query parameters out of error logs.
- The checks moved into an internal `authorizeAndHandle`, which returns the handler's `Response` or a `GuardDenial` and never logs. `withApiGuard` resolves the caller, logs, and responds.
- `console.log` is allowed in the logger only, through a per-file `no-console` override in `eslint.config.js`.

Shipped as [sidekick#20](https://github.com/mehtapratik/sidekick/pull/20). Steps: [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-5-logging|lesson 5 walkthrough]].

## Lesson 6 — `/api/health` and Guard Verification (tasks 2.11, 2.12)

> **What and why:** The first real route proves the chain over HTTP, and the lesson proves which layer catches what: lint reads the source, `verify-endpoints` reads the build, tests read the database, and `curl -i` reads the wire.

- `GET /api/health` in `apps/web/src/app/api/health/route.ts`: `200 { status: 'ok' }` signed in, `401 { error, code }` otherwise. It sets no `feature`, so it can't return 403; the 403 is proven by the integration test.
- `getUnsafeDb()` creates the database client on first use, because `next build` imports every route module and CI's build has no `DATABASE_URL`.
- `apps/web/src/instrumentation.ts` checks the required variables once when a server starts ([sidekick#22](https://github.com/mehtapratik/sidekick/pull/22), the walkthrough's post note).

Shipped as [sidekick#21](https://github.com/mehtapratik/sidekick/pull/21). Steps: [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-6-health|lesson 6 walkthrough]].

## Lesson 7 — The `ops` Package and `entitlements grant` (task 2.10)

> **What and why:** Task 2.10 asked for a seed that enables every feature for your own account. Only the privileged role can write entitlements, so the seed plays the admin. That made it the first command of a package for privileged scripts, not a file in the registry.

- `packages/ops` (`@sidekick/ops`): a boundaries element `ops` that may import `registry` and `foundation`, and that nothing may import.
- `withPrivilegedDb` in `packages/ops/src/lib/db.ts` opens one `DATABASE_DIRECT_URL` connection (the `postgres` role, which bypasses RLS) and always closes it.
- `pnpm ops:entitlements:grant --email <email> (--all | --feature <key>…) [--apply]`: a dry run by default, one `INSERT … ON CONFLICT DO NOTHING RETURNING` with `--apply`, exit codes 0, 1 and 2. Env comes from `dotenv-cli` ([sidekick#24](https://github.com/mehtapratik/sidekick/pull/24)).
- `ALL_FEATURES` is still empty, so `--all` grants nothing until Phase 4 registers Taxila. What the lesson proved is the path, not a working grant.

Shipped as [sidekick#23](https://github.com/mehtapratik/sidekick/pull/23) and [sidekick#24](https://github.com/mehtapratik/sidekick/pull/24). Steps: [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-7-ops|lesson 7 walkthrough]].

---

## How a request travels

A request to a guarded route, for example `GET /api/health` from a signed-in browser, passes through these steps. Each one names the lesson that built it.

1. **Proxy** (`apps/web/src/proxy.ts`, Phase 1). It calls `getUser()`, which refreshes an expired session and writes the new cookies, then returns early for `/api` paths. It never answers an API request with a redirect: authentication is the guard's job.
2. **Route** (`route.ts`, lesson 6). `export const GET = withApiGuard(handler, opts)`. Next.js calls the function the guard returned with `(req, ctx)`.
3. **`withApiGuard`** (lessons 4 and 5). It starts the latency timer and records `method` and `path` (the pathname only, never the query string).
4. **`resolveApiCaller`** (lesson 2). Any `Authorization` header → `undefined`. Otherwise `getUser()` verifies the session with Supabase Auth → a session caller, or `undefined`.
5. **`authorizeAndHandle`** (lesson 5), cheapest check first:
   1. No caller → denial `UNAUTHENTICATED`.
   2. A key caller without `requireScope` → denial `SCOPE_MISSING`. No connection has been taken yet.
6. **`withRLS(caller.userId, …)`** (Pre-2). `BEGIN` on the pooled `app_runtime` connection, then `set_config('app.current_user_id', userId, true)`, which lasts until the transaction ends.
7. **Entitlements** (lesson 3), only when `opts.feature` is set: `getEnabledFeatures(tx)` reads the caller's rows, filtered by RLS. The key missing → denial `FEATURE_DISABLED`, and the transaction commits with nothing written.
8. **Handler** (any route). `handler({ tx, caller, req, ctx })`. Its queries see only the caller's rows. Resolving commits; throwing rolls back.
9. **Logs and response** (lesson 5), back in `withApiGuard`:
   - a denial → `api.denied` with its `code`, then the `{ error, code }` body with 401 or 403;
   - a throw → `api.error` with `toLoggedError(error)`, then `500 INTERNAL`, with no details sent;
   - every request, last → one `api.request` with `status` and `latencyMs`.

Four checks stand around that path and never run per request:

| Layer                                       | Built in                   | Stops                                                          |
| ------------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| `sidekick/require-api-guard` (ESLint)       | Pre-2.9                    | a `route.*` file whose handler isn't wrapped in `withApiGuard` |
| `apps/web/scripts/verify-endpoints.mjs`     | Pre-2.9                    | an endpoint that doesn't come from a lint-checked `route.*`    |
| `app_runtime` role, forced RLS, `REVOKE`s   | Phase 1.1, Pre-2, lesson 3 | a query without a user, and a user writing entitlements        |
| CI `checks` and branch protection on `main` | Pre-2.6, Pre-2.13          | any of the above reaching `main`                               |

**What if one route dropped the guard?** Its handler would lose `tx`, and it has no other way in: `@sidekick/core` doesn't export the raw client, and lint bans importing `unsafe` anywhere but `rls.ts`. A connection without `app.current_user_id` sees zero rows, so user data stays hidden. What breaks is the promise: the route would answer anyone, with no 401, no logs and no entitlement check. `pnpm dev` and `pnpm build` would serve it locally (lesson 6 proved the build doesn't lint). CI's `lint` step catches it, and branch protection keeps it off `main`.

## The `ops` side path

Entitlements are written outside the request path, by a person, on purpose:

1. `pnpm ops:entitlements:grant --email <email> --all` from the repo root runs `pnpm -C packages/ops entitlements:grant`, which loads `.env.local` with `dotenv-cli` and runs the script under `tsx`.
2. The script parses flags strictly, checks every requested key against `ALL_FEATURES` before connecting (exit 2 on an unknown key), then opens `withPrivilegedDb`.
3. It finds exactly one profile for the email (exit 1 otherwise), reads that account's rows, and prints what would change.
4. With `--apply` it runs one `INSERT … ON CONFLICT DO NOTHING RETURNING` and prints only the rows it inserted. A second run prints "Granted: (none)".

The next request from that user reads the new rows in step 7 above. Disabling a feature is a `DELETE` with the same privileged role; there's no `revoke` command yet.

The dependency direction gained a side branch. Next to `apps → features-registry → features → foundation (core, ui, copy)` there is now `ops → registry, foundation`, which nothing imports ([[contracts#Ops|contracts]]).

## Exit criteria and proofs

The plan's exit criteria, each with the proof that holds on `main`:

| Criterion                                    | Proof                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `withApiGuard` is implemented and tested     | 14 unit tests (9 from lesson 4, 5 for logging from lesson 5) and 5 integration tests in `packages/core`                      |
| `/api/health` returns 401 unauthenticated    | `curl -i localhost:3000/api/health` → `401 {"error":"Unauthorized","code":"UNAUTHENTICATED"}` (lesson 6, re-run in lesson 8) |
| `/api/health` returns 200 signed in          | the same URL in a signed-in browser (lesson 6, re-run in lesson 8)                                                           |
| 403 when a feature is disabled               | `responds 403 to a user who is not entitled to the feature` in `packages/core/tests/integration/guard.test.ts` (lesson 4)    |
| The feature system enables features per user | `pnpm ops:entitlements:grant --email <you> --all` against dev (lesson 7, re-run in lesson 8)                                 |

Re-run them on a fresh `main`:

```bash
pnpm turbo test:integration --force
pnpm dev   # then, in another terminal:
curl -i localhost:3000/api/health
pnpm ops:entitlements:grant --email <you> --all
```

## Post notes in earlier walkthroughs

Fixes found during Phase 2 that belong to an earlier phase went into that phase's walkthrough as dated post notes, so anyone following the guides in order ends at the same code:

| Walkthrough                                                                                    | Post note                                                                  | From                                                                     |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [[05-builds/phase-0-foundation-and-tooling/02-checkpoint-b-walkthrough\|Phase 0 checkpoint B]] | pnpm build approvals in `pnpm-workspace.yaml`, not the `"pnpm"` field      | lesson 3, [sidekick#14](https://github.com/mehtapratik/sidekick/pull/14) |
| [[05-builds/phase-1-1-db-rls-enforcement\|Phase 1.1]]                                          | Lock out Supabase's Data API roles (migration `0008`)                      | lesson 3, [sidekick#17](https://github.com/mehtapratik/sidekick/pull/17) |
| [[05-builds/pre-2-walkthrough\|Pre-2]]                                                         | Prove the Data API roles are locked out                                    | lesson 3, [sidekick#17](https://github.com/mehtapratik/sidekick/pull/17) |
| [[05-builds/pre-2-walkthrough\|Pre-2]]                                                         | Create the database client on first use (`getUnsafeDb()`)                  | lesson 6, [sidekick#21](https://github.com/mehtapratik/sidekick/pull/21) |
| [[05-builds/pre-2-walkthrough\|Pre-2]]                                                         | A fifth element type for `ops`, and a second user of `DATABASE_DIRECT_URL` | lesson 7, [sidekick#23](https://github.com/mehtapratik/sidekick/pull/23) |

Within Phase 2, three lesson walkthroughs carry post notes of their own: lesson 3 (the follow-ups above), lesson 4 (changed in lesson 5) and lesson 6 (the startup check). Lesson 2 was edited in place for `undefined`, with a note at the top.

## What you have now

- One guarded way to write an API route, enforced in CI: authentication, scope, entitlements, one RLS transaction, structured logs and safe errors.
- A feature registry with no features yet, an entitlements table users can only read, and a privileged, dry-run-first command that writes it.
- Proof of each exit criterion on `main`.

Carried forward, not built: a `revoke` command, an `ops` dispatcher with the second command, a `--target` check once a second environment exists, a public liveness probe (a recorded exception to `require-api-guard` if ever), and `getClaims()` as the latency lever. Where each one lives is in [[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete|the completed plan]].

Next: [[04-plans/phase-3-graph-store-metadata-service|Phase 3]], the graph store and metadata service, the first feature-agnostic routes behind the guard.
