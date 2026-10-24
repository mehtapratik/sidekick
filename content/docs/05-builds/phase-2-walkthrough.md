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

Phase 2 is reproduced lesson by lesson: each lesson's walkthrough has the steps and the code. This page adds only what no single lesson shows: the order to follow them in, how the finished pieces work together on one request, and where to re-prove the phase's exit criteria. It assumes Pre-2 is complete ([[pre-2-walkthrough]]), including the post notes listed [below](#post-notes-in-earlier-walkthroughs).

The design is recorded in [[contracts]] (version 2.8.1), the plan in [[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete|the completed Phase 2 plan]].

## Follow the lessons in order

| Lesson | Adds                                                           | Shipped as                                                                                                             | Steps                                                                                                    |
| ------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1      | `FeatureManifest` and an empty `ALL_FEATURES`                  | [sidekick#9](https://github.com/mehtapratik/sidekick/pull/9), [#10](https://github.com/mehtapratik/sidekick/pull/10)   | [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-1-feature-registry\|lesson 1]]   |
| 2      | `resolveApiCaller`: who is calling                             | [sidekick#13](https://github.com/mehtapratik/sidekick/pull/13), [#16](https://github.com/mehtapratik/sidekick/pull/16) | [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-2-resolve-api-caller\|lesson 2]] |
| 3      | `user_feature_entitlements` and `getEnabledFeatures(tx)`       | [sidekick#15](https://github.com/mehtapratik/sidekick/pull/15)                                                         | [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-3-entitlements\|lesson 3]]       |
| 4      | `withApiGuard` and one RLS transaction per request             | [sidekick#18](https://github.com/mehtapratik/sidekick/pull/18), [#19](https://github.com/mehtapratik/sidekick/pull/19) | [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-4-with-api-guard\|lesson 4]]     |
| 5      | Structured logs from the guard                                 | [sidekick#20](https://github.com/mehtapratik/sidekick/pull/20)                                                         | [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-5-logging\|lesson 5]]            |
| 6      | `GET /api/health`, a lazy database client, a startup env check | [sidekick#21](https://github.com/mehtapratik/sidekick/pull/21), [#22](https://github.com/mehtapratik/sidekick/pull/22) | [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-6-health\|lesson 6]]             |
| 7      | `packages/ops` and `pnpm ops:entitlements:grant`               | [sidekick#23](https://github.com/mehtapratik/sidekick/pull/23), [#24](https://github.com/mehtapratik/sidekick/pull/24) | [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-7-ops\|lesson 7]]                |

Lesson 5 reshapes lesson 4's `guard.ts`; lesson 4's post note says how. Lesson 3's post note sends you back to earlier phases first.

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

## Where entitlements come from

Nothing in the request path writes entitlements. A person runs `pnpm ops:entitlements:grant` (lesson 7) as the privileged role, and the user's next request reads the new rows at step 7 above. Disabling is a `DELETE` with the same role. `ALL_FEATURES` is still empty, so `--all` grants nothing until Phase 4 registers Taxila.

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

Next: [[04-plans/phase-3-graph-store-metadata-service|Phase 3]], the graph store and metadata service. What Phase 2 left for later is listed in [[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete|the completed plan]].
