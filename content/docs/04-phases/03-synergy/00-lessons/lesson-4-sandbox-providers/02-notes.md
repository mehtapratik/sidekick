---
publish: false
id: notes.phase-3.lesson-4
title: "Synergy Lesson 4 Notes: Sandbox Providers and the First Routes"
created: 2026-11-22
updated: 2026-11-22
kind: notes
version: 1.0.0
tags:
   - phase-3
   - synergy
   - feature-system
   - api
   - database
   - rls
---

These notes record what lesson 4 taught: the mental models, Pratik's design calls, the questions and their answers, and the surprises. The steps to reproduce it are in [[04-phases/03-synergy/00-lessons/lesson-4-sandbox-providers/01-walkthrough|the walkthrough]].

## Mental models

- **Foundation says how, platform says what, features say which.** Pratik's first reading of foundation was "reusable in any repo". The test is narrower: foundation knows no Sidekick *concept* (entities, features), though it is opinionated about Sidekick's *setup* (Supabase, `app_runtime`, `app.current_user_id`). Platform holds a domain concept with its data and rules that more than one *feature* uses, and takes feature keys and entity types as data. The likeliest next platform package is the AI layer in Phase 6.
- **Synergy's boundary.** Synergy holds what is true of entities, including its own error codes and their HTTP statuses (its API contract). Core holds what every package needs to behave (database, API conventions, auth, logging). So the shared columns and the `{ code }` error shape went to core, not Synergy. A new "common" package would only add wiring; the signal to split core is core changing for unrelated reasons, or another app needing part of it.
- **A transaction commits when its callback resolves.** A handler that *returns* a 409 resolves, so before D268 its writes committed. Throwing inside the callback is the only way to roll back; the guard's `ErrorResponseRollback` throws inside and catches outside, after the rollback has finished.
- **An ETag is a cache rule, not a UX choice.** HTTP says it identifies the whole response, so any change to the response must change it. What to *tell* the user (reload banner, deprecated banner, deleted notice, silent rename) is the client's call, made by comparing old and new.
- **Conditional requests.** The first `GET` sends no `If-None-Match` (`*` would mean "any version exists" and answer 304). With plain `fetch`, the browser's HTTP cache turns a 304 into a 200 with the cached body, so a client checking for changes keeps the ETag itself and fetches with `cache: 'no-store'`. "Page updated" polls on focus, visibility and every 30 seconds (D210), and shows a banner, never an automatic reload.
- **Dates.** Postgres `timestamptz` stores an instant. The API accepts only ISO 8601 with a zone (`11/12/2026` and zoneless times are ambiguous) and answers in UTC (`…Z`). The client formats in the user's zone; on the server, next-intl needs the user's zone (a cookie set by the browser, a profile preference, then Vercel's IP guess) or server and browser render different times. A due date is a calendar date, a `date` column, not a timestamp.
- **One code per error response.** A response fails for one reason, so it has one status and one code. Many problems of one kind are details under one code (`validation_failed` with `issues`), and a code may carry values. Each package keeps an inventory of its codes (`SYNERGY_ERROR_CODE`).
- **A catalog** is a package's `messages/<locale>.json` with one namespace, the package's name; `@sidekick/i18n` alone owns `common`, the shared words. Validation messages are shared, so their keys are `common.validation.*`; core only emits keys.
- **Typecheck can't see a wrong copy.** The tasks mirror registered tasks as notes and type-checked. Tests that assert what was stored (`type: 'task'`) catch it; so does searching a mirrored file for the old word.

## Pratik's design calls

- **The lock in `withRLS`, built from two wrappers:** a private `withUserOnlyData` and an exported `withUserLock`, with the flag as the public API.
- **Each feature exports its key; the registry composes the type,** with no type casts. The manifest type stays in the registry.
- **No casts in shared code.** Interfaces over types, names over strings (`HTTP_STATUS`, `SYNERGY_ERROR_CODE`, `ENTITY_TYPE`), `ValidBody` and `InvalidBody` for the parse result, `identifyActor` for the caller mapping.
- **Reuse the shared columns,** which moved them to core.
- **Defer the central ownership function** after asking for a candid assessment (D267).
- **An error response must roll back** once the footgun was explained (D268), and the docs retire "validate before you write".
- **The UI stays off the data layer** by lint (D269); the API stays in `apps/app` until Phase 9 (D270).
- **Response schemas, not just types,** so a client can parse a response.
- **Type the mirrored steps too** until the flow from route to database is clear; the coach writes repeated code only after that (tasks' tests were the first).
- **Check the entity fields the handlers copy** (display name, title, actor).

## Questions answered

- **Option flag or wrappers for the lock?** Both prevent the deadlock; the flag keeps the order guaranteed by core, and wrappers keep each job separate. Pratik's composition took both.
- **Does the other user's call in the lock test assert anything?** Only through a timeout; it now records that it ran and checks the order.
- **Where should `FeatureManifest` live?** Not in core (the manifest will grow fields typed by higher layers); in the registry, with each feature's key as a constant.
- **A SQL procedure that applies policies?** It would drift: a rebuilt database replays old migrations against the newest function. A function the policy *calls* would update centrally, but nothing needs that yet (D267).
- **Why `/contracts` and not `/client`?** Both sides import it; `/react` is the browser's own door.
- **Is validation at the edge?** It's the first thing inside the handler, after the guard's checks and inside the transaction, before any write.
- **Is the parser/handler asymmetry a smell?** No: failure is uniform and success isn't. The real smell was commit-on-error.
- **Why did Phase 2 keep writes on an error response?** It was observed Drizzle behavior, written down and pinned by a test, never chosen. Writes that must survive an error (failed-attempt counters, audit rows) will get an explicit opt-in.
- **Status constants?** `HTTP_STATUS`, in a browser-safe entry point. Error codes can't be tied to statuses.
- **Should the API be its own app?** Not before Phase 9; lint gives the "UI is a client" guarantee now.
- **A central `KNOWN_ENTITY_TYPES`?** No: types belong to their provider (D200). Each package exports `ENTITY_TYPE`.
- **Are the responses typed for a client?** They weren't at runtime; `noteSchema`, `taskSchema` and `entitySchema` fix that.
- **Is entity registration tested?** Yes, through the join in the test's database read; the copied fields are now checked too.
- **Why "0 passed" in the test output?** Vitest's live progress frames end up in Turbo's log; the last block per package is the result.

## Surprises and corrections

- **The folder became `notes copy`,** and the editor rewrote an import into another package's source. Lint allowed it, which led to `import-x/no-relative-packages`.
- **Stale files reappeared** in the working tree (an old `lock.ts`, lesson 3's experiment migrations), and a Finder `.DS_Store` in `migrations/meta/` crashed drizzle-kit ("`Bud1` is not valid JSON").
- **Editor auto-imports** twice added an unused import; once it passed typecheck and lint and failed only `build`.
- **The first `curl` was a 403:** the grant had gone to the other dev account.
- **`pnpm test:integration -- --filter=…` doesn't filter;** the coach got this wrong and corrected it. Integration tests run only through the root script.
- **The catalog test flaked** on other packages' `*_probe` tables, created while it ran in parallel.
- **The coach overstated a cost:** an inlined SQL function in a policy is essentially free; the reason to defer D267 was that nothing needs it.

## Owed after this lesson

- **Lesson 5:** the ETag must change when status changes (an ETag over the whole response, such as `"<content_seq>.<updated_at>"`); creating with an existing id answers 500 until idempotency arrives; the guard's own error codes are UPPER_CASE with an English `error` field, unlike `{ code }` elsewhere, and core's codes have no inventory yet.
- **Lesson I1:** the user's time zone for server rendering; the catalog for `common.validation.*`.
- **Phase 9:** revisit the API's own deployment (D270).
