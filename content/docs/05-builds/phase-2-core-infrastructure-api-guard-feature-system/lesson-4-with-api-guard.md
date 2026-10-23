---
publish: true
id: build.phase-2.lesson-4
title: "Phase 2 lesson 4 walkthrough: withApiGuard"
created: 2026-10-23
updated: 2026-10-23
kind: guidance
version: 1.1.0
tags:
   - build
   - walkthrough
   - phase-2
   - api-guard
   - rls
   - api
   - authentication
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-2and2-3]]"
---

# Phase 2 Lesson 4 Walkthrough — `withApiGuard`

This guide reproduces lesson 4 of [[04-plans/phase-2-core-infrastructure-api-guard-feature-system|Phase 2]] step by step: tasks 2.2 and 2.3, the wrapper every API route goes through. It ties together lesson 2's `resolveApiCaller`, lesson 3's `getEnabledFeatures` and `withRLS`. It assumes lesson 3 and its follow-ups are merged ([[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-3-entitlements|lesson 3 walkthrough]], including its post note).

The result shipped as two PRs: the shared test helpers in [sidekick#18](https://github.com/mehtapratik/sidekick/pull/18), then the guard in [sidekick#19](https://github.com/mehtapratik/sidekick/pull/19). The design is recorded in [[contracts#Guard|contracts]] (version 2.5.0).

Every step explains what you are doing and why. Follow the reasoning, not just the commands.

---

## Step 1 — Understand the Wrapper and the Order of Checks

> **What and why:** The proxy deliberately lets `/api` through, so every route must authenticate itself. Doing that in each handler would scatter security across dozens of files, and one forgotten check would be a hole. A **higher-order function** puts it in one place: `withApiGuard(handler)` returns a new function that runs the checks, then calls your handler only for a permitted caller. It's the same idea as React's higher-order components (`connect(Component)`).

1. Read `packages/eslint-plugin-sidekick/src/rules/require-api-guard.ts`. It forces every App Router `route.*` file to export each HTTP method (`GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`) as `export const METHOD = withApiGuard(handler, options)`, with `withApiGuard` imported. Re-exports like `export { handler as GET }` are rejected because the rule can't see what `handler` is. The import check stops a local look-alike named `withApiGuard` from passing. Each method gets its own call and options, so a route can be stricter for `POST` than for `GET`:

```ts
// apps/web/src/app/api/notes/route.ts (example)
export const GET = withApiGuard(listNotes, { feature: 'core-drive', requireScope: 'notes:read' });
export const POST = withApiGuard(createNote, { feature: 'core-drive', requireScope: 'notes:write' });
```

2. Settle the order. The checks run from cheapest to most expensive, and a request stops at the first failure:

| #   | Check                                             | Needs the database?            | Fails with             |
| --- | ------------------------------------------------- | ------------------------------ | ---------------------- |
| 1   | `resolveApiCaller(req)`                           | No (one call to Supabase Auth) | 401 `UNAUTHENTICATED`  |
| 2   | Scope, for `key` callers only                     | No (in memory)                 | 403 `SCOPE_MISSING`    |
| 3   | `withRLS(caller.userId, …)` opens the transaction | Yes                            |                        |
| 4   | Feature, inside the transaction                   | Yes, under RLS                 | 403 `FEATURE_DISABLED` |
| 5   | The handler, in the same transaction              | Yes                            | whatever it returns    |
| 6   | Anything throws                                   |                                | 500 `INTERNAL`         |

- **Scope before the transaction:** it needs no database, so a key without the scope never takes a connection from Supavisor's small, shared pool.
- **Feature inside the transaction:** `user_feature_entitlements` is RLS-protected, so `getEnabledFeatures(tx)` only sees the caller's rows once `withRLS` has set `app.current_user_id`. Checking outside would need a second transaction, which means a second pooled connection on every request.
- This reorders the sketch in [[with-api-guard]], which checked features first, by `userId`, without RLS.

3. Branch from an up-to-date `main`:

```bash
git switch main
git pull origin main
git switch -c feature/P2L4-api-guard
```

---

## Step 2 — Share the Test Helpers

> **What and why:** The guard's tests need a request builder, mock callers and database clients that `auth.test.ts` and the integration tests already define, each with its own copy of `requireEnv`. Move them into `packages/core/tests/helpers/` first. This went in as its own PR, [sidekick#18](https://github.com/mehtapratik/sidekick/pull/18), so the guard PR stays focused.

Name everything by its **full qualifier** (coding standard 6): `MOCK_…` for mock values, `createMock…` for mock factories, `mock…` for local mocks, `…Spy` for spies and `test…Db` for test connections. The name says what a thing is wherever it's read, even inside `mocks.ts`.

1. Create `packages/core/tests/helpers/db.ts`:

```ts
import postgres, { type Sql } from 'postgres';

// Connections to the throwaway database tests/with-test-db.sh builds from our migrations.
// Each factory opens a new single-connection client; the test file that creates it ends it
// in afterAll, so every file owns its connections' lifecycle.

/** Reads a connection URL tests/with-test-db.sh exports; fails loudly when run outside it */
export function requireTestEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set; run this test through tests/with-test-db.sh`);
  }

  return value;
}

