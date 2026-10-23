---
publish: false
id: notes.phase-2.lesson-4
title: "Phase 2 lesson 4 notes: withApiGuard"
created: 2026-10-23
updated: 2026-10-23
kind: notes
version: 1.0.0
tags:
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

These notes record what lesson 4 taught: the mental models, the decisions Pratik changed, and the mistakes worth remembering. The steps to reproduce it are in [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-4-with-api-guard|the walkthrough]]. The decisions are recorded in [[contracts#Guard|contracts]].

The thread running through the lesson: **the guard is a promise about order.** Cheap checks before expensive ones, the database only when needed, one transaction per request, and nothing internal reaches the client. Each promise has a test that proves it, mostly by asserting what did _not_ happen.

---

## How the lesson ran

Lessons 1–3 were Socratic: the coach asked design questions and Pratik wrote the code. Partway into this lesson, Pratik switched modes because that takes more time than a phase allows. Now the coach gives the exact code for each piece, with the reasoning, concepts, consequences and trade-offs below it. Pratik types it in, questions it, and changes it. These notes and the walkthrough are what make that work: everything explained during the session is written down here to come back to.

The switch didn't make Pratik passive. Four of their questions changed or confirmed the design (below).

---

## Higher-order functions

- A higher-order function takes a function and returns a new one that does work around it. `withTiming(fn)` was the warm-up example. React's `connect(Component)` is the same pattern for components.
- `withApiGuard(handler)` runs nothing when the module loads. It returns `(req, ctx) => Promise<Response>`, which is what Next.js calls per request.
- That shape is what makes the lint rule possible: `export const GET = withApiGuard(...)` is visible in the source, so ESLint can prove every route is wrapped without running anything.
- Every HTTP method is its own export with its own options, so `POST` can require `notes:write` while `GET` requires `notes:read`.

## Generics through `Ctx`

Next.js's second route-handler argument depends on the route (`{ params }` for dynamic segments). The guard doesn't care what it holds and only passes it through. `withApiGuard<Ctx>` lets TypeScript infer `Ctx` from the handler, so the type survives the wrapper. Without the generic it would be `unknown` or `any` inside every handler.

## The order of checks

| Check                           | Why it sits there                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Auth first                      | With no caller, nothing else is worth doing                                                                                      |
| Scope before the transaction    | Pure in-memory logic; a rejected key never takes a pooled connection                                                             |
| Feature inside the transaction  | Entitlements are RLS-protected, so they're only visible once `withRLS` sets the user; outside, it would cost a second connection |
| Handler in the same transaction | Its queries are filtered to the caller, and its writes commit or roll back together                                              |

## Transactions: commit, rollback and `return await`

- Drizzle's `transaction()` commits when the callback **resolves** and rolls back when it **throws**.
- So a handler that writes and then _returns_ a 400 keeps the write. This answers the brief's check question ("If a handler returns a 400 after writing a row, is the row kept?"): yes, and it shouldn't be relied on. Handlers validate before they write, or throw to undo. The integration test pins the behaviour so nobody is surprised.
- `return withRLS(...)` inside `try` returns the promise without awaiting it, so a rejection escapes the `catch`. `return await` keeps it inside. **Correction:** Pratik's first comment said the database error would otherwise reach the browser. In production, Next.js answers an uncaught error with a bare 500 and an empty body. What we'd lose is our log and our `{ error, code }` shape, not secrecy.

## Pratik's design questions

### Why pass `userId` when `caller.userId` exists?

Pratik asked why handlers couldn't just read `caller.userId`, since `caller` is already narrowed to `ApiCaller`. Nothing prevents it: `userId` was a shortcut carried over from the original sketch, and two copies of the same value can drift. **Pratik's version won.** `ApiHandlerArgs` has no `userId`, and the contract changed (version 2.5.0).

### Should `feature` be required?

Pratik's instinct was fail-closed, like the lint rule. It stays optional, because core routes (`/api/health`, account settings, "which features do I have?") belong to no feature. A forgotten `feature` exposes a feature the user hasn't enabled, but never another user's data: auth and RLS still protect that. Pratik also suggested an always-present `[app]` pseudo-feature. It was rejected because it's a magic value every user would need a row for, and it would still cost the query. The stronger fix comes in Phase 4: routes inside a feature package can take the key from their manifest.

### A `Map` for faster lookups?

Pratik changed `getEnabledFeatures` to return `Map<string, true>`. It was reverted, for three reasons:

- **No speed gain.** A `Set` or `Map` wins only for repeated lookups. The guard looks up once, and building the collection is itself a full pass over the list, so for one lookup on fewer than 20 keys it's no faster than `includes`.
- **A Map with an always-`true` value is a Set.** If a collection were ever worth it, `ReadonlySet<string>` would say what it is.
- **It broke a test that `tsc` missed.** It changed lesson 3's contract, and `[...map].sort()` in the entitlements test still type-checked but compared `[key, true]` pairs at runtime.

If speed ever matters, the real fix is asking the database for the one key (`WHERE feature_key = $1`), which uses the primary-key index. Pratik's summary: the map is built on every call, so building it costs more than one lookup saves.

### Vague codes for the client, details for the server?

Pratik proposed sending a generic 403 for both scope and feature failures, so an attacker learns less. The server-side half is lesson 5's `api.denied` log. For the client, the two codes stay distinct:

- Vague errors protect **unauthenticated** surfaces. The classic case is a login form saying "invalid email or password", so nobody can find out which emails exist.
- This caller is signed in and asking about their own account. Their key's scopes and their features are already visible to them, so the code reveals nothing new.
- The UI needs to tell "enable this feature" from "this key needs `notes:write`".
- 401 vs. 403 must differ regardless, so the client knows whether to send the user to sign in.

## Mistakes caught in review

- **`enabledFeatures.has(opts.feature ?? '')`** made every route without a `feature` return 403, because nobody has a feature called `''`. `/api/health` would never have worked.
- **The query ran before the "no feature" check.** After the fix, `!opts.feature || enabledFeatures.includes(...)` was correct but still queried entitlements on featureless routes. `opts.feature && !(await getEnabledFeatures(tx)).includes(...)` short-circuits the query away. The unit test "does not read entitlements when no feature is required" failed against the first fix and passed against the second.
- **The `./api` export was missing** from `package.json` in the first pass.

## Testing

### Unit vs. integration: what each can prove

The unit test mocks `resolveApiCaller`, `withRLS` and `getEnabledFeatures`, so it proves only the guard's own decisions. Its most important assertions are negative (`not.toHaveBeenCalled()`), because "cheap checks first" is a promise about what doesn't run. The integration test mocks only the caller and proves what the unit test can't: RLS isolation, real entitlements, commit and rollback.

### `vi.mock` replaces modules, not functions

The path in `vi.mock` must be the one the code under test imports (`'../db'`), not where the function is defined (`'../db/rls'`, as the brief said). The code won over the brief here. Vitest hoists `vi.mock` above the imports and applies it per file, which is also why mocks can't be registered from a shared helper.

### Shared helpers, not a package (yet)

Pratik proposed a `@sidekick/test-utils` package. All the duplication was inside `packages/core` (`requireEnv` copied in three integration tests, request builders in two unit tests). So it became `packages/core/tests/helpers/` in its own PR, [sidekick#18](https://github.com/mehtapratik/sidekick/pull/18), and moves to a package when a second package needs it. The database helpers are factories, so each test file owns and closes its own connections.

### Random ids per file, not shared fixtures

Pratik suggested ready-made ids (`userIdJane`, `userIdJoe`) in `mocks.ts`. Integration files share one database and run in parallel, so fixed ids would collide on insert and leak deletes and edits between files. Random ids per file keep them isolated, and `randomUUID()` costs about a microsecond. Names describe the role in the test (`entitledUserId`), not a persona. An unauthenticated caller has no id at all (`resolveApiCaller` returns `undefined`), and `anon` is a database role, not a user. Unit tests already share a fixed `MOCK_USER.id`, because they never touch a database.

## Coding standard: full qualifiers

Pratik added a standard: name things by their full qualifier. `MOCK_SESSION_CALLER` stays `MOCK_SESSION_CALLER` even inside `mocks.ts`, because the name travels into every file that imports it. In practice: `MOCK_…`, `createMock…`, `mockHandler`, `mockCtx`, `consoleErrorSpy`, `testAdminDb`. Recorded as standard 6 in [[coding-standards]].

## Shipping

- The helpers PR merged first, and the guard branch was stacked on it. After a squash merge, the stacked branch still carries the original helpers commit. `git rebase --onto origin/main chore/core-test-helpers feature/P2L4-api-guard` drops it, so the guard PR shows only its own changes.
- `explicit-module-boundary-types` required return types on the exported helper factories (`Sql`, `SupabaseClient`), which matches standard 4 (explicit types for exported members only).
