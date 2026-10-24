---
publish: true
id: build.phase-2.lesson-5
title: "Phase 2 lesson 5 walkthrough: request and auth-failure logging"
created: 2026-10-23
updated: 2026-10-24
kind: guidance
version: 1.0.1
tags:
   - build
   - walkthrough
   - phase-2
   - api-guard
   - observability
   - eslint
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-4and2-5]]"
---

# Phase 2 Lesson 5 Walkthrough — Request and Auth-Failure Logging

This guide reproduces lesson 5 of [[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete|Phase 2]] step by step: tasks 2.4 and 2.5. It covers a small structured logger, and log lines from `withApiGuard` for every request, every 401 and 403, and every 500. It assumes lesson 4 is merged ([[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-4-with-api-guard|lesson 4 walkthrough]]).

The result shipped as [sidekick#20](https://github.com/mehtapratik/sidekick/pull/20). The design is recorded in [[contracts#Logging|contracts]] (version 2.6.0).

Every step explains what you are doing and why. Follow the reasoning, not just the commands.

---

## Step 1 — Decide What a Log Line May Say

> **What and why:** A log is a second output of your API, read by different people, kept for weeks, and searched by machines. Before writing code, decide its shape, and decide what it must never contain.

1. **Structured, not free text.** Compare the same event written two ways:

```text
Request GET /api/notes by 3f2a… took 41ms
{"event":"api.request","method":"GET","path":"/api/notes","userId":"3f2a…","status":200,"latencyMs":41}
```

The first line is for a human. The second is for a machine: a log host can filter `status >= 500`, count `api.denied` per `code`, or average `latencyMs` per `path`. One event is one JSON object on one line, so the host never has to guess where an event ends.

2. **Three events.** `withApiGuard` already sees every request, so it is the one place that logs ([[03-system-design/non-functional/observability/centralized|centralized observability]]):

| Event         | When                        | Fields beyond `event`, `method`, `path`, `userId`        | Console method  |
| ------------- | --------------------------- | -------------------------------------------------------- | --------------- |
| `api.request` | at the end of every request | `status`, `latencyMs`                                    | `console.log`   |
| `api.denied`  | every 401 and 403           | `code`, plus `feature` or `scope` when that check failed | `console.warn`  |
| `api.error`   | every 500                   | `error: { name, message, stack }`                        | `console.error` |

The console method sets the level hosts such as Vercel show and filter by. A denied request logs two lines (`api.denied`, then `api.request`), and so does a failed one (`api.error`, then `api.request`). Every request logs exactly one `api.request`, so traffic and status counts come from one event.

3. **What a 403 at 2am needs:** who (`userId`), what (`method`, `path`), which rule (`code`) and what was missing (`feature` or `scope`). `code` is the same value the client got in `{ error, code }`, so a support report quoting `FEATURE_DISABLED` greps straight to the log line.

4. **What must never appear:** headers, cookies, tokens, request or response bodies, emails, and query strings.
   - **The pathname, not the full URL.** `?token=…`, `?email=…` and search terms ride in query strings. Anyone with access to the log host can read them, for as long as the host keeps logs.
   - **Never `req.headers`.** It holds the `Cookie` with the Supabase session and any `Authorization` token. Whoever reads the log could replay them and act as that user.

5. Branch from an up-to-date `main`:

```bash
git switch main
git pull origin main
git switch -c feature/P2L5-logging
```

---

## Step 2 — Write the Logger

> **What and why:** About 90 lines with no dependency. The event types make the rules above checkable by the compiler, and `toLoggedError` keeps user data out of error logs.

Create `packages/core/src/observability/log.ts`:

```ts
import 'server-only';

import { DrizzleQueryError } from 'drizzle-orm';

/** Fields every API event shares.
 *
 *  Never add headers, cookies, tokens, bodies or emails. */
export interface RequestLogContext {
  method: string;
  /** The URL pathname only: a query string can carry tokens, emails or search terms */
  path: string;
  /** `null` when there is no caller. JSON.stringify drops `undefined`, and the field must stay visible. */
  userId: string | null;
}

/** One per request, at its end, whatever the outcome */
export interface ApiRequestEvent extends RequestLogContext {
  event: 'api.request';
  status: number;
  latencyMs: number;
}

/** The guard's 401 and 403 codes: the same value the client receives in `{ error, code }` */
export type DenyCode = 'UNAUTHENTICATED' | 'SCOPE_MISSING' | 'FEATURE_DISABLED';

/** Every 401 and 403, with what the caller was missing */
export interface ApiDeniedEvent extends RequestLogContext {
  event: 'api.denied';
  code: DenyCode;
  /** The feature the caller isn't entitled to */
  feature?: string;
  /** The scope the key caller doesn't hold */
  scope?: string;
}

export interface LoggedError {
  name: string;
  message: string;
  /** Stack frames only (`at …` lines): the stack's first lines repeat the message */
  stack?: string[];
}

/** Every 500, with the details the client never sees */
export interface ApiErrorEvent extends RequestLogContext {
  event: 'api.error';
  error: LoggedError;
}

export type LogEvent = ApiRequestEvent | ApiDeniedEvent | ApiErrorEvent;

type ConsoleWriterMap = Record<LogEvent['event'], (line: string) => void>;

// The console method sets the level that hosts such as Vercel show and filter by.
// A Record keyed by every event name fails to compile when a new event has no level.
// Arrow functions, not `console.log` itself: they look the method up on each call,
// so a test's vi.spyOn(console, 'log') still sees the write.
const CONSOLE_WRITERS: ConsoleWriterMap = {
  // console.log is allowed in this file only: see the no-console override in eslint.config.js
  'api.request': (line) => console.log(line),
  'api.denied': (line) => console.warn(line),
  'api.error': (line) => console.error(line),
};

/** Writes one event as one JSON line */
export function logEvent(event: LogEvent): void {
  CONSOLE_WRITERS[event.event](JSON.stringify(event));
}

/** What a thrown value says about itself, minus the parts that can carry user data */
export function toLoggedError(error: unknown): LoggedError {
  if (!(error instanceof Error)) {
    return { name: 'NonError', message: String(error) };
  }

  // Drizzle's message embeds the query's parameters, which hold user data such as note
  // text or emails. Its cause is the database's own error: relation "notes" does not exist.
  const source =
    error instanceof DrizzleQueryError && error.cause instanceof Error ? error.cause : error;

  return {
    name: source.name,
    message: source.message,
    stack: error.stack?.split('\n').filter((line) => line.trimStart().startsWith('at ')),
  };
}
```

- **`RequestLogContext`** holds the fields every event shares. It is the one place a new shared field would go, so adding a risky one is a visible decision. `logEvent` takes object literals, and TypeScript rejects an unknown key such as `headers` in a literal.
- **`userId: string | null`.** `JSON.stringify` drops `undefined` fields. A 401 line without a `userId` key would look like a logging bug. `null` says "nobody was signed in". This is a boundary conversion: inside the code, "no caller" is still `undefined` (`resolveApiCaller`), and the log turns it into `null`.
- **`CONSOLE_WRITERS` is a `Record` keyed by every event name.** Add a fourth event to `LogEvent` and the file stops compiling until that event has a level. The values are arrow functions, not `console.log` itself. A stored `console.log` would be the original function captured at import, and a test's `vi.spyOn(console, 'log')` would never see the write.
- **`toLoggedError`** is the subtle part. Drizzle wraps a failed query in `DrizzleQueryError`, whose message is `Failed query: <sql>\nparams: <values>`, and the values are user data such as note text or emails (see `drizzle-orm/errors.js`). So it logs the database's own error from `.cause` (`relation "notes" does not exist`), and only the `at …` stack frames, because the stack's first lines repeat the message. A value thrown that isn't an `Error` is described as `NonError`.
- **`import 'server-only'`** keeps the logger out of client bundles, like `auth.ts` and `guard.ts`.
- **Rejected:** a logging library such as pino (a dependency and bundling setup for three events; Phase 10's log shipping replaces this one file), `console.log(object)` (multi-line output in production), and logging the whole `Error` (it carries Drizzle's message).

Run lint from the package:

```bash
cd packages/core
npx eslint src/observability/log.ts
```

It fails with `no-console` on the `console.log` line: the repo allows only `console.warn` and `console.error`. That is expected. Step 3 fixes it.

---

## Step 3 — Allow `console.log` in the Logger Only

> **What and why:** The `no-console` rule stays, because a stray `console.log` anywhere else is a bug. The logger is the deliberate exception, and exceptions to architectural rules live in `eslint.config.js`, next to the rule they bend.

1. In `eslint.config.js`, add this block directly after the `// ── Correctness ──` block that sets `no-console`:

```js
  {
    // The structured logger is the one file that writes logs with console.log:
    // every other file logs through it. warn and error stay allowed everywhere.
    files: ['packages/core/src/observability/log.ts'],
    rules: {
      'no-console': ['error', { allow: ['log', 'warn', 'error'] }],
    },
  },
```

- **Order matters.** In flat config, a later block wins for the files it matches, so this block must come after the one that sets the rule.
- **Options are replaced, not merged.** That's why `warn` and `error` are listed again. It's the same reason the `rls.ts` block repeats its import bans.
- **`allow`, not `'off'`.** `console.info`, `console.debug` and `console.table` stay banned even here.
- **`files` is relative to `eslint.config.js`,** not to where ESLint runs, so it matches when `pnpm lint` runs from inside `packages/core`.
- **Why not an inline `// eslint-disable-next-line no-console`?** An inline disable fits a one-off judgement call. This is a policy ("the logger is the one file allowed to write to stdout"), like "`rls.ts` is the one file allowed to import the raw client". Keeping policies in one file means every exception shows up in one place for review. A plain comment in `log.ts` points readers to the override, so the readability of a co-located comment is kept.
- **Adopting a new rule on old code** is a separate problem, with its own tool: ESLint's bulk suppressions (`eslint --suppress-rule <rule>`, since ESLint 9.24). They record existing violations in `eslint-suppressions.json`, so the rule fails only on new code, without touching any file.

2. Prove it, both ways:

```bash
npx eslint src/observability/log.ts   # clean now
```

Then add `console.log('x');` to the end of `src/api/guard.ts` and run `pnpm lint` from the repo root. `no-console` fires on `guard.ts` only. Remove the line.

---

## Step 4 — Log From the Guard

> **What and why:** The guard is the one place that logs. The checks no longer respond or log themselves: they **return** what they decided, and `withApiGuard` turns that into log lines and a response. One function decides, the other acts, so every exit is logged exactly once.

Replace `packages/core/src/api/guard.ts` with:

```ts
import 'server-only';

import { withRLS, type RlsTx } from '../db';
import { resolveApiCaller, type ApiCaller } from './auth';
import { getEnabledFeatures } from '../features/entitlements';
import { type ApiDeniedEvent, logEvent, toLoggedError } from '../observability/log';

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

/** Why the checks turned a caller away: the fields api.denied adds to the request's */
type GuardDenial = Pick<ApiDeniedEvent, 'code' | 'feature' | 'scope'>;

/**
 * The auth, scope and feature checks, then the handler. Decides and never logs:
 * withApiGuard logs what it returns, and what it throws.
 */
async function authorizeAndHandle<Ctx>(
  caller: ApiCaller | undefined,
  handler: ApiHandler<Ctx>,
  opts: GuardOptions,
  req: Request,
  ctx: Ctx,
): Promise<Response | GuardDenial> {
  // No caller: nobody signed in, or an API key we can't look up yet (Phase 9)
  if (!caller) {
    return { code: 'UNAUTHENTICATED' };
  }

  // Needs no database, so it runs before a transaction (and a pooled connection) is taken
  if (isMissingScope(caller, opts.requireScope)) {
    return { code: 'SCOPE_MISSING', scope: opts.requireScope };
  }

  return withRLS(caller.userId, async (tx) => {
    if (opts.feature && !(await getEnabledFeatures(tx)).includes(opts.feature)) {
      return { code: 'FEATURE_DISABLED', feature: opts.feature };
    }

    return handler({ tx, caller, req, ctx });
  });
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
 * - It is the one place that logs: api.denied, api.error, then api.request for every request
 */
export function withApiGuard<Ctx = unknown>(
  handler: ApiHandler<Ctx>,
  opts: GuardOptions = {},
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async function apiGuard(req, ctx) {
    const startedAt = performance.now();
    const request = { method: req.method, path: new URL(req.url).pathname };
    // Known once the caller resolves, and still needed if a later step throws
    let userId: string | null = null;
    let response: Response;

    try {
      const caller = await resolveApiCaller(req);
      userId = caller?.userId ?? null;

      // `await`, not a bare promise: the try/catch only catches a rejection it awaits
      const outcome = await authorizeAndHandle(caller, handler, opts, req, ctx);

      if (outcome instanceof Response) {
        // request was resolved
        response = outcome;
      } else {
        // Turned away: log why, then send the matching { error, code } body
        logEvent({ event: 'api.denied', ...request, userId, ...outcome });
        response = guardError(outcome.code);
      }
    } catch (error) {
      // withRLS has already rolled the transaction back
      logEvent({ event: 'api.error', ...request, userId, error: toLoggedError(error) });
      response = guardError('INTERNAL');
    }

    logEvent({
      event: 'api.request',
      ...request,
      userId,
      status: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
    });
    return response;
  };
}
```

- **`authorizeAndHandle` decides; `withApiGuard` logs.** It returns the handler's `Response`, or a `GuardDenial` saying why the caller was turned away. It never logs and never catches. `withApiGuard` logs `api.denied` for a denial, `api.error` for a throw, and `api.request` for everything, once, at the end.
- **The auth check lives in `authorizeAndHandle`** with the other two refusals. `resolveApiCaller` only answers "who is this?". `authorizeAndHandle` answers "may they?".
- **`GuardDenial = Pick<ApiDeniedEvent, 'code' | 'feature' | 'scope'>`.** A denial carries exactly the fields `api.denied` adds, so `...outcome` spreads straight into the event. It's a `type` because `Pick` is a mapped type.
- **`outcome instanceof Response`** tells the two results apart: `Response` is a class, and a denial is a plain object. TypeScript narrows each branch. A `kind` tag isn't needed when one side of the union is a class.
- **`let userId`** is assigned in plain sight, once the caller resolves. It stays a `let` because `api.error` still needs it when a later step throws. It's local to the one function that reads it, so nothing mutates it from elsewhere.
- **`let response` without an initial value.** TypeScript's definite-assignment check proves that every path assigns it before the `api.request` line.
- **`await authorizeAndHandle(…)` inside the `try`.** The `try/catch` only catches a rejection it awaits. `authorizeAndHandle` itself can `return withRLS(…)` without `await`, because it has no `try` of its own: the rejection travels up to the awaited call.
- **`caller` stays narrowed inside the `withRLS` callback.** After `if (!caller) return …`, TypeScript (5.4+) keeps the narrowing in closures created later, because a parameter that is never reassigned can't change.
- **Latency** comes from `performance.now()`, not `Date.now()`. It's monotonic (it never jumps when the server clock syncs), and `Math.round` trims sub-millisecond noise. It covers authentication, entitlements and the handler, not Next.js's routing.
- **`DenyCode` must be a subset of `GuardErrorCode`,** or `guardError(outcome.code)` won't compile. The log's code and the client's code can't drift apart.

Check: `pnpm --filter @sidekick/core typecheck`, `lint` and `test` pass. The old tests now print JSON lines among their output, which step 6 silences.

---

## Step 5 — Test the Logger

> **What and why:** Prove that each event goes to its console method as one parseable line, and that `toLoggedError` drops Drizzle's parameters.

Create `packages/core/src/observability/log.test.ts`:

```ts
import { DrizzleQueryError } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type LogEvent, logEvent, type RequestLogContext, toLoggedError } from './log';

const MOCK_LOG_CONTEXT: RequestLogContext = {
  method: 'GET',
  path: '/api/test',
  userId: 'mock-user-id',
};

const MOCK_LOG_EVENT_ARGS: readonly {
  mockEvent: LogEvent;
  consoleMethod: 'log' | 'warn' | 'error';
}[] = [
  {
    mockEvent: { event: 'api.request', ...MOCK_LOG_CONTEXT, status: 200, latencyMs: 12 },
    consoleMethod: 'log',
  },
  {
    mockEvent: {
      event: 'api.denied',
      ...MOCK_LOG_CONTEXT,
      code: 'FEATURE_DISABLED',
      feature: 'taxila',
    },
    consoleMethod: 'warn',
  },
  {
    mockEvent: {
      event: 'api.error',
      ...MOCK_LOG_CONTEXT,
      error: { name: 'Error', message: 'boom' },
    },
    consoleMethod: 'error',
  },
];

describe('logEvent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(MOCK_LOG_EVENT_ARGS)(
    'writes $mockEvent.event as one JSON line to console.$consoleMethod',
    ({ mockEvent, consoleMethod }) => {
      const consoleSpy = vi.spyOn(console, consoleMethod).mockImplementation(() => {});
      logEvent(mockEvent);

      expect(consoleSpy).toHaveBeenCalledOnce();
      const [line] = consoleSpy.mock.calls[0];
      expect(line).not.toContain('\n');
      expect(JSON.parse(line)).toEqual(mockEvent);
    },
  );

  it('keeps a multi-line message on one line', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logEvent({
      event: 'api.error',
      ...MOCK_LOG_CONTEXT,
      error: { name: 'Error', message: 'first line\nsecond line' },
    });

    expect(consoleErrorSpy.mock.calls[0][0]).not.toContain('\n');
  });
});

describe('toLoggedError', () => {
  it('keeps the name, message and stack frames of an Error', () => {
    const loggedError = toLoggedError(new TypeError('cannot read "id"'));

    expect(loggedError.name).toBe('TypeError');
    expect(loggedError.message).toBe('cannot read "id"');
    expect(loggedError.stack?.length).toBeGreaterThan(0);
    expect(loggedError.stack?.every((frame) => frame.trimStart().startsWith('at '))).toBe(true);
  });

  it('drops the query parameters a Drizzle error carries in its message', () => {
    const mockDrizzleError = new DrizzleQueryError(
      'insert into "notes" ("body", "owner_email") values ($1, $2)',
      ['my secret note', 'jane@example.com'],
      new Error('relation "notes" does not exist'),
    );
    const loggedError = toLoggedError(mockDrizzleError);

    expect(loggedError.message).toBe('relation "notes" does not exist');
    expect(JSON.stringify(loggedError)).not.toMatch(/secret note|jane@example\.com/);
  });

  it('describes a thrown value that is not an Error', () => {
    expect(toLoggedError('boom')).toEqual({ name: 'NonError', message: 'boom' });
  });
});
```

- **`it.each` over object rows** turns "which event goes to which console method" into a table. `$mockEvent.event` and `$consoleMethod` in the title come from the row (`$name` only works with object rows). The rows are typed as `LogEvent`, so an extra or misspelled field fails to compile. `as const` alone would lose that check, because excess-property checks only run on fresh object literals.
- **`vi.spyOn(console, …).mockImplementation(() => {})`** records the call and keeps the output quiet. `afterEach(vi.restoreAllMocks)` puts the real `console` back.
- **`JSON.parse(line)` then `toEqual`** proves the line round-trips, the way a log host reads it.
- **One line, even with `\n` in a message.** `JSON.stringify` escapes newlines, so a multi-line stack can't split one event into two.
- **The Drizzle test** builds a real `DrizzleQueryError` with a note body and an email as parameters, and proves neither reaches the log.

Prove it: in `toLoggedError`, change `const source = …` to `const source = error;`. The Drizzle test fails and prints `my secret note`. Put it back.

---

## Step 6 — Test the Guard's Logging

> **What and why:** Prove each outcome logs the right events, in order, with the right fields, and that no cookie, token or query value ever reaches a log line.

Update `packages/core/src/api/guard.test.ts` to:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockHttpRequest } from '../../tests/helpers/http';
import { MOCK_KEY_CALLER, MOCK_RLS_TX, MOCK_SESSION_CALLER } from '../../tests/helpers/mocks';
import { withRLS } from '../db';
import { getEnabledFeatures } from '../features/entitlements';
import { resolveApiCaller } from './auth';
import { type ApiHandler, withApiGuard } from './guard';
import { type LogEvent, logEvent } from '../observability/log';