/** supabase_auth_admin: creates and deletes users the way Supabase Auth does */
export function createTestAuthDb(): Sql {
  return postgres(requireTestEnv('TEST_AUTH_DATABASE_URL'), { max: 1 });
}

/** postgres: the privileged migration/seed role, the only one that writes entitlements */
export function createTestAdminDb(): Sql {
  return postgres(requireTestEnv('TEST_ADMIN_DATABASE_URL'), { max: 1 });
}

/** app_runtime: the role withRLS uses for every user request */
export function createTestRuntimeDb(): Sql {
  return postgres(requireTestEnv('DATABASE_URL'), { max: 1 });
}
```

Factories, not shared clients: each test file opens the connections it needs and ends them in its own `afterAll`. A client exported ready-made would have no clear owner, and an open connection keeps the test process from exiting. Exported functions declare their return types (`Sql`), which `explicit-module-boundary-types` requires.

2. Create `packages/core/tests/helpers/http.ts`:

```ts
/** A Request to a fixed test URL, optionally carrying headers such as Authorization */
export function createMockHttpRequest(headers?: HeadersInit): Request {
  return new Request('http://localhost/api/test', { headers });
}
```

3. Create `packages/core/tests/helpers/mocks.ts`:

```ts
import {
  AuthError,
  AuthSessionMissingError,
  type SupabaseClient,
  type User,
  type UserResponse,
} from '@supabase/supabase-js';

import type { KeyBasedApiCaller, SessionBasedApiCaller } from '../../src/api/auth';
import type { RlsTx } from '../../src/db';

// Shared mock values. Every export carries its full qualifier (MOCK_…, createMock…), so a
// reader of any test file can tell a mock from real code without opening this file.

export const MOCK_AUTH_TOKEN = 'bearer mocked-auth-token';

export const MOCK_USER = { id: 'mock-user-id' } as User;

export const MOCK_SESSION_CALLER: SessionBasedApiCaller = { kind: 'session', userId: MOCK_USER.id };

export const MOCK_KEY_CALLER: KeyBasedApiCaller = {
  kind: 'key',
  userId: MOCK_USER.id,
  keyId: 'mock-key-id',
  scopes: ['notes:read'],
};

/** Stands in for withRLS's transaction where the code under test only passes it along */
export const MOCK_RLS_TX = {} as RlsTx;

export const MOCK_AUTH_USER_RESPONSE: {
  validUser: UserResponse;
  invalidUser: UserResponse;
  error: UserResponse;
} = {
  validUser: { data: { user: MOCK_USER }, error: null },
  invalidUser: { data: { user: null }, error: new AuthSessionMissingError() },
  error: { data: { user: null }, error: new AuthError('boom') },
};

