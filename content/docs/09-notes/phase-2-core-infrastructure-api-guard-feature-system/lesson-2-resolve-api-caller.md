---
publish: false
id: notes.phase-2.lesson-2
title: "Phase 2 lesson 2 notes: resolveApiCaller"
created: 2026-10-20
updated: 2026-10-23
kind: notes
version: 1.1.0
tags:
   - phase-2
   - api-guard
   - authentication
   - supabase
   - typescript
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-1]]"
---

These notes record what lesson 2 taught: the mental models, the surprises and the mistakes worth remembering. The steps to reproduce it are in [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-2-resolve-api-caller|the walkthrough]]. The decisions are recorded in [[contracts#Caller|contracts]].

The thread running through the lesson: **when in doubt, there is no caller.** Every uncertain case (no cookie, a bad token, an Auth outage, an API key we can't check yet) collapses into one "no caller" value, and the type system makes it impossible to skip. That value was `null` during the lesson and became `undefined` afterwards (see the last section).

---

## Who is calling

### The proxy skips `/api`, but still refreshes the session

The proxy redirects signed-out _pages_ to `/login`. An API caller wants a 401, not an HTML redirect, so `/api` passes through untouched and every route authenticates itself. The proxy still calls `getUser()` first, which refreshes an expired access token and writes the new cookies to both the request and the response. Refresh tokens are single-use, so refreshing once, in one place, avoids two clients racing with the same token. A Server Component can't write cookies at all, which is the swallowed `catch` in `server.ts`.

The guard re-checks anyway. It must not trust the proxy, whose matcher could change.

### Authentication and authorization are separate layers

`resolveApiCaller` answers only "who?". "What may they do?" comes from layers that apply to every caller:

| Layer        | Decides                               | Belongs to  |
| ------------ | ------------------------------------- | ----------- |
| RLS          | which rows                            | the user    |
| Entitlements | which features (lesson 3)             | the user    |
| Scopes       | what a delegated key may do (Phase 9) | one API key |

At first, scopes and entitlements blurred together, and a session seemed to need scopes too ("can read Taxila but not edit"). It doesn't. A rule that depends on _which row_ belongs in an RLS policy. Scopes exist for **delegation**: an API key is a password handed to a program, and scopes cap the damage if it leaks. A key's effective permission is everything the user can do, narrowed to what the key's scopes allow. A session already _is_ the user, so "no scopes" means no extra limit, not no permission.

### A Bearer header beats the cookie

The first answer was "the cookie should win", and it was wrong. The browser attaches cookies to every request automatically, but code adds a Bearer header on purpose. An extension holding a `notes:read` key, running in a browser where you're signed in, would get your full session if the cookie won. That's **privilege escalation**, and a revoked key would keep working unnoticed. So the header is checked first, it returns before the cookie is read, and that also saves a network call.

### Fail closed

Phase 9's key table doesn't exist, so any Authorization header resolves to `null`. Accepting an unchecked token would be an open door. The check can only take access away, never grant it, so an attacker controlling the header gains nothing and its content needs no validation yet. Content validation (hash, lookup, owner, expiry, revocation) matters in Phase 9, when the content starts to grant access. The same goes for an account number in a header: checking that it's present isn't enough once it grants something. The one standing rule: never log the header.

### `getUser()`, not `getSession()`

`getSession()` trusts the cookie as sent, and the user can edit a cookie. `getUser()` asks Supabase Auth to verify the token. With no session, `getUser()` returns `AuthSessionMissingError`, not `error: null`. That was checked in `@supabase/auth-js`'s source after a wrong guess.

### Loud vs. silent

"Not signed in" is an answer (`null`). Missing env vars mean a misconfigured app, which is a bug, so `createServerClient()`'s throw stays uncaught ([[error-handling]]). One accepted trade-off: an Auth outage also yields `null`, so callers get a 401 rather than a 500.

---

## TypeScript

### Discriminated unions

`{ kind: 'session'; … } | { kind: 'key'; … }`: checking `kind` narrows the type, so `scopes` exists only in the key branch. The first design put `scopes` and a function (`fn`) on both variants, and `| null` inside the type. Each was taken out for a reason:

- `fn` came from `withRLS(userId, fn)`, but the caller is data and the guard brings the function.
- An invented `scopes` for sessions would be `[]` (blocks everyone) or `['*']` (a magic string).
- `null` inside `ApiCaller` would force every handler to re-check something the guard already ruled out. On the return type, it's checked exactly once.

Pratik's final version used named interfaces (`SessionBasedApiCaller`, `KeyBasedApiCaller`) joined in a union, which beat the planned inline union: a function can take just the key variant. The tag became `'key'` rather than `'apiKey'`. Supabase uses the same pattern: `getUser()` returns a union keyed on `error`.

### Why a bare "no caller", not `{ userId: undefined }`

This was the one check-understanding question that needed a hint. An object is always truthy, so a guard's `if (!caller)` wouldn't catch `{ userId: undefined }`. The request would carry on into `withRLS(undefined, …)`, with no 401. The likely outcome is a driver error and a 500, or, if the value ever became `''` or `'undefined'`, queries that silently match no rows. The failure is the wrong one, far from its cause. `userId: string` makes TypeScript reject it, and CI's `typecheck` stops it landing. **The type turns a runtime surprise into a compile error.**

### Trust the types; validate where types can't see

Pratik's heuristic was "validate at the edges, trust well-tested code". Refined: what crosses the edge is the _data_, not the library. `headers.get()` is trusted to return `string | null` (never `undefined`, per `lib.dom`), but the value is whatever the sender sent. Trust typed code's types, whatever the library's popularity, and validate where TypeScript can't see the data: `JSON.parse`, `response.json()`, env vars.

### `Request`, not `NextRequest`

`NextRequest` extends the web-standard `Request`, so taking `Request` accepts both, keeps `core` free of Next for this type, and lets tests build `new Request(…)`.

---

## Testing

### `vi.mock`

- It replaces a module for every importer in the test run, including the test file's own import. That's how `vi.mocked(fn)` reaches the same `vi.fn` the code calls. With a single fixed behaviour in the factory, no reference is needed. Per-test values or call assertions need the import.
- It's **hoisted** above the imports. A factory that reads a top-level `const` directly throws `Cannot access … before initialization`. Reading one inside a function that runs later works, but that's fragile. `vi.hoisted()` is the tool for it.

### Mistake: `beforeEach` from `node:test`

An auto-import brought `beforeEach` from Node's test runner. Under Vitest it never runs, without any warning, so the mocks were never reset. A probe confirmed it. **The second lesson of Phase 2 with a silent no-op**: always import test APIs from `'vitest'`.

### Surprise: Vitest 5 clears call counts by default

The coach claimed mock call counts carry over between tests. A probe showed they don't (`clearMocks` defaults on), but a `mockReturnValue` _does_ leak into the next test. So `resetAllMocks` is still needed. **Verify a framework claim with a probe before teaching it.**

### Mistake: tests that passed but checked nothing

- **Typecheck failed while tests passed.** Vitest strips types without checking them, so fakes with impossible shapes (`data: {}`) ran green. Only `pnpm typecheck` caught them.
- **The Bearer tests first asserted only `not.toHaveBeenCalled()`**, so they'd have passed if the function returned a session caller. Assert the result too.
- **Every "no header" request actually sent `Authorization: ''`**, so the normal browser request (no header at all) wasn't tested. A different header check (`!== null`) would have failed all of them.
- **A fake `headers.get()` ignored the header name**, so no test could catch code reading the wrong header. Use the platform's real `Request`.
- `string | undefined` for the token parameter would make `new Request` send the literal header `"undefined"`.

### Two failure modes when you break it

With the Bearer `return null;` commented out, one test failed its assertion (a session caller instead of `null`) and the other threw a `TypeError` (no client set, so `.auth` of `undefined`). An assertion says what's wrong, while a `TypeError` only says something broke. Prefer tests that fail on assertions.

---

## Shipping

- `--passWithNoTests` came off `core`'s test script as soon as `core` had tests (lesson 1's rule).
- `gh` wasn't logged in. `gh auth login` is the user's own step.
- PR #13 merged with a correct Conventional Commits title: `feat(core): add resolveApiCaller for session callers; bearer fails closed`.

## After the lesson: `undefined`, not `null`

After lesson 3, Pratik switched "no caller" from `null` to `undefined` ([sidekick#16](https://github.com/mehtapratik/sidekick/pull/16)) to follow their coding standard: prefer `undefined`, the value JavaScript already gives anything unassigned. Nothing else changed. The return type is `Promise<ApiCaller | undefined>`, the guard still sends a 401, and the tests assert `toBeUndefined()`, which fails on `null`, so a slip back is caught. Two things to keep in mind:

- Libraries keep their own convention. Supabase returns `user: User | null`, and `headers.get()` returns `string | null`. Convert at our boundary instead of leaking `null` inward.
- `undefined` disappears from JSON (`JSON.stringify({ a: undefined })` is `{}`), while `null` survives. That doesn't matter for an in-process value like the caller, but a value that crosses an API boundary needs a deliberate choice.

The argument above against `{ userId: undefined }` still holds: the point was a bare "no caller" value instead of a truthy object, not which empty value it is.

## How the lesson ran

Pratik chose to write every piece. Big open design questions ("what should the result hold?") got "I don't know". What worked was splitting them into one-field questions worked backwards from what uses the result, plus a generic pattern (a `Shape` union) to copy instead of the answer.
