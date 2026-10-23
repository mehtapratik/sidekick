---
publish: false
id: notes.phase-2.lesson-5
title: "Phase 2 lesson 5 notes: request and auth-failure logging"
created: 2026-10-23
updated: 2026-10-23
kind: notes
version: 1.0.0
tags:
   - phase-2
   - api-guard
   - observability
   - eslint
   - testing
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-4and2-5]]"
---

These notes record what lesson 5 taught: the mental models, the decisions Pratik changed, and the mistakes worth remembering. The steps to reproduce it are in [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-5-logging|the walkthrough]]. The decisions are recorded in [[contracts#Logging|contracts]].

The thread running through the lesson: **a log is a second API.** It has its own readers (people with dashboard access, for weeks), its own clients (machines that filter and count), and its own contract. So design what it may say before writing it, and prove what it must never say with a test.

---

## How the lesson ran

Same mode as lesson 4: the coach gave the exact code for each piece, with the reasoning below it, and Pratik typed it in, questioned it and changed it. Five pieces: the logger, the ESLint override, the guard wiring, the logger's tests and the guard's tests. The coach dry-ran every piece before handing it over. Pratik's questions reshaped the guard (below).

---

## Structured logs

- A free-text line (`Request GET /api/notes took 41ms`) is for a human. A JSON line is for a machine, which can filter `status >= 500`, count denials per `code`, or average `latencyMs` per `path`.
- **One event, one line.** Log hosts split on newlines. `JSON.stringify` escapes the `\n` inside a stack trace, so an event can't split in two. `console.log(object)` would print a multi-line object in production.
- **Levels come from the console method.** `console.log` is info, `console.warn` a warning, and `console.error` an error. Vercel maps these to the levels it shows and filters by, so the logger picks the method per event.
- **Why no logging library (pino and others):** a dependency and bundling setup, for three events. When Phase 10 ships logs somewhere, `log.ts` is the one file that changes.

## The events

| Event         | When                 | Adds                              |
| ------------- | -------------------- | --------------------------------- |
| `api.request` | end of every request | `status`, `latencyMs`             |
| `api.denied`  | every 401 and 403    | `code`, and `feature` or `scope`  |
| `api.error`   | every 500            | `error: { name, message, stack }` |

All three carry `method`, `path` and `userId`. A denied or failed request logs two lines: the reason, then `api.request`. Every request logs exactly one `api.request`.

### `null`, not `undefined`, at the JSON boundary

Pratik's standard is to prefer `undefined`. A log line is the exception, because `JSON.stringify` drops `undefined` fields. A 401 line with no `userId` key looks like a logging bug, while `userId: null` says "nobody was signed in". It's the same kind of boundary conversion as `resolveApiCaller` turning Supabase's `null` into `undefined`, in the other direction.

### `code`, not `reason`

Contracts v2.5.0 had `reason: unauthenticated | scope_missing | feature_disabled`. These are the same three facts as the client's `code`, in a second spelling. One vocabulary means a support report quoting `FEATURE_DISABLED` greps straight to the log, with no mapping table to drift. Contracts 2.6.0 records it.

## What must never be logged

The brief's two check-understanding questions:

- **Why log the pathname and not the full URL?** Query strings carry tokens (`?token=`), emails, invite codes and search terms. A log host keeps lines for weeks and shows them to everyone with access, so the query string would turn every leaked link into a leaked log.
- **What's the risk of logging `req.headers`?** It holds the `Cookie` with the Supabase session and any `Authorization` token. Anyone who reads the log could replay them and act as that user, until the session expires.

Never logged: headers, cookies, tokens, bodies, emails, query strings. The event types enforce part of this: `logEvent` takes object literals, so TypeScript rejects an unknown key such as `headers`. The rest is enforced by a test that sends all four kinds of secret and searches the serialized log for them.

## The Drizzle trap

Contracts v2.5.0 said `api.error` logs "the error's message and stack". Reading `drizzle-orm/errors.js` (v0.45.4) showed why that's not safe: a failed query throws `DrizzleQueryError`, whose message is `Failed query: <sql>\nparams: <values>`. The parameters are user data: a note's text, an email. The stack's first lines repeat the message, too.

`toLoggedError` logs the cause instead (the database's own error, such as `relation "notes" does not exist`), and only the `at …` stack frames. A test builds a real `DrizzleQueryError` with secret parameters and proves they don't survive.

Remaining risk, accepted: a few Postgres messages quote a value, for example `invalid input syntax for type uuid: "…"`. Postgres's `detail` field, which holds row values (`Key (email)=(…) already exists`), is never logged.

The lesson: before logging a library's error, read what its message contains. "Log the message" is only as safe as the library's message.

## Implementation details worth remembering

- **The writer map is a `Record` keyed by every event name.** A new event without a level fails to compile. That's exhaustiveness without a `switch`.
- **Arrow functions in the map, not `console.log` itself.** A stored `console.log` is the function captured when the module loads, and `vi.spyOn(console, 'log')` replaces the property afterwards, so the spy would never see the write. The arrow looks the method up on every call.
- **Don't use dynamic access like `console[level](line)`.** It would work, but `no-console` can't see a computed property, so it would also slip past the lint rule.
- **`performance.now()` for latency.** It's monotonic, so it never jumps when the server clock syncs, unlike `Date.now()`. Rounded to whole milliseconds.
- **`server-only` stays on the logger.** Pratik removed it in the first pass. Nothing broke, because only the server-only guard imports it. The line is the file's own promise: a Client Component importing the logger fails the build, instead of shipping stack frames to the browser console.
- **Naming.** Pratik renamed the coach's `ErrorDescription` / `describeError` to `ApiError` / `toApiError`, then to `LoggedError` / `toLoggedError`. "ApiError" reads like the `{ error, code }` body the client gets, which is exactly what this must never become.

## ESLint: an inline disable or a config override

Pratik first used `// eslint-disable-next-line no-console` and weighed both sides. The co-located comment is readable: nobody wonders why lint passed. Scattered disables, though, become a burden when adopting a new rule on an old codebase.

The resolution:

- **Inline disables** fit a one-off judgement ("this cast is safe because…").
- **Config overrides** fit a policy ("the logger is the one file that writes to stdout"), like the `rls.ts` exception. Every exception lives in one file, where review sees it. Anyone can add an inline disable in any PR without that file changing.
- **Readability is kept** by a plain comment in `log.ts` that points to the override. The comment explains; it doesn't switch anything off.
- **Adopting a rule on old code** has its own tool: ESLint's **bulk suppressions** (since ESLint 9.24). `eslint --suppress-rule <rule>` records existing violations in `eslint-suppressions.json`, and the rule fails only on new code, with no file touched.

Flat-config details: a later block wins for the files it matches; a rule's options are replaced, not merged (so `warn` and `error` are listed again); `allow` keeps `console.info` and `console.debug` banned even in the logger; and `files` is relative to the config file, not to ESLint's working directory.

## Pratik's design changes

### One place logs (Pratik's version won)

The coach's first version logged `api.request` in `withApiGuard`, but `api.denied` and `api.error` in a `runGuarded` helper. Pratik pointed out that this split one concern across two functions, and asked for all the logging in `withApiGuard`.

The redesign separates deciding from acting. `authorizeAndHandle` runs the checks and the handler, and **returns** either the handler's `Response` or a `GuardDenial` (`Pick<ApiDeniedEvent, 'code' | 'feature' | 'scope'>`). It never logs and never catches. `withApiGuard` turns that result into log lines and a response, and catches throws as `api.error`.

### No hidden mutation (Pratik's version won)

The first version created a `context` object with `userId: null` and passed it to `runGuarded`, which filled in `userId`. `api.request` then read the mutated object. Pratik called it unclear: the reader has to know the object was changed somewhere else.

`userId` is now a local `let` in `withApiGuard`, assigned in plain sight. It has to stay mutable: it's known only halfway through, and `api.error` still needs it when a later step throws. The fix is that only the function that reads it assigns it. The first version did get one thing right, and it's worth remembering: request-scoped state is safe only when it's created per request, inside the handler. At module level, concurrent requests would overwrite each other.

### The auth check moved into `authorizeAndHandle` (Pratik's version won)

The coach kept the 401 in `withApiGuard` (`caller ? await authorizeAndHandle(...) : { code: 'UNAUTHENTICATED' }`). Pratik moved it into `authorizeAndHandle`, which now takes `ApiCaller | undefined` and holds all three refusals. `resolveApiCaller` answers "who is this?", and `authorizeAndHandle` answers "may they?". The ternary disappeared.

TypeScript detail: after `if (!caller) return …`, `caller` stays narrowed inside the later `withRLS` callback. Since TypeScript 5.4, narrowing survives into closures for a parameter or `const` that's never reassigned. A reassigned `let` loses it.

### Constants or an enum for event names and codes (declined for now)

Pratik asked for constants or an enum, so there's one inventory of events and codes. Kept as literal unions:

- **The inventory already exists, and the compiler checks it.** The `LogEvent` union lists every event and its fields, `CONSOLE_WRITERS` is the runtime list, and `GUARD_ERRORS` lists every code. `DenyCode` must be a subset of it.
- **A literal union already gives what an enum gives:** autocomplete, a compile error on a typo, and greppable call sites. The string at the call site is also exactly what you search for in the log host.
- **`enum` emits JavaScript.** Node 24's type stripping (`node file.ts`) rejects enums, and TypeScript's `erasableSyntaxOnly` flag steers away from them for the same reason.
- **Revisit when a second producer of codes appears.** Phase 3's handlers will return codes such as `VALIDATION_ERROR`. Then an `api/errors.ts` with one `as const` table becomes worth it, so the guard and the handlers draw from one list.

## Testing

### Three ways to mock a module

| Way                            | What each export becomes            | Used for                                                |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------- |
| `vi.mock(path, () => ({ … }))` | whatever the factory returns        | lesson 4: `resolveApiCaller`, `withRLS`                 |
| `vi.mock(path, { spy: true })` | a spy that still runs the real code | lesson 5: `logEvent` (silenced), `toLoggedError` (real) |
| `vi.spyOn(object, 'method')`   | one method on a live object         | lesson 5: `console.log` / `warn` / `error`              |

`vi.resetAllMocks()` puts a spy back to its real implementation, so `logEvent` is silenced again in every `beforeEach`.

### Assert the sequence, not one call

`loggedEvents()` maps the spy's calls to an array of events, so a test asserts `[api.denied, api.request]` with `toEqual`. That checks order, and it fails on an extra or a missing event: "exactly one `api.request`" is proven, not assumed. `expect.any(Number)` checks `latencyMs` without depending on the machine.

### Test the outcome for secrets

The secrets test sends a query value, an email, an `Authorization` header and a Supabase cookie, then searches `JSON.stringify(loggedEvents())`. Searching the serialized form catches a secret at any depth, so the test still holds if someone adds a leaky field later. It was proven by changing `path` to `req.url` and watching it fail.

### `as const` loses excess-property checks

Pratik moved the `it.each` rows into a constant with `as const`. Then the rows were no longer checked against `LogEvent` where they're written: an extra `headers` key would have passed, because excess-property checks only run on fresh object literals. Pratik switched to a type annotation (`readonly { mockEvent: LogEvent; … }[]`), which checks every row. `as const satisfies …` would also work.

## Mistakes caught in review

- **`status: string`.** `Response.status` is a number, and the guard wouldn't have compiled. A log host also needs a number to filter `>= 500`: as strings, `"500" >= "400"` compares text.
- **`server-only` removed** (see above).
- **A misleading comment.** "Let Next.js log these errors": Next.js doesn't log them. `console.log` writes to stdout, and the host collects it. And that line logs requests, not errors.
- **A one-line commit message.** `git commit -m "…"` with a pasted multi-line message flattened it into the subject line. Write long messages in the editor (`git commit`), or fix the PR title before the squash merge, which uses it as the subject.