/** A Supabase server client whose auth.getUser() resolves to one of the responses above */
export function createMockSupabaseServerClient(
  state: keyof typeof MOCK_AUTH_USER_RESPONSE,
): SupabaseClient {
  return {
    auth: {
      getUser: async () => MOCK_AUTH_USER_RESPONSE[state],
    },
  } as unknown as SupabaseClient;
}
```

`MOCK_SESSION_CALLER.userId` is `MOCK_USER.id`, so the `resolveApiCaller` and guard tests describe the same user. `MOCK_KEY_CALLER` and `MOCK_RLS_TX` are used by the guard tests in steps 5 and 6.

4. Point the existing tests at the helpers:
   - `src/api/auth.test.ts`: delete its local mocks and `getHttpRequestObject`. Import `createMockHttpRequest`, `MOCK_AUTH_TOKEN`, `MOCK_SESSION_CALLER` and `createMockSupabaseServerClient`. `getHttpRequestObject(false)` becomes `createMockHttpRequest()`, `(true)` becomes `createMockHttpRequest({ Authorization: MOCK_AUTH_TOKEN })`, `(true, '')` becomes `createMockHttpRequest({ Authorization: '' })`, and the session assertion becomes `toEqual(MOCK_SESSION_CALLER)`.
   - `tests/integration/rls.test.ts`, `entitlements.test.ts` and `data-api-roles.test.ts`: delete `requireEnv` and the `postgres` import. Replace each `postgres(requireEnv(…), { max: 1 })` with the matching factory, and rename `authDb`, `adminDb` and `runtimeDb` to `testAuthDb`, `testAdminDb` and `testRuntimeDb`.

The `vi.mock(…)` calls stay in each test file. Vitest hoists them above the imports and replaces modules per file, so a helper can't register mocks for a test.

The helpers stay inside `packages/core` until a second package needs them. Then they move to a `@sidekick/test-utils` package. A package now would cost its own `package.json`, `tsconfig`, Turbo tasks and boundaries rules for three small files.

---

## Step 3 — Write the Guard

> **What and why:** `withApiGuard` returns the function Next.js calls on each request, `(req, ctx) => Promise<Response>`. Your handler receives the RLS transaction, the caller, the request and Next.js's context.

1. Create `packages/core/src/api/guard.ts`:

```ts
import 'server-only';

import { withRLS, type RlsTx } from '../db';
import { resolveApiCaller, type ApiCaller } from './auth';
import { getEnabledFeatures } from '../features/entitlements';

export interface GuardOptions {
  /** Key of the feature the caller must be entitled to */
  feature?: string;
  /** Scope an API-key caller must hold; session callers skip this check */
  requireScope?: string;
}

export interface ApiHandlerArgs<Ctx> {
  tx: RlsTx;
  caller: ApiCaller;
  req: Request;
  /** Next.js's second route-handler argument (e.g. `{ params }`), passed through untouched */
  ctx: Ctx;
}

export type ApiHandler<Ctx> = (args: ApiHandlerArgs<Ctx>) => Promise<Response>;

/** The error-shape table from contracts.md: one place maps a code to its status and message */
const GUARD_ERRORS = {
  UNAUTHENTICATED: { status: 401, error: 'Unauthorized' },
  SCOPE_MISSING: { status: 403, error: 'Forbidden' },
  FEATURE_DISABLED: { status: 403, error: 'Feature disabled' },
  INTERNAL: { status: 500, error: 'Internal error' },
} as const;

type GuardErrorCode = keyof typeof GUARD_ERRORS;

function guardError(code: GuardErrorCode): Response {
  const { status, error } = GUARD_ERRORS[code];

  return Response.json({ error, code }, { status });
}

/** Scopes only narrow what an API key may do; a session caller has no scopes to check */
function isMissingScope(caller: ApiCaller, scope?: string): boolean {
  return caller.kind === 'key' && scope !== undefined && !caller.scopes.includes(scope);
}

/**
 * Wraps a route handler with authentication, scope and feature checks, and runs it
 * inside one RLS transaction for the caller. Every App Router route handler must use it.
 * @param handler Runs only for an authenticated, permitted caller
 * @param opts Feature the caller must be entitled to, and scope a key caller must hold
 * @returns A Next.js route handler
 * @description
 * - It runs from cheapest to most expensive
 * - A request stops at the first failure
 */