vi.mock('./auth', () => ({ resolveApiCaller: vi.fn() }));
vi.mock('../db', () => ({ withRLS: vi.fn() }));
vi.mock('../features/entitlements', () => ({ getEnabledFeatures: vi.fn() }));
// Spies that keep the real code: toLoggedError runs for real, logEvent is silenced below
vi.mock('../observability/log', { spy: true });

const mockHandler = vi.fn<ApiHandler<unknown>>();

/** Every event the guard logged, in order */
function loggedEvents(): LogEvent[] {
  return vi.mocked(logEvent).mock.calls.map(([event]) => event);
}

/** The fields every event for createMockHttpRequest() carries */
const MOCK_REQUEST_FIELDS = { method: 'GET', path: '/api/test' };

describe('withApiGuard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_SESSION_CALLER);
    // Run the callback the way withRLS does, minus the database
    vi.mocked(withRLS).mockImplementation(async (_userId, fn) => fn(MOCK_RLS_TX));
    vi.mocked(getEnabledFeatures).mockResolvedValue(['core-drive']);
    vi.mocked(logEvent).mockImplementation(() => {});
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
      MOCK_SESSION_CALLER.userId,
    ],
    [
      'resolveApiCaller',
      () => vi.mocked(resolveApiCaller).mockRejectedValue(new Error('no env')),
      null,
    ],
  ])('turns a throw in %s into a generic 500', async (_where, makeItThrow, loggedUserId) => {
    makeItThrow();
    const response = await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

    expect(response.status).toBe(500);
    // Exactly the generic body: no message, stack or SQL reaches the client
    expect(await response.json()).toEqual({ error: 'Internal error', code: 'INTERNAL' });

    // The details go to the server log instead
    expect(loggedEvents()).toEqual([
      {
        event: 'api.error',
        ...MOCK_REQUEST_FIELDS,
        userId: loggedUserId,
        error: expect.objectContaining({ name: 'Error' }),
      },
      expect.objectContaining({ event: 'api.request', status: 500 }),
    ]);
  });

  describe('logging', () => {
    it('logs one api.request with status and latency for an allowed request', async () => {
      await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

      expect(loggedEvents()).toEqual([
        {
          event: 'api.request',
          ...MOCK_REQUEST_FIELDS,
          userId: MOCK_SESSION_CALLER.userId,
          status: 200,
          latencyMs: expect.any(Number),
        },
      ]);
    });

    it('logs api.denied with a null userId before the api.request for a 401', async () => {
      vi.mocked(resolveApiCaller).mockResolvedValue(undefined);
      await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

      expect(loggedEvents()).toEqual([
        { event: 'api.denied', ...MOCK_REQUEST_FIELDS, userId: null, code: 'UNAUTHENTICATED' },
        expect.objectContaining({ event: 'api.request', status: 401, userId: null }),
      ]);
    });

    it('logs the missing scope for a scope denial', async () => {
      vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_KEY_CALLER);
      await withApiGuard(mockHandler, { requireScope: 'notes:write' })(
        createMockHttpRequest(),
        undefined,
      );

      expect(loggedEvents()[0]).toEqual({
        event: 'api.denied',
        ...MOCK_REQUEST_FIELDS,
        userId: MOCK_KEY_CALLER.userId,
        code: 'SCOPE_MISSING',
        scope: 'notes:write',
      });
    });

    it('logs the missing feature for a feature denial', async () => {
      await withApiGuard(mockHandler, { feature: 'taxila' })(createMockHttpRequest(), undefined);

      expect(loggedEvents()[0]).toEqual({
        event: 'api.denied',
        ...MOCK_REQUEST_FIELDS,
        userId: MOCK_SESSION_CALLER.userId,
        code: 'FEATURE_DISABLED',
        feature: 'taxila',
      });
    });

    it('logs the pathname only, and never a cookie, token or query value', async () => {
      const mockRequest = new Request(
        'http://localhost/api/test?email=jane%40example.com&token=query-secret',
        {
          headers: {
            authorization: 'Bearer header-secret',
            cookie: 'sb-access-token=cookie-secret',
          },
        },
      );
      await withApiGuard(mockHandler)(mockRequest, undefined);

      expect(loggedEvents()[0]).toMatchObject({ path: '/api/test' });
      expect(JSON.stringify(loggedEvents())).not.toMatch(
        /jane|query-secret|header-secret|cookie-secret/,
      );
    });
  });
});
```

- **`vi.mock(path, { spy: true })`** turns every export into a spy that still runs the real code. `logEvent` is silenced in `beforeEach`, while `toLoggedError` keeps working, so the 500 test checks a real `LoggedError`. A factory mock (`() => ({ logEvent: vi.fn() })`) would have made `toLoggedError` a stub returning `undefined`.
- **The silencing sits in `beforeEach`,** after `vi.resetAllMocks()`, because a reset puts a spy back to the real implementation.
- **`loggedEvents()`** turns the spy's calls into an array, so a test asserts the whole sequence: `api.denied`, then `api.request`. `toEqual([...])` also fails on an extra or a missing event, which proves "exactly one `api.request` per request".
- **`expect.any(Number)`** for `latencyMs`: its value varies by machine, so the test checks the field's presence and type, not its value.
- **The two 500 rows expect different `userId`s.** A handler throw happens after the caller is known. A `resolveApiCaller` throw happens before, so the log says `null`.
- **The secrets test** sends a query value, an email, an `Authorization` header and a Supabase cookie, then searches the serialized log for all four. Serializing catches a secret at any depth, and the test still holds if someone adds a leaky field later.

Prove it: in `guard.ts`, change `path: new URL(req.url).pathname` to `path: req.url`. The secrets test fails and prints the leaked query. Put it back.

---

## Step 7 — Verify Like CI and Ship

1. Run everything uncached:

```bash
pnpm prettier:check
pnpm turbo lint typecheck build test --force
pnpm test:integration
```

Expected: 21/21 Turbo tasks, 27 unit tests in `@sidekick/core`, and 17 integration tests. The integration guard test now prints real JSON lines, because it doesn't mock the logger.

2. Commit, push and open the PR. Use `git commit` without `-m` and write the message in the editor. That way the subject stays one short line, with a blank line before the body. `-m "…"` with a pasted multi-line message flattened it into a single subject line.

```bash
git add eslint.config.js packages/core/src/api packages/core/src/observability
git commit
git push -u origin feature/P2L5-logging
gh pr create --base main --fill
```

Wait for the `checks` job, then squash-merge.

---

## What you have now

- `packages/core/src/observability/log.ts`: typed events, `logEvent` writing one JSON line per event at the right level, and `toLoggedError`, which keeps query parameters out of error logs.
- `withApiGuard` logs every request (`api.request`), every 401 and 403 (`api.denied` with its `code` and the missing feature or scope), and every 500 (`api.error`), from one place. The checks live in `authorizeAndHandle`, which decides and returns.
- `console.log` is allowed in the logger only, through a per-file `no-console` override.
- Seven logger tests and five new guard logging tests, including one that proves no cookie, token or query value is ever logged.

Next: [[task-2-11and2-12|lesson 6]], the `/api/health` route and testing HTTP by hand.
