---
publish: true
id: build.phase-2.lesson-2
title: "Phase 2 lesson 2 walkthrough: resolveApiCaller"
created: 2026-10-20
updated: 2026-10-24
kind: guidance
version: 1.1.1
tags:
   - build
   - walkthrough
   - phase-2
   - api-guard
   - authentication
   - supabase
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-1]]"
---

# Phase 2 Lesson 2 Walkthrough — `resolveApiCaller`

This guide reproduces lesson 2 of [[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete|Phase 2]] step by step: task 2.1, which gives API routes a way to know who is calling. It assumes lesson 1 is merged ([[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-1-feature-registry|lesson 1 walkthrough]]) and that `packages/core/src/api/` doesn't exist yet.

The result shipped as [sidekick#13](https://github.com/mehtapratik/sidekick/pull/13). The design is recorded in [[contracts#Caller|contracts]] (version 2.4.0).

> **Updated after lesson 3:** "no caller" is now `undefined`, not `null` ([sidekick#16](https://github.com/mehtapratik/sidekick/pull/16)), following the coding standard "prefer `undefined` over `null`". The steps below show the current code.

Every step explains what you are doing and why. Follow the reasoning, not just the commands.

---

## Step 1 — Orient and Branch

> **What and why:** Page requests pass through `apps/web/src/proxy.ts`, which redirects signed-out users to `/login`. An API caller (a `fetch`, the CLI) wants a 401 it can handle, not a redirect to an HTML page, so the proxy lets `/api` through untouched. Every API route has to establish the caller itself. `resolveApiCaller` does that, and lesson 4's `withApiGuard` will call it on every request.

1. Branch from an up-to-date `main`:

```bash
git switch main
git pull origin main
git switch -c feature/P2L2-resolve-api-caller
```

2. Find the skip in `apps/web/src/proxy.ts`:

```ts
// Do not authenticate API routes here
if (isApiRoute(request)) {
  return supabaseResponse;
}
```

`supabase.auth.getUser()` runs before this line even for API requests. That isn't wasted work. A Supabase session is a short-lived access token (a JWT, about an hour) plus a single-use refresh token. When the access token has expired, `getUser()` refreshes the pair, and the proxy client's `setAll` (`packages/core/src/supabase/proxy.ts`) writes the new cookies to the request, for the route handler, and to the response, for the browser. So the session is refreshed once, in one place, before any route runs.

The guard still checks the caller itself. It must not depend on the proxy: a change to the matcher could stop the proxy running, and only the guard is guaranteed to run on every API route.

---

## Step 2 — Design the Return Type

> **What and why:** Decide what the function returns before writing any logic. Work backwards from what the guard does with the answer: return 401 when nobody is calling, check scopes for API-key callers, then run every query as the user through `withRLS(userId, …)`.

Two kinds of caller will exist:

- **A session**, from the browser's cookie. It is the user, so it carries only `userId`.
- **An API key**, from Phase 9 onwards (`Authorization: Bearer …`). It carries `userId`, the `keyId` (to update `last_used_at` or log which key was used) and its `scopes`.

Scopes aren't entitlements. Entitlements (lesson 3) are the features a _user_ has. Scopes narrow what one _key_ may do on that user's behalf, like a GitHub token limited to `repo:read`. A session has nothing to narrow, so it has no `scopes` field. An invented `[]` would block every logged-in user, and `['*']` would be a magic string.

A union tagged by a `kind` field (a **discriminated union**) lets the guard tell the two apart: checking `kind` narrows the type, so `scopes` only exists inside the key branch.

1. Create `packages/core/src/api/auth.ts` with the types:

```ts
export interface SessionBasedApiCaller {
  kind: 'session';
  userId: string;
}

export interface KeyBasedApiCaller {
  kind: 'key';
  userId: string;
  keyId: string;
  scopes: readonly string[];
}

export type ApiCaller = SessionBasedApiCaller | KeyBasedApiCaller;
```

Named interfaces follow the repo's lint rule (object shapes are interfaces). They also let a function take `KeyBasedApiCaller` alone, so "session callers skip the scope check" is enforced by the compiler. `ApiCaller` is the one `type`, because it's a union.

"Nobody is calling" is `undefined`, and it goes on the function's return type, not inside `ApiCaller`. Route handlers receive the caller after the guard has already sent the 401, so inside the type it would force a pointless check everywhere. On the return type, TypeScript won't let the guard read `caller.userId` until it has checked for `undefined`.

2. Check it compiles:

```bash
pnpm --filter @sidekick/core typecheck
```

---

## Step 3 — The Session Path

> **What and why:** Recognise a signed-in browser. The function takes the web-standard `Request`, not Next's `NextRequest`: a `NextRequest` _is_ a `Request`, so route handlers can pass it, `packages/core` doesn't need Next for the type, and tests can build one with `new Request(…)`.

Use `getUser()`, not `getSession()`. `getSession()` reads the session from the cookie and never contacts Supabase, and the user can edit a cookie. `getUser()` sends the token to Supabase Auth, which verifies it.

Any Auth error resolves to `undefined`: when in doubt, there's no caller, and the guard turns that into a 401. If Supabase Auth itself is down, `getUser()` also returns an error, so callers get a 401 rather than a 500. That's acceptable, because it still fails closed.

Missing Supabase env vars make `createServerClient()` throw. Don't catch it. "Not signed in" is an answer, a misconfigured app is a bug, and only a bug should crash ([[error-handling]]).

1. Add the function below the types:

```ts
import { createServerClient } from '../supabase/server';

export async function resolveApiCaller(request: Request): Promise<ApiCaller | undefined> {
  const client = await createServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  return user && !error
    ? {
        kind: 'session',
        userId: user.id,
      }
    : undefined;
}
```

Checking `user` alone would already be enough. `getUser()`'s own return type is a discriminated union keyed on `error` (`RequestResultSafeDestructure` in `@supabase/auth-js`): `user` is `null` exactly when `error` is set.

`pnpm --filter @sidekick/core lint` reports `request` as unused until step 4. Leave it.

---

## Step 4 — The Bearer Rule

> **What and why:** A request can send `Authorization: Bearer <token>`. In Phase 9 that token will be an API key, looked up in an `api_keys` table that doesn't exist yet (task 9.4). There's nothing to check it against today.

Three decisions:

- **Any Authorization header gets `undefined`.** Accepting an unchecked token would let anyone in. That's failing closed.
- **The header beats a valid cookie.** The browser attaches the cookie to every request automatically, but code adds a Bearer header deliberately. Picture an extension holding a `notes:read` key while you're signed in. If the cookie won, the extension's delete request would run with your full session (privilege escalation), and a revoked key would keep working unnoticed.
- **The check runs before `getUser()`.** That's the only way the header can win, because the cookie is never read, and it skips a network call for a request that will be refused anyway.

The check only tests whether the header is there, and it can only take access away, never grant it, so its content needs no validation yet. Phase 9 will validate the content once it grants access. An empty `Authorization:` header carries no credential and falls through to the session.

1. Add the check at the top of `resolveApiCaller`:

```ts
const authHeader = request.headers.get('authorization');

// Resolving auth header first so a limited API key can't borrow the user's session cookie,
// which the browser attaches automatically
if (authHeader) {
  // deny all api key/token based access until auth key table is built out in phase 9 / task 9.4
  return undefined;
}
```

`headers.get()` matches names case-insensitively and returns `string | null`.

---

## Step 5 — `server-only`

> **What and why:** Mark the file as server code, so it fails the build if a Client Component ever imports it.

1. Make this the first line of `auth.ts`, as in `admin.ts` and `db/unsafe.ts`:

```ts
import 'server-only';
```

It doesn't stop a secret leaking today. `server.ts` reads only `NEXT_PUBLIC_` variables, which are public by design, and Next never inlines other variables into a client bundle. What it gives:

- a clear build error instead of a confusing one, because `cookies()` from `next/headers` can't run in a browser;
- protection in advance for task 9.4, which will look up keys in the database here;
- a signal to readers, since `packages/core` is imported from both sides.

`packages/core/vitest.config.ts` aliases `server-only` to a stub, because the real package throws outside Next's `react-server` condition.

---

## Step 6 — Test It

> **What and why:** Run `resolveApiCaller` without Next or Supabase. There's no request scope in a test, so `cookies()` would throw, and the tests shouldn't make network calls. `vi.mock` replaces `../supabase/server` for every file in the test run, the test file included.

How `vi.mock` behaves here:

- It is **hoisted** above the imports, so `auth.ts` gets the fake before it loads. A factory therefore can't read top-level `const`s directly, because they don't exist yet (`vi.hoisted()` exists for that).
- The factory makes `createServerClient` an empty `vi.fn()`. Each test sets its value with `vi.mocked(createServerClient).mockResolvedValue(…)`.
- Vitest 5 clears mock call counts between tests by default, but a value set with `mockResolvedValue` carries over into the next test, so `beforeEach(() => vi.resetAllMocks())` is still needed. Import `beforeEach` from `'vitest'`. An editor's auto-import can pick `'node:test'`, whose hook never runs under Vitest.

1. Create `packages/core/src/api/auth.test.ts`. The fakes use the real response shapes, typed as `UserResponse`. Only the user is cast, because the code reads nothing but `id`. With no session, `getUser()` returns `AuthSessionMissingError`, not `error: null`. Requests are real `Request` objects: a fake `headers.get()` that ignores the header name couldn't catch code reading the wrong header.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AuthError,
  AuthSessionMissingError,
  type SupabaseClient,
  type User,
  type UserResponse,
} from '@supabase/supabase-js';

import { createServerClient } from '../supabase/server';
import { resolveApiCaller } from './auth';

const MOCK_AUTH_TOKEN = 'bearer mocked-auth-token';
const MOCK_USER = { id: 'mock-user-id' } as User;
const MOCK_AUTH_USER_RESPONSE: {
  validUser: UserResponse;
  invalidUser: UserResponse;
  error: UserResponse;
} = {
  validUser: { data: { user: MOCK_USER }, error: null },
  invalidUser: { data: { user: null }, error: new AuthSessionMissingError() },
  error: { data: { user: null }, error: new AuthError('boom') },
};

function getSupabaseServerClient(state: 'validUser' | 'invalidUser' | 'error') {
  return {
    auth: {
      getUser: async () => MOCK_AUTH_USER_RESPONSE[state],
    },
  } as unknown as SupabaseClient;
}

function getHttpRequestObject(includeHeaders = false, mockAuthToken = MOCK_AUTH_TOKEN) {
  return new Request('http://localhost/auth', {
    headers: includeHeaders ? { Authorization: mockAuthToken } : undefined,
  });
}

vi.mock('../supabase/server', () => ({
  createServerClient: vi.fn(),
}));
```

2. Add six cases inside `describe('resolveApiCaller', …)`, after the `beforeEach`. Each one asserts the whole result (`toEqual`, `toBeUndefined`) and, where it matters, whether the session was read:

| Test                                                                | Request             | Fake client   | Expect                             |
| ------------------------------------------------------------------- | ------------------- | ------------- | ---------------------------------- |
| resolves a signed-in user to a session caller                       | no header           | `validUser`   | session caller; client called once |
| resolves to undefined when nobody is signed in                      | no header           | `invalidUser` | `undefined`                        |
| resolves to undefined when Supabase Auth returns an error           | no header           | `error`       | `undefined`                        |
| resolves a Bearer header to undefined without reading the session   | Bearer              | none          | `undefined`; client never called   |
| lets a Bearer header win over a valid session                       | Bearer              | `validUser`   | `undefined`; client never called   |
| falls through to the session when the Authorization header is empty | `Authorization: ''` | `validUser`   | session caller; client called once |

For example:

```ts
it('lets a Bearer header win over a valid session', async () => {
  vi.mocked(createServerClient).mockResolvedValue(getSupabaseServerClient('validUser'));
  const resolution = await resolveApiCaller(getHttpRequestObject(true));
  expect(resolution).toBeUndefined();
  expect(createServerClient).not.toHaveBeenCalled();
});
```

Keep the token parameter a plain `string`. `new Request` turns `{ Authorization: undefined }` into the literal header `"undefined"`, which silently takes the Bearer path.

3. Run both commands. Vitest strips types without checking them, so a type-broken test still goes green, and only `typecheck` catches it.

```bash
pnpm --filter @sidekick/core test
pnpm --filter @sidekick/core typecheck
```

The output must say `Tests  6 passed (6)`.

4. **Break it on purpose.** Comment out the `return undefined;` in the Bearer branch and run the tests. Two fail, in two different ways:

- _lets a Bearer header win over a valid session_ fails its assertion, because a session caller came back instead of `undefined`.
- _resolves a Bearer header to undefined without reading the session_ fails with a `TypeError`. That test set no client, so after `resetAllMocks` the mock returns `undefined`, and the code reads `.auth` from it.

An assertion failure says what's wrong, while a `TypeError` only says that something broke. That's why each Bearer test checks both the result and the call count. Put the `return undefined;` back.

5. Core has tests now, so drop `--passWithNoTests` from its `test` script in `packages/core/package.json`. As in lesson 1, a package with tests should fail if Vitest finds none:

```json
"test": "vitest run src",
```

---

## Step 7 — Verify Like CI and Ship

> **What and why:** CI starts with no Turbo cache, and the PR title becomes the squash commit on `main`.

1. Clear the old build and run everything uncached:

```bash
rm -rf packages/core/dist
pnpm prettier:check
pnpm turbo lint typecheck build test --force
ls packages/core/dist/api
```

Every task should succeed with `0 cached`. `dist/api` holds `auth.js` and no `auth.test.js`.

2. Commit by path, push, and open the PR with a Conventional Commits title:

```bash
git add packages/core/src/api packages/core/package.json
git commit -m "feat(core): add resolveApiCaller for session callers; bearer fails closed"
git push -u origin feature/P2L2-resolve-api-caller
gh pr create --fill
```

`gh` needs `gh auth login` once per machine. Wait for the `checks` job, then squash-merge.

---

## What you have now

- `resolveApiCaller(req)` in `packages/core/src/api/auth.ts`, internal to `core` until the guard (lesson 4) uses it.
- A session caller for a signed-in browser. `undefined` for nobody, for any Auth error and for any Authorization header. Loud failures for a misconfigured app.
- Six unit tests, including proof that a Bearer header never reads the session.

Next: [[task-2-8and2-9|lesson 3]], entitlements.