export function withApiGuard<Ctx = unknown>(
  handler: ApiHandler<Ctx>,
  opts: GuardOptions = {},
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async function apiGuard(req, ctx) {
    try {
      const caller = await resolveApiCaller(req);
      if (!caller) {
        return guardError('UNAUTHENTICATED');
      }

      // Needs no database, so it runs before a transaction (and a pooled connection) is taken
      if (isMissingScope(caller, opts.requireScope)) {
        return guardError('SCOPE_MISSING');
      }

      // `return await`, not `return`: the try/catch only catches a rejection it awaits.
      // Without it, a rejection skips our catch: no log, and no { error, code } body.
      return await withRLS(caller.userId, async (tx) => {
        if (opts.feature && !(await getEnabledFeatures(tx)).includes(opts.feature)) {
          return guardError('FEATURE_DISABLED');
        }

        return handler({ tx, caller, req, ctx });
      });
    } catch (error) {
      // withRLS has already rolled the transaction back. Lesson 5 replaces this with api.error.
      console.error('withApiGuard: unhandled error', error);
      return guardError('INTERNAL');
    }
  };
}
```

What each part does:

- **`Ctx` is a generic.** Next.js passes route handlers a second argument whose shape depends on the route (`{ params: Promise<{ id: string }> }` for `/api/notes/[id]`). The guard only passes it through, so `withApiGuard<Ctx>` lets TypeScript infer it from your handler and keep `ctx.params` typed. `Ctx = unknown` is the default for routes that ignore it.
- **`caller`, not `userId`.** Handlers read `caller.userId`. After `if (!caller) return …`, TypeScript narrows `caller` from `ApiCaller | undefined` to `ApiCaller`, so the handler never sees `undefined`. Passing `userId` too would be a second copy of the same value.
- **`ApiHandlerArgs` is a named interface,** because object shapes are interfaces (lesson 1's rule), and a handler written apart from its route can annotate its argument with it.
- **`feature` is optional.** Some routes belong to no feature: `/api/health`, account settings, "which features do I have?". When it's unset, the guard skips the entitlements query entirely. `&&` short-circuits, so `await getEnabledFeatures(tx)` never runs. A forgotten `feature` can't leak another user's data, because auth and RLS still protect that.
- **The error table.** `GUARD_ERRORS … as const` makes the codes literal types, and `keyof typeof` turns them into the `GuardErrorCode` union, so a typo'd code doesn't compile. It's the only place a status is paired with a message, so every guard error has the same `{ error, code }` shape ([[error-handling]]). The two 403s keep distinct codes. Vague errors protect unauthenticated surfaces, like a login form that won't say which emails exist. This caller is signed in and asking about their own account, and the UI needs to tell "enable this feature" from "this key needs `notes:write`". Detailed reasons go to the server log in lesson 5.
- **Rollback and `return await`.** Drizzle's `transaction()` commits when the callback resolves and rolls back when it throws. So a handler that throws halfway through a write leaves nothing behind. The `catch` logs the real error server-side and sends only `"Internal error"`. `return await` matters: a plain `return withRLS(…)` hands back the promise without awaiting it, so a rejection would skip the `catch`. Next.js would then answer with its own bare 500, with no log and no `{ error, code }` body. The `try` also covers `resolveApiCaller`, so a missing Supabase env var becomes a logged 500.
- **A returned error keeps the write.** Only a throw rolls back. A handler that writes and then _returns_ a 400 commits. Handlers validate before they write, or throw to undo. Step 6 pins this down in a test.
- **A named inner function** (`apiGuard`) shows up by name in stack traces.

---

## Step 4 — Export It

1. Create `packages/core/src/api/index.ts`:

```ts
// Public API surface: route handlers import withApiGuard from @sidekick/core/api.
// resolveApiCaller stays internal; only the guard calls it.
export { type ApiHandler, type ApiHandlerArgs, type GuardOptions, withApiGuard } from './guard';
export type { ApiCaller } from './auth';
```

2. Add the entry to `exports` in `packages/core/package.json`, after `"."`:

```json
"./api": "./src/api/index.ts",
```

Routes import from `@sidekick/core/api`. `resolveApiCaller` isn't exported, because only the guard should call it.

---

## Step 5 — Unit Tests

> **What and why:** A unit test checks the guard's own decisions: which check runs, in what order, and what comes back. Its three collaborators are mocked, so the tests need no database, no Supabase and no env vars.

1. Create `packages/core/src/api/guard.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockHttpRequest } from '../../tests/helpers/http';
import { MOCK_KEY_CALLER, MOCK_RLS_TX, MOCK_SESSION_CALLER } from '../../tests/helpers/mocks';
import { withRLS } from '../db';
import { getEnabledFeatures } from '../features/entitlements';
import { resolveApiCaller } from './auth';
import { type ApiHandler, withApiGuard } from './guard';

