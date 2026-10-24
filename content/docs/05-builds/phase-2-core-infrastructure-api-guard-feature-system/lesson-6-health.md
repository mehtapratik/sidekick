---
publish: true
id: build.phase-2.lesson-6
title: "Phase 2 lesson 6 walkthrough: /api/health and guard verification"
created: 2026-10-23
updated: 2026-10-24
kind: guidance
version: 1.1.1
tags:
   - build
   - walkthrough
   - phase-2
   - api-guard
   - api
   - nextjs
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-11and2-12]]"
---

# Phase 2 Lesson 6 Walkthrough — `/api/health` and Guard Verification

This guide reproduces lesson 6 of [[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete|Phase 2]] step by step: tasks 2.11 and 2.12. It adds Sidekick's first real API route, `GET /api/health`, wrapped in `withApiGuard`, and proves the 401, 200 and 403 behaviour end to end. It assumes lesson 5 is merged ([[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-5-logging|lesson 5 walkthrough]]).

The result shipped as [sidekick#21](https://github.com/mehtapratik/sidekick/pull/21). The design is recorded in [[contracts#Health route|contracts]] (version 2.7.0).

The code is five lines. The lesson is everything around it: how Next.js turns a file into an endpoint, the layers that keep that endpoint guarded, and how to test HTTP by hand. Every step explains what you are doing and why.

---

## Step 1 — Understand Route Handlers

> **What and why:** The App Router serves two kinds of file. A page renders HTML for people; a route handler answers HTTP requests for programs. Every Sidekick API is a route handler, so know exactly what one is before writing it.

1. **Folders are URLs.** Under `apps/web/src/app/`, a folder path becomes a URL path. A `page.tsx` in a folder renders HTML for that path. A `route.ts` answers HTTP requests directly, so `src/app/api/health/route.ts` serves `/api/health`.

2. **One export per HTTP method.** A route file exports functions named exactly `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS`. A method you don't export gets `405 Method Not Allowed` automatically.

3. **Web-standard objects.** A handler takes a standard `Request` and returns a standard `Response`, the same objects `fetch` uses in the browser. `Response.json(body, { status })` serializes the body and sets `content-type: application/json`. Next.js also offers `NextRequest` and `NextResponse` with extra helpers; Sidekick's guard uses the plain web types, so handlers don't depend on Next.js-only APIs.

4. **A page or a route, never both.** One folder can't hold both a `page.tsx` and a `route.ts`, because both would claim the same URL.

5. **Why the proxy doesn't protect `/api`.** Read `apps/web/src/proxy.ts`. For a path starting `/api` it returns early, before the "not signed in → redirect to `/login`" check:

```ts
// Do not authenticate API routes here
if (isApiRoute(request)) {
  return supabaseResponse;
}
```

Two reasons:

- **A redirect is the wrong answer for an API.** A browser page should send a signed-out visitor to the login page. A script or a `fetch` call needs `401` with a JSON body it can read, not a `307` to an HTML page.
- **One source of truth.** `withApiGuard` is the one place that authenticates, checks scopes and features, and opens the RLS transaction. If the proxy also checked auth, the two could drift apart.

The cost of that design is that a route file without the guard is public. Steps 2 and 4 show the two layers that stop that from merging.

6. Branch from an up-to-date `main`:

```bash
git switch main
git pull origin main
git switch -c feature/P2L6-health
```

---

## Step 2 — Break It First

> **What and why:** Write the route the way the Next.js docs show it, without the guard, and watch the lint rule refuse it. A guard you've never seen fail is a guard you're only assuming works.

1. Create `apps/web/src/app/api/health/route.ts`:

```ts
export async function GET(): Promise<Response> {
  return Response.json({ status: 'ok' });
}
```

2. Run lint from inside the app, the way CI runs it:

```bash
cd apps/web
pnpm lint
```

Expected:

```text
error  Route handler GET must be exported as `export const GET = withApiGuard(handler, options)`, with withApiGuard imported. Unguarded API routes are publicly reachable  sidekick/require-api-guard
```

`sidekick/require-api-guard` is wired in `eslint.config.js` for every `apps/*/src/app/**/route.*` file. It fails closed: it accepts only `export const METHOD = withApiGuard(...)` with `withApiGuard` imported, and it reports any form it can't verify (`export { handler as GET }`, `export * from …`, `export let`, a local function that happens to be called `withApiGuard`).

---

## Step 3 — Wrap It in the Guard

> **What and why:** The fix is one import and one wrapper. The decision worth making is which options to pass, and for health the answer is none.

Replace the file's contents:

```ts
import { withApiGuard } from '@sidekick/core/api';

export const GET = withApiGuard(async function GET() {
  return Response.json({ status: 'ok' });
});
```

- **`withApiGuard(handler)` with no options.** Health belongs to no feature, so it sets no `feature`. Passing one would mean registering a fake feature in `ALL_FEATURES` and seeding an entitlement for it, putting a false entry in the catalog every later phase reads. With no `feature`, the guard also skips the entitlements query.
- **It still requires a session.** `withApiGuard` has no public mode, so `/api/health` answers `200` only to a signed-in caller. A public liveness probe for a hosting platform would need a deliberate exception to the lint rule, and that's out of scope for this phase.
- **`{ status: 'ok' }`, not `{ message: 'OK' }`.** Health checks conventionally return a machine-readable `status` with a lowercase value, which monitors compare against and which can grow into `'degraded'` later. A `message` reads as prose for a human.
- **A named function expression.** A function passed straight into `withApiGuard` would be anonymous. Naming it `GET` makes it show up as `at GET` in the stack trace that `api.error` logs. The name exists only inside the function, so it doesn't clash with the exported `GET`.
- **The handler ignores its arguments.** It receives `{ tx, caller, req, ctx }` like every handler, and uses none of them. The guard still opens the RLS transaction (Step 5 shows what that costs).

Run `pnpm lint` and `pnpm typecheck` in `apps/web` again. Both pass.

---

## Step 4 — Read the Build

> **What and why:** Lint checks the files we wrote. The build checks what Next.js will actually serve. Read both outputs and know which layer catches what.

From the repo root:

```bash
pnpm --filter web build
```

Expected, in Next's route table and on the last line:

```text
├ ƒ /api/health
…
verify-endpoints: every served endpoint is a lint-checked route handler.
```

1. **`ƒ` means dynamic: the handler runs on every request.** In Next.js 16, route handlers are dynamic by default, whatever they contain. A `GET` becomes static only when you opt in, for example with `export const dynamic = 'force-static'`. (The bundled Next.js docs at `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` say route handlers "are not cached by default".)

   With **Cache Components** on (`cacheComponents: true` in `next.config.ts`, which Sidekick doesn't set), `GET` handlers behave like pages instead: Next pre-renders them at build time unless they touch request data. `/api/health` would still be dynamic, because the guard reads `req.url`, `cookies()` and the database. That matters: a pre-rendered guarded route would run once at build time with no session and serve that frozen `401` to everyone.

2. **`verify-endpoints.mjs` checks where each endpoint came from.** `apps/web/scripts/verify-endpoints.mjs` runs after `next build` and reads the manifests in `.next/server/`. It fails the build on any served endpoint that didn't come from a `route.*` file: a Server Action (every `'use server'` function is a public `POST` endpoint), a Pages Router file, or a generated route such as `sitemap.ts`. Lint can't see those, because nobody wrote a `route.ts` for them.

3. **The build doesn't lint.** `next build` stopped running ESLint in Next.js 16 (`next lint` was removed). Prove it: add an unguarded `apps/web/src/app/api/ping/route.ts`:

```ts
export const GET = async function GET() {
  return Response.json({ status: 'ok' });
};
```

Run the build. It succeeds, lists `ƒ /api/ping`, and `verify-endpoints` passes, because `/api/ping` does have a `route.ts`. Now run `pnpm lint` in `apps/web`: it fails on `ping` with `sidekick/require-api-guard`.

So the layers divide the work. `verify-endpoints` proves every endpoint enters through a route file; lint proves every route file uses the guard. **CI's `lint` step is the gate** (`.github/workflows/ci.yml`). On your own machine, `pnpm dev` and `pnpm build` will happily serve an unguarded route.

Delete `apps/web/src/app/api/ping/` before you go on.

---

## Step 5 — Try It by Hand

> **What and why:** Tests call the guard with synthetic requests. Now send real HTTP to a real server, with and without credentials, and read both the response and the server's log.

1. Start the app in one terminal and keep it visible:

```bash
pnpm dev
```

2. In a second terminal, call the route with no credentials:

```bash
curl -i localhost:3000/api/health
```

Expected:

```text
HTTP/1.1 401 Unauthorized
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
content-type: application/json
…

{"error":"Unauthorized","code":"UNAUTHENTICATED"}
```

3. Call it with an `Authorization` header:

```bash
curl -i -H 'Authorization: Bearer x' localhost:3000/api/health
```

Expected: the same `401`. Any `Authorization` header resolves to no caller until Phase 9 adds API keys, and the session cookie isn't read at all ([[contracts#Caller|contracts]]).

4. Open `http://localhost:3000/api/health` in a browser where you're signed in to the dev app. Expected: `{"status":"ok"}`. The browser sends your `sb-…` session cookies automatically; curl sends nothing unless you tell it to.

5. Read the dev terminal. Each `401` writes two lines from lesson 5's logger, and the `200` writes one:

```text
{"event":"api.denied","method":"GET","path":"/api/health","userId":null,"code":"UNAUTHENTICATED"}
{"event":"api.request","method":"GET","path":"/api/health","userId":null,"status":401,"latencyMs":2}
 GET /api/health 401 in 37ms (next.js: 25ms, proxy.ts: 7ms, application-code: 5ms)
{"event":"api.request","method":"GET","path":"/api/health","userId":"<your user id>","status":200,"latencyMs":402}
 GET /api/health 200 in 901ms (next.js: 9ms, proxy.ts: 482ms, application-code: 410ms)
```

What the output shows:

- **`curl -i` shows what the browser hides.** `-i` prints the status line and the response headers above the body. A browser tab shows only the body, or its own error page, so you can't see the status code, `content-type` or `set-cookie`. A `200` carrying an error message and a real `401` look the same in a tab.
- **The `%` after the body** is zsh marking that the response didn't end with a newline. It isn't part of the response.
- **`vary: rsc, …`** comes from Next.js on every App Router response. It tells caches that the response depends on those request headers. It's harmless on a JSON route.
- **`latencyMs` measures only the guard.** Next's own line splits the same request into `next.js`, `proxy.ts` and `application-code`. The guard's timer starts inside `apiGuard`, so it misses routing and the proxy: it answers "how slow is our code", not "how long did the user wait".
- **Cold, then warm.** The first request after `pnpm dev` starts is slow (412ms in total for the first `401`) because Next compiles the route on demand. A production build compiles everything ahead of time.
- **A signed-in request is slower: ~400–600ms inside the guard from a laptop.** It makes three trips to the cloud: `getUser()` to Supabase Auth to verify the token, then `withRLS` opening, configuring and committing a transaction through the pooler. Deployed next to the database, each trip takes a few milliseconds. The known lever, if it ever matters, is Supabase's `getClaims()`, which verifies the JWT locally instead of asking Auth; the cost is that a revoked session stays valid until its token expires.
- **The proxy runs on `/api` too.** `proxy.ts` calls `supabase.auth.getUser()` before its `/api` early return, so a signed-in API request asks Supabase Auth twice: once in the proxy (`proxy.ts: 482ms`) and once in the guard. Without a cookie, both return immediately with no network call. The proxy's call is what refreshes an expired session cookie, so removing it from `/api` is a separate decision, not part of this lesson.

Keep these outputs: they go in the PR description.

---

## Step 6 — Prove the 403

> **What and why:** `/api/health` sets no `feature`, so it can never answer `403`. The `FEATURE_DISABLED` path is proven by lesson 4's integration test instead, on a real database.

1. Run the integration tests from the repo root:

```bash
pnpm test:integration
```

The test that matters is `responds 403 to a user who is not entitled to the feature` in `packages/core/tests/integration/guard.test.ts`. It calls `withApiGuard` directly with its own handler and `{ feature: 'core-drive' }`, as a real user on PostgreSQL 17 with no entitlement row, and expects `403 { error: 'Feature disabled', code: 'FEATURE_DISABLED' }`. The test before it seeds the row and gets through.

2. Watch it fail. In `packages/core/src/api/guard.ts`, comment out the feature check inside `withRLS`:

```ts
    // if (opts.feature && !(await getEnabledFeatures(tx)).includes(opts.feature)) {
    //   return { code: 'FEATURE_DISABLED', feature: opts.feature };
    // }
```

Run `pnpm test:integration` again. The 403 test fails with `200`. Put the lines back, and check that `git diff packages/core` is empty.

Why health can't cover this:

- **Health isn't part of that test.** The integration test builds its own guarded handler; `/api/health` is never called.
- **Health would have kept returning `200`** with the check commented out, because it never reaches the check. So health can't detect a broken feature check. Each proof covers what the other can't: health proves `401` and `200` over real HTTP, the integration test proves `403` against the real RLS policy.
- **A `403` by hand needs a real feature.** `ALL_FEATURES` is empty until Taxila (Phase 4) registers the first one. The integration test doesn't need a manifest, because `feature_key` has no foreign key.
- **`SCOPE_MISSING` can't happen by hand until Phase 9,** because nothing produces a key caller yet. The unit tests in `packages/core/src/api/guard.test.ts` cover it with a synthetic caller.

---

## Step 7 — Create the Database Client on First Use

> **What and why:** The PR's first CI run failed in `pnpm build`, although every check passed locally. `/api/health` is the first route that imports the database, and the database module refused to load without `DATABASE_URL`. CI has no `.env.local`.

1. **Read the failure:**

```text
Error: Failed to collect configuration for /api/health
  [cause]: Error: Missing DATABASE_URL environment variable
      at module evaluation (../../packages/core/src/db/unsafe.ts:11:9)
```

`next build` imports every route module to read its settings (`dynamic`, `revalidate`…), and importing a module runs its top-level code. The route imports the guard, the guard imports `withRLS`, and `unsafe.ts` checked `DATABASE_URL` and threw at load time.

2. **Reproduce it the way CI runs it.** The app's `build` script loads `.env.local` through `dotenv`, which is why the uncached local run passed. Bypass it:

```bash
env -u DATABASE_URL pnpm --filter web exec next build
```

3. Make `packages/core/src/db/unsafe.ts` create the client on first use:

```ts
import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

function createUnsafeDb() {
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

  return drizzle(client, { schema });
}

type UnsafeDb = ReturnType<typeof createUnsafeDb>;

// Created on first use, not when the module loads: `next build` imports every
// route module to read its config, and the build has no DATABASE_URL.
let unsafeDb: UnsafeDb | undefined;

// UNSAFE: queries on this client run without a user context. As app_runtime
// they fail closed (RLS returns zero rows), but nothing ties them to a caller.
// Only for building safe wrappers such as withRLS — ESLint enforces this, and
// the package `exports` map deliberately does not expose this file.
export function getUnsafeDb(): UnsafeDb {
  unsafeDb ??= createUnsafeDb();

  return unsafeDb;
}
```

4. Update `packages/core/src/db/rls.ts` to call it:

```ts
import { sql } from 'drizzle-orm';

import { getUnsafeDb } from './unsafe';

export type RlsTx = Parameters<Parameters<ReturnType<typeof getUnsafeDb>['transaction']>[0]>[0];

export type RlsTxHandler<T> = (tx: RlsTx) => Promise<T>;

export async function withRLS<T>(userId: string, fn: RlsTxHandler<T>): Promise<T> {
  return getUnsafeDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
```

- **A lazy singleton.** `unsafeDb ??= createUnsafeDb()` assigns only while `unsafeDb` is `undefined`: the first query creates the client, every later one reuses it. There's still one connection pool per server process.
- **Only the env check moved.** `postgres()` never connected at import; it connects on the first query. So the change moves exactly one thing, the `DATABASE_URL` check, from import time to first use.
- **`createUnsafeDb` has no return type.** Drizzle's type is long, the function isn't exported (so `explicit-module-boundary-types` doesn't apply), and `UnsafeDb` is inferred from it. `RlsTx` now derives from the function's return type instead of the variable's. `RlsTxHandler<T>` names the callback type `withRLS` takes, so its signature reads as one idea.
- **What changes at runtime.** A missing `DATABASE_URL` used to fail at import, and would have failed a deploy's build too. Now the first signed-in request fails: the guard logs `api.error` with that message and answers 500. Signed-out requests still get 401, because they never touch the database. It still fails loudly, at request time. The build-time failure was accidental anyway: it only fired for modules that happen to import the database. A deliberate startup check for every variable belongs in one place, such as Next's `instrumentation.ts`, as its own change.
- **Rejected: a fake `DATABASE_URL` in CI's build step.** One line, but every machine that builds without the variable would hit the same wall, and a credential-shaped placeholder in the workflow invites a real one.

Run the reproduction from item 2 again: the build passes and lists `ƒ /api/health`. Then run the checks in Step 8, including `pnpm test:integration`, which exercises `withRLS` on a real database.

This changes code from Pre-2; the [[05-builds/pre-2-walkthrough|Pre-2 walkthrough]] has a matching post note.

---

## Step 8 — Verify Like CI and Ship

1. Run everything uncached:

```bash
pnpm prettier:check
pnpm turbo lint typecheck build test --force
pnpm test:integration
```

Expected: 21/21 Turbo tasks, with `ƒ /api/health` and the `verify-endpoints` line in the `web:build` output, and 17 integration tests. Run the build once more without `.env.local` (Step 7, item 2), because CI has none.

2. Commit with the editor (`git commit`, no `-m`), so the subject stays one line and the body keeps its line breaks. Then push and open the PR:

```bash
git add apps/web/src/app/api/health/route.ts
git commit
git add packages/core/src/db
git commit
git push -u origin feature/P2L6-health
gh pr create --base main --fill
```

Two commits: `feat(web): add GET /api/health behind withApiGuard`, then `fix(core): create the database client on first use, not at import`. Put the curl results and log lines from Step 5 in the PR description, and say how the `403` is covered. Wait for the `checks` job, then squash-merge.

---

## What you have now

- `GET /api/health`, Sidekick's first route handler: `200 { status: 'ok' }` for a signed-in caller, `401 { error, code }` for everyone else, including any `Authorization` header.
- Proof, by hand and in the PR, that the guard's `401` and `200` paths and lesson 5's log lines work over real HTTP.
- Proof that the guard has two layers: lint checks every `route.*` file uses `withApiGuard`, `verify-endpoints` checks every served endpoint comes from a `route.*` file, and the build alone checks neither.
- The `403` path proven by lesson 4's integration test, and shown to fail when the check is removed.
- A database client created on first use, so `next build` works without `DATABASE_URL`.

Next: [[task-2-10|lesson 7]], a seed script that enables features for your own account.

---

## Post note — Check Required Variables When the Server Starts (added 2026-10-23)

Sidekick added this right after the lesson ([sidekick#22](https://github.com/mehtapratik/sidekick/pull/22)), as the follow-up to Step 7. Do it after Step 7.

> **What and why:** Step 7 moved the `DATABASE_URL` check from import time to the first query, so a server started without it looks healthy until someone signs in. Next.js has a startup hook for exactly this: check every required variable once, in one place, before the first request.

1. Create `apps/web/src/instrumentation.ts`:

```ts
// Variables the web server cannot serve a request without. Server-only ones
// (DATABASE_URL) are read lazily where they are used, so a missing one would
// otherwise surface only on the first request that needs it.
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'DATABASE_URL',
] as const;

/**
 * Runs once when a Next.js server instance starts (`next dev`, `next start`, each
 * Vercel function instance), before it handles a request. It does not run during
 * `next build`, which has no secrets in CI.
 * @description Every request fails with this error until the variables are set
 */
export function register(): void {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. Set them in .env.local (see .env.example) or in the host's settings.`,
    );
  }
}
```

- **`register()` runs once per server instance,** before it handles a request: `next dev`, `next start`, and every new Vercel function instance. It's Next's official startup hook (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`); observability tools such as OpenTelemetry install themselves there.
- **It doesn't run during `next build`.** Proven with a build that had no variables at all. So CI's build still needs no secrets, which was the point of Step 7.
- **It reports every missing name at once,** so a misconfigured deploy is fixed in one round, not one variable at a time.
- **The list belongs to the app.** Which variables a deployment needs is a fact about `apps/web`, so the list lives there, not in `packages/core`. `SUPABASE_SECRET_KEY` isn't on it because the web app never creates the admin client. A phase that adds a variable the server can't run without (Anthropic in Phase 6, Stripe in Phase 12) adds it here.
- **The per-module checks stay.** `unsafe.ts` and the Supabase clients still check their own variables, because tests and scripts never run `register()`.

2. Prove it. Each run below was checked for sidekick#22:

| Run                            | Result                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `next build` with no variables | passes, `ƒ /api/health`                                                       |
| `pnpm dev` with `.env.local`   | `/api/health` → 401                                                           |
| `next dev` with no variables   | prints `Missing environment variables: …` and exits                           |
| `next start` with `.env.local` | `/api/health` → 401                                                           |
| `next start` with no variables | stays up, answers every request (including `/login`) with 500, logs the error |

`next start` keeps running because Next prepares the server lazily: the hook's error is raised, and logged, on each request instead of stopping the process. On Vercel that's every request on the misconfigured instance.
