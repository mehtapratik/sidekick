---
publish: false
id: notes.phase-2.lesson-6
title: "Phase 2 lesson 6 notes: /api/health and guard verification"
created: 2026-10-23
updated: 2026-10-23
kind: notes
version: 1.0.0
tags:
   - phase-2
   - api-guard
   - api
   - nextjs
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-11and2-12]]"
---

These notes record what lesson 6 taught: the mental models, the surprises, and the corrections worth remembering. The steps to reproduce it are in [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-6-health|the walkthrough]]. The decisions are recorded in [[contracts#Health route|contracts]].

The thread running through the lesson: **every guard layer covers something the others can't see.** Lint reads the source, `verify-endpoints` reads the build output, the integration test reads the database, and `curl -i` reads the wire. None of them works alone.

---

## How the lesson ran

Same mode as lessons 4 and 5: the coach gave the exact code and commands for each piece, with the reasoning below, and Pratik typed them in and ran them. Six pieces: the unguarded route, the guarded route, the build, curl by hand, the 403 test, and, after CI's first run failed, a lazy database client. Pratik ran ahead from piece 1 to piece 2 and probed the build with an unguarded route of their own (below).

---

## Route handlers

- Under `src/app/`, folders are URLs. `page.tsx` renders HTML for people; `route.ts` answers HTTP for programs. One folder holds one or the other.
- A route file exports one function per HTTP method, named exactly after it. Unexported methods get `405` for free.
- Handlers take a web-standard `Request` and return a `Response`, the same objects as `fetch`. `Response.json(body, { status })` is all a JSON API needs.

## Why the proxy skips `/api`

- A signed-out browser should be redirected to `/login`; a signed-out API client needs `401` with a JSON body. One proxy can't give both answers well.
- `withApiGuard` is the single source of truth for auth, scopes, features and RLS. A second auth check in the proxy could drift from it.
- The price: a route file without the guard is public. That price is paid by the lint rule and CI, not by hoping.

## The guard layers

| Layer                        | Reads                          | Catches                                              | Misses                                      |
| ---------------------------- | ------------------------------ | ---------------------------------------------------- | ------------------------------------------- |
| `sidekick/require-api-guard` | every `app/**/route.*` file    | a route handler exported without `withApiGuard`      | endpoints that don't come from a route file |
| `verify-endpoints.mjs`       | `.next/server/*-manifest.json` | Server Actions, Pages Router files, generated routes | what's inside a route file                  |
| CI `checks`                  | runs both, plus tests          | everything above, before merge                       | nothing that runs only on your machine      |

### The build doesn't lint (Pratik's probe)

Pratik added an unguarded `/api/ping` next to `/api/health` and ran `pnpm --filter web build`. The build passed and served it. Two reasons:

- **Next.js 16 removed `next lint`, and `next build` no longer runs ESLint** (Next's upgrade guide, `version-16.md`). Sidekick's `build` script is `next build && node scripts/verify-endpoints.mjs`, with no lint step.
- **`verify-endpoints` trusts lint for what's inside a route file.** `/api/ping` has a `route.ts`, so the script is satisfied.

`pnpm lint` in `apps/web` failed on it straight away. The lesson: locally, `pnpm dev` and `pnpm build` will serve an unguarded route. CI's `lint` step is the gate, and branch protection is what makes it one.

## Dynamic by default

Pratik asked why `/api/ping`, which reads nothing from the request, was `ƒ` (dynamic) in the build table.

- **In Next.js 16, route handlers are dynamic by default,** whatever they contain. A `GET` becomes static only by opting in, for example `export const dynamic = 'force-static'`.
- **With Cache Components on** (`cacheComponents: true`, not set in Sidekick), `GET` handlers follow the page model instead: pre-rendered at build time unless they read request data, `cookies()`, `headers()`, the network or the database.
- **Why it matters for the guard:** a pre-rendered guarded route would run once at build time with no session and serve that frozen `401` to everyone. Both modes keep guarded routes dynamic, because the guard reads cookies, so no `export const dynamic = 'force-dynamic'` is needed.

> **Correction.** The coach first said `/api/health` was dynamic "because it reads cookies through `resolveApiCaller`". That's only the reason under Cache Components. Without it, every route handler is dynamic regardless. The bundled docs (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`) settled it.

## The build imports your modules (CI's first run failed)

The PR's first CI run failed in `pnpm build`: `Failed to collect configuration for /api/health`, caused by `Missing DATABASE_URL environment variable` at `unsafe.ts:11`. Every check had passed locally, uncached.

- **`next build` imports every route module** to read its segment config (`dynamic`, `revalidate`, `runtime`…). Importing runs top-level code. So anything a route imports, all the way down, executes at build time.
- **`unsafe.ts` threw at import.** It checked `DATABASE_URL` at module level. No route had imported the database before, so the build never loaded it. `/api/health` → guard → `withRLS` → `unsafe.ts` was the first chain to reach it.
- **"Verify like the real run" missed the environment.** The local run used `--force`, so no cache hid it, but the app's `build` script loads `.env.local` through `dotenv`, and CI has no `.env.local` and no secrets. Reproduce CI's environment too: `env -u DATABASE_URL pnpm --filter web exec next build`. Lesson: a local green run proves the code, not the environment.

**The fix: a lazy singleton.** `getUnsafeDb()` creates the client on first use (`unsafeDb ??= createUnsafeDb()`) and reuses it after, so there's still one pool per process. `postgres()` never connected at import anyway, so only the env check moved.

**The trade-off.** A missing `DATABASE_URL` used to fail at import, and would have failed a deploy's build. Now it fails the first signed-in request, as a logged `api.error` and a 500; signed-out requests still get 401. Still loud, just later. The build-time failure was an accident: it only covered modules that happen to import the database. A deliberate startup check for all variables belongs in one place (Next's `instrumentation.ts`), as its own change.

**Rejected: a fake `DATABASE_URL` in CI's build step.** It fixes CI only. A fresh clone or a preview without secrets hits the same wall, and a credential-shaped placeholder in the workflow invites a real one.

**General rule:** module top level should declare, not act. Reading env, connecting, or throwing at import couples "this file was imported" to "this environment is complete", and build tools import files in environments that aren't.

**The follow-up: a startup check ([sidekick#22](https://github.com/mehtapratik/sidekick/pull/22), Pratik's request).** `apps/web/src/instrumentation.ts` exports `register()`, which Next.js calls once per server instance before the first request, and never during `next build`. It names every missing required variable at once. `next dev` exits; `next start` and Vercel keep running but answer every request with 500 and log the error. That restores "fail at startup" deliberately, for every variable, instead of by accident for the ones some module happens to import.

## Testing HTTP by hand

- **`curl -i` prints the status line and headers.** A browser shows only the body or its own error page, so a `200` carrying an error message and a real `401` look the same in a tab. Seeing the status is the point of the test.
- **The browser sends cookies automatically; curl sends nothing** unless told to (`-H 'Cookie: …'` or `-b`). That's why the browser gets `200` and plain curl gets `401`.
- **zsh's `%` after a body** marks a missing final newline. It isn't part of the response.
- **`vary: rsc, next-router-…`** is added by Next.js to App Router responses so caches key on those request headers. Harmless on JSON.

## Reading latency

From the dev log:

| Request        | Next's total | `proxy.ts` | `application-code` | our `latencyMs` |
| -------------- | ------------ | ---------- | ------------------ | --------------- |
| 401, first     | 412ms        | 104ms      | 30ms               | 10              |
| 401, second    | 37ms         | 7ms        | 5ms                | 2               |
| 200, signed in | 851–901ms    | 175–482ms  | 410–623ms          | 402–617         |

- **`latencyMs` measures the guard only.** The timer starts inside `apiGuard`, so it misses Next's routing and the proxy. It answers "how slow is our code". The hosting platform's request log answers "how long did the user wait".
- **The first request is a compile.** `pnpm dev` compiles a route the first time it's hit. Production builds compile ahead of time.
- **A signed-in request makes three cloud round trips inside the guard:** `getUser()` to Supabase Auth, then `withRLS` (`BEGIN` with `app.current_user_id`, then `COMMIT`) through the pooler. From a laptop that's hundreds of milliseconds; next to the database it's a few. Don't optimize it from a laptop's numbers.
- **The guard opens a transaction even when the handler ignores `tx`.** "Every handler runs inside RLS" is simpler to trust than "handlers that need it opt in". Revisit only if a hot, database-free route ever needs it.
- **`getClaims()` is the known lever.** It verifies the JWT locally against Supabase's signing keys instead of asking Auth. The trade-off: a revoked session keeps working until its access token expires.
- **The proxy calls `getUser()` on `/api` too,** before its early return, so a signed-in API request asks Supabase Auth twice. Without a cookie, both calls return immediately. The proxy's call refreshes expired session cookies, so moving it is its own decision, outside this lesson.

## Decisions

- **Health requires a session but no feature.** Decided while planning, confirmed in the lesson. A fake feature would put a false entry in the registry, and with no `feature` the guard skips the entitlements query.
- **The body is `{ status: 'ok' }`.** Pratik first wrote `{ message: 'OK' }`. `status` with a lowercase value is the health-check convention monitors compare against, and it can grow into `'degraded'`. A `message` is prose for a human.
- **`withRLS` takes an `RlsTxHandler<T>` (Pratik's addition in piece 6).** A named alias for `(tx: RlsTx) => Promise<T>`: a function type is one of the cases where `type`, not `interface`, is the rule from lesson 1.
- **The handler is a named function expression (Pratik's choice).** `withApiGuard(async function GET() { … })` gives the stack trace in `api.error` a name (`at GET`) instead of an anonymous frame. A function expression's name is scoped to its own body, so it doesn't clash with the exported `const GET`.
- **No public liveness probe.** A health check for a hosting platform would have to be public, which means a deliberate exception to `require-api-guard`. Out of scope; if it ever comes, it's a security decision for Pratik, recorded in contracts, not a quiet `eslint-disable`.

## The 403

- `/api/health` can't return `403`: it sets no `feature`. The `FEATURE_DISABLED` path is proven by `responds 403 to a user who is not entitled to the feature` in `packages/core/tests/integration/guard.test.ts`, on real PostgreSQL 17.
- Pratik confirmed it by commenting out the feature check: the test failed with `200`.
- Pratik's question: "health will never fail the test we broke, because it isn't tied to a feature?" Right conclusion, one correction: health isn't part of that test at all. The test builds its own guarded handler. Health would have kept answering `200` with the check removed, which is exactly why health can't stand in for the test.
- The first hand-made `403` arrives with Taxila (Phase 4), the first registered feature. `SCOPE_MISSING` can't occur by hand until Phase 9 creates key callers; unit tests cover it with a synthetic one.

## The brief's questions

Both were covered while teaching, not asked as a quiz:

- **Why would a public health check for hosting need a deliberate exception, and who should decide?** Every route is guarded by construction: lint rejects anything else. A public probe means carving a hole in that rule, so it's a security decision. Pratik decides, it goes in contracts with its reason, and it's enforced in config rather than an inline disable, the same policy as lesson 5's `no-console` override.
- **What does `curl -i` show that the browser hides?** The status line and the headers: the `401` itself, `content-type`, `vary`, `set-cookie`. The browser shows only the body.

## Mistakes caught in review

- **Branch named `feature/P2L5-health`** for lesson 6. Renamed with `git branch -m feature/P2L6-health` before pushing.
- **Committed but not pushed.** "Done" came before `git push -u`; the PR didn't exist yet. Check `git status -sb` for an upstream before saying a branch is up.