vi.mock('./auth', () => ({ resolveApiCaller: vi.fn() }));
vi.mock('../db', () => ({ withRLS: vi.fn() }));
vi.mock('../features/entitlements', () => ({ getEnabledFeatures: vi.fn() }));

const mockHandler = vi.fn<ApiHandler<unknown>>();

describe('withApiGuard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_SESSION_CALLER);
    // Run the callback the way withRLS does, minus the database
    vi.mocked(withRLS).mockImplementation(async (_userId, fn) => fn(MOCK_RLS_TX));
    vi.mocked(getEnabledFeatures).mockResolvedValue(['core-drive']);
    mockHandler.mockResolvedValue(Response.json({ ok: true }));
  });

  it('responds 401 without opening a transaction when there is no caller', async () => {
    vi.mocked(resolveApiCaller).mockResolvedValue(undefined);
    const response = await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized', code: 'UNAUTHENTICATED' });
    expect(withRLS).not.toHaveBeenCalled();
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('responds 403 without opening a transaction when a key caller lacks the scope', async () => {
    vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_KEY_CALLER);
    const guarded = withApiGuard(mockHandler, { requireScope: 'notes:write' });
    const response = await guarded(createMockHttpRequest(), undefined);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden', code: 'SCOPE_MISSING' });
    expect(withRLS).not.toHaveBeenCalled();
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('lets a key caller with the scope through', async () => {
    vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_KEY_CALLER);
    const guarded = withApiGuard(mockHandler, { requireScope: 'notes:read' });
    const response = await guarded(createMockHttpRequest(), undefined);

    expect(response.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledOnce();
  });

  it('skips the scope check for session callers', async () => {
    const guarded = withApiGuard(mockHandler, { requireScope: 'notes:write' });
    const response = await guarded(createMockHttpRequest(), undefined);

    expect(response.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledOnce();
  });

  it('responds 403 when the caller is not entitled to the feature', async () => {
    const guarded = withApiGuard(mockHandler, { feature: 'taxila' });
    const response = await guarded(createMockHttpRequest(), undefined);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Feature disabled', code: 'FEATURE_DISABLED' });
    expect(getEnabledFeatures).toHaveBeenCalledWith(MOCK_RLS_TX);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('does not read entitlements when no feature is required', async () => {
    const response = await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

    expect(response.status).toBe(200);
    expect(getEnabledFeatures).not.toHaveBeenCalled();
  });

  it('runs the handler in the caller’s transaction and passes ctx through', async () => {
    const mockRequest = createMockHttpRequest();
    const mockCtx = { params: Promise.resolve({ id: 'note-1' }) };
    const guarded = withApiGuard(mockHandler, { feature: 'core-drive' });
    const response = await guarded(mockRequest, mockCtx);

    expect(withRLS).toHaveBeenCalledWith(MOCK_SESSION_CALLER.userId, expect.any(Function));
    expect(mockHandler).toHaveBeenCalledWith({
      tx: MOCK_RLS_TX,
      caller: MOCK_SESSION_CALLER,
      req: mockRequest,
      ctx: mockCtx,
    });
    expect(await response.json()).toEqual({ ok: true });
  });

  it.each([
    [
      'the handler',
      () => mockHandler.mockRejectedValue(new Error('relation "notes" does not exist')),
    ],
    ['resolveApiCaller', () => vi.mocked(resolveApiCaller).mockRejectedValue(new Error('no env'))],
  ])('turns a throw in %s into a generic 500', async (_where, makeItThrow) => {
    makeItThrow();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

    expect(response.status).toBe(500);
    // Exactly the generic body: no message, stack or SQL reaches the client
    expect(await response.json()).toEqual({ error: 'Internal error', code: 'INTERNAL' });
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });
});
```

- **Mock paths match the imports.** `vi.mock` replaces a _module_, so the path must be the one `guard.ts` imports: `'../db'`, not `'../db/rls'` as the brief said. Vitest hoists the mocks above the imports, so the real `auth.ts` (which needs Next.js cookies) and the real `db` (which throws without `DATABASE_URL`) never load.
- **The `withRLS` mock runs its callback** with `MOCK_RLS_TX`, like the real one without a database. A fixed return value would skip the feature check and the handler. The tests check that the _same object_ reaches `getEnabledFeatures` and the handler, which proves they share one transaction.
- **Negative assertions prove the order.** `withRLS` not called on a 401 or a missing scope, and `getEnabledFeatures` not called without a `feature`. "Cheap checks first" is a promise only `not.toHaveBeenCalled()` can prove.
- **`toEqual` on the whole body** pins the error table, and in the 500 case proves the thrown message (`relation "notes" does not exist`) doesn't leak.

2. Run them:

```bash
pnpm --filter @sidekick/core test
```

Expect 15 passed: 9 here and 6 in `auth.test.ts`.

---

## Step 6 — Integration Test

> **What and why:** The unit tests mocked exactly the things that matter most: that RLS isolates users, that entitlements come from the table, and that a throw rolls back. Only a real Postgres proves those. This test mocks only `resolveApiCaller`, because there's no Supabase Auth in the throwaway database.

1. Create `packages/core/tests/integration/guard.test.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '../../src/api';
import { resolveApiCaller } from '../../src/api/auth';
import { profiles } from '../../src/db/schema';
import { createTestAdminDb, createTestAuthDb } from '../helpers/db';
import { createMockHttpRequest } from '../helpers/http';

// Proves the guard end to end on a database built from our migrations. Only the caller
// is mocked (there is no Supabase Auth here); withRLS, the RLS policies, entitlements,
// commit and rollback all run for real. Runs inside tests/with-test-db.sh.
vi.mock('../../src/api/auth', () => ({ resolveApiCaller: vi.fn() }));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const entitledUserId = randomUUID();
const otherUserId = randomUUID();

function mockSignedInAs(userId: string) {
  vi.mocked(resolveApiCaller).mockResolvedValue({ kind: 'session', userId });
}

// Reads as postgres, which bypasses RLS, so the check doesn't depend on the code under test
async function getProfileEmail(userId: string) {
  const [row] = await testAdminDb`SELECT email FROM profiles WHERE id = ${userId}`;
  return row.email;
}

beforeAll(async () => {
  // The 0005 trigger creates each user's profile
  await testAuthDb`INSERT INTO auth.users ${testAuthDb(
    [
      { id: entitledUserId, email: 'entitled@example.com' },
      { id: otherUserId, email: 'other@example.com' },
    ],
    'id',
    'email',
  )}`;

  await testAdminDb`INSERT INTO user_feature_entitlements (user_id, feature_key)
    VALUES (${entitledUserId}, 'core-drive')`;
});

afterAll(async () => {
  await testAuthDb.end();
  await testAdminDb.end();
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('withApiGuard on a real database', () => {
  it('lets an entitled user reach a feature route', async () => {
    mockSignedInAs(entitledUserId);
    const guarded = withApiGuard(async () => Response.json({ ok: true }), {
      feature: 'core-drive',
    });

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(response.status).toBe(200);
  });

  it('responds 403 to a user who is not entitled to the feature', async () => {
    mockSignedInAs(otherUserId);
    const mockHandler = vi.fn(async () => Response.json({ ok: true }));
    const guarded = withApiGuard(mockHandler, { feature: 'core-drive' });

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Feature disabled', code: 'FEATURE_DISABLED' });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('gives the handler a transaction that sees only the caller’s profile', async () => {
    mockSignedInAs(entitledUserId);
    const guarded = withApiGuard(async ({ tx }) =>
      Response.json(await tx.select({ id: profiles.id }).from(profiles)),
    );

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(await response.json()).toEqual([{ id: entitledUserId }]);
  });

  it('rolls back the handler’s write when it throws', async () => {
    mockSignedInAs(entitledUserId);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const guarded = withApiGuard(async ({ tx, caller }) => {
      await tx
        .update(profiles)
        .set({ email: 'changed@example.com' })
        .where(eq(profiles.id, caller.userId));
      throw new Error('failed after the write');
    });

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(response.status).toBe(500);
    expect(await getProfileEmail(entitledUserId)).toBe('entitled@example.com');
  });

  it('keeps the handler’s write when it returns an error response instead of throwing', async () => {
    mockSignedInAs(otherUserId);
    const guarded = withApiGuard(async ({ tx, caller }) => {
      await tx
        .update(profiles)
        .set({ email: 'kept@example.com' })
        .where(eq(profiles.id, caller.userId));
      return Response.json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }, { status: 400 });
    });

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(response.status).toBe(400);
    // Only a throw rolls back: handlers must validate before they write
    expect(await getProfileEmail(otherUserId)).toBe('kept@example.com');
  });
});
```

| Test                                   | What it proves                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| entitled user reaches a feature route  | the real entitlements table drives the feature check                                                            |
| non-entitled user gets 403             | same, and the handler never runs                                                                                |
| handler sees only the caller's profile | the `tx` it receives carries the caller's RLS context: a query with no `WHERE` returns one row                  |
| a throw rolls back the write           | the email is read back through `postgres`, which bypasses RLS, so the check doesn't rely on the code under test |
| a returned 400 keeps the write         | Drizzle commits whenever the callback resolves                                                                  |

All integration files share one database and Vitest runs them in parallel, so each file creates its own users with `randomUUID()`. Fixed ids shared across files would collide on insert, and the files would see each other's deletes and edits. Each test touches a different user's email, so the order within the file doesn't matter either.

2. Run it:

```bash
pnpm --filter @sidekick/core test:integration
```

Expect 17 passed: 5 here, plus `rls`, `entitlements` and `data-api-roles`.

3. **Break it on purpose.** In `guard.ts`, change the feature line to `if (false) {`. Exactly one test fails: `responds 403 to a user who is not entitled to the feature`. Put the line back and run again.

---

## Step 7 — Verify Like CI and Ship

1. Run everything uncached:

```bash
pnpm prettier:check
pnpm turbo lint typecheck build test --force
pnpm --filter @sidekick/core test:integration
```

2. Commit, push and open the PR. If the helpers from step 2 are their own PR that isn't merged yet, stack the guard on it with `--base chore/core-test-helpers`. After the helpers PR is squash-merged, rebase onto `main` so the guard PR shows only its own changes:

```bash
git add packages/core/package.json packages/core/src/api packages/core/tests/integration/guard.test.ts
git commit -m "feat(core): add withApiGuard with RLS transaction and entitlement check"
git fetch origin main
git rebase --onto origin/main chore/core-test-helpers feature/P2L4-api-guard
git push -u origin feature/P2L4-api-guard --force-with-lease
gh pr create --base main --fill
```

Wait for the `checks` job, then squash-merge.

---

## What you have now

- `withApiGuard(handler, opts)` in `packages/core/src/api/guard.ts`, exported from `@sidekick/core/api`. It authenticates, checks scope before taking a connection, opens one RLS transaction per request, checks the feature inside it, and turns any throw into a rolled-back, logged, generic 500.
- Shared test helpers in `packages/core/tests/helpers/`.
- Nine unit tests for the guard's decisions and five integration tests on a real database, one of them proven to fail when the feature check is removed.

Next: [[task-2-4and2-5|lesson 5]], structured logging inside the guard.

---

## Post note — Changed in Lesson 5 (added 2026-10-23)

Lesson 5 reshapes `guard.ts` while adding logging. If you're following along, the `guard.ts` from step 3 is correct for this lesson. Lesson 5's [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-5-logging|walkthrough]] replaces it with the final version:

- The checks move into an internal `authorizeAndHandle`, which returns the handler's `Response` or a denial instead of responding itself. `withApiGuard` resolves the caller, logs, and responds.
- `console.error('withApiGuard: unhandled error', error)` becomes a structured `api.error` event. It logs the error's name, message and stack frames, without Drizzle's query parameters.
- The unit test's 500 case asserts the logged `api.error` event instead of spying on `console.error`.

The behaviour this lesson's tests pin (order of checks, status codes, response bodies, one transaction, rollback on throw) is unchanged, and all of lesson 4's tests still pass.
