---
publish: false
id: notes.phase-2
title: "Phase 2 notes: what the phase taught"
created: 2026-10-24
updated: 2026-10-24
kind: notes
version: 1.0.0
tags:
   - phase-2
   - api-guard
   - feature-system
   - rls
   - testing
   - guidance
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system-complete]]"
---

These notes record the themes that ran across Phase 2's seven lessons. Each lesson has its own notes, in `09-notes/phase-2-core-infrastructure-api-guard-feature-system/`, with the details and the mistakes; this note doesn't repeat them. It names the patterns that showed up more than once, so they carry into Phase 3. The steps are in [[05-builds/phase-2-walkthrough]].

The thread running through the phase: **a security property is only as real as the failure you've watched it produce.** Every layer of the guard was proven by breaking it, and the bugs that slipped through were all checks that ran green while checking nothing.

---

## A check that never ran looks exactly like a pass

The same failure, in seven costumes:

| Lesson | Looked green because                                                       | Caught by                                      |
| ------ | -------------------------------------------------------------------------- | ---------------------------------------------- |
| 1      | `it.each([])` generated zero tests; a tsconfig brace glob excluded nothing | reading the test count; `--listFilesOnly`      |
| 2      | `beforeEach` came from `node:test` and never ran                           | a probe                                        |
| 2      | Vitest strips types, so fakes with impossible shapes passed                | `pnpm typecheck`                               |
| 3      | a forbidden `DELETE` matched zero rows and "succeeded"                     | the `REVOKE`, and matching its message         |
| 4      | a `Map` change type-checked while the test compared `[key, true]` pairs    | running the entitlements test                  |
| 6      | `pnpm build` served an unguarded route                                     | `pnpm lint`, which `next build` no longer runs |
| 7      | `parseArgs`' `required: true` type-checked and did nothing                 | the explicit `if (!email)`                     |

What worked every time:

- **Break it on purpose, one thing at a time,** and restore before the next break. Two breaks at once give failures that can't be attributed (lesson 3).
- **Assert the specific failure,** not just that something failed. RLS and the `REVOKE` both raise SQLSTATE 42501; only the message says which wall stopped the write.
- **Assert what didn't happen.** "Cheap checks first" is a promise about what never runs, so the guard's most important unit assertions are `not.toHaveBeenCalled()` (lesson 4).
- **Test the outcome, not the mechanism.** The secrets test searches the serialized log for four kinds of secret, so it still holds when someone adds a leaky field (lesson 5).

## Top level declares

Code at a module's top level should declare things, not act. Lesson 6 learned it the hard way: `unsafe.ts` checked `DATABASE_URL` at import, `next build` imports every route module, and CI's build has no secrets. The same rule shaped three other pieces:

- **`withApiGuard(handler)` runs nothing when the module loads.** It returns a function, and that's what makes the lint rule possible: `export const GET = withApiGuard(…)` is visible in the source without running anything.
- **`ops` scripts run `main()` only `if (import.meta.main)`,** and read env and connect inside it, so importing a script never touches a database.
- **A deliberate startup check replaces an accidental one.** `instrumentation.ts` checks every required variable once per server, instead of whichever module happened to import the database first.

Request-scoped state follows the same logic: it's safe only when created per request, inside the handler. At module level, concurrent requests overwrite each other (lesson 5).

## Verify like CI: no cache, no env, real exit codes

A local green run proves the code, not the environment. Each lesson tightened what "verify" means:

- **No cache:** `pnpm turbo <task> --force`. Config changes are exactly what a cached result hides.
- **No env:** `env -u DATABASE_URL pnpm --filter web exec next build`. CI has no `.env.local`, and lesson 6's first CI run failed on what every local run had passed.
- **Typecheck separately:** Vitest runs green on code `tsc` rejects.
- **Read exit codes, not just output:** `pnpm --filter` reports every failure as 1, so `ops` uses `pnpm -C` to keep 0, 1 and 2 (lesson 7).
- **Check the PR, not the push:** a PR merges the commits it has when it's merged, and GitHub can lag behind a push. Three times a commit missed its PR and needed a new one (arkive#11, arkive#17, sidekick#24), so check `gh pr view <n> --json state,headRefOid` first.

## Each layer sees something the others can't

The guard isn't one check. It's layers that each read a different thing, and none of them works alone:

| Layer                      | Reads                       | Misses                                             |
| -------------------------- | --------------------------- | -------------------------------------------------- |
| `require-api-guard` (lint) | every `route.*` file        | endpoints that don't come from a route file        |
| `verify-endpoints.mjs`     | the build's manifests       | what's inside a route file                         |
| `resolveApiCaller`         | the session, verified       | what the caller may do                             |
| entitlements               | the caller's rows           | rollout readiness (B5)                             |
| RLS                        | `app.current_user_id`       | commands it has no policy for, which fail silently |
| `REVOKE` on `app_runtime`  | the command                 | which rows                                         |
| logs                       | every decision, afterwards  | nothing they're forbidden to say                   |
| CI and branch protection   | everything above, pre-merge | what only runs on your machine                     |

Lesson 3's "two walls" is the general case: RLS decides rows, grants decide commands, and either alone looks sufficient until you remove the other. The Data API roles (lesson 3's follow-up) were a wall nobody had checked: RLS held, but `TRUNCATE` ignores RLS, and the grants bought Sidekick nothing.

## Fail closed, and convert at the boundary

Every uncertain case collapses into the answer that grants nothing: no cookie, a bad token, an Auth outage and any `Authorization` header are all "no caller". A check that can only take access away needs no validation of what it rejects; validation matters when content starts to grant something (Phase 9's keys).

Values change shape at boundaries, on purpose, in one place:

- Supabase's `null` becomes `undefined` inside `resolveApiCaller` (Pratik's standard: prefer `undefined`).
- `undefined` becomes `null` in a log line, because `JSON.stringify` drops `undefined` fields.
- Drizzle's error becomes `toLoggedError`'s cause and frames, because its message carries query parameters.

## Design that came from Pratik's questions

Many of the phase's decisions changed because Pratik questioned a piece. The questions that won had a pattern: they asked what something is for, or why two copies of one fact exist.

| Question                                        | Result                                                          | Lesson |
| ----------------------------------------------- | --------------------------------------------------------------- | ------ |
| `slug` or `key`?                                | `key`, and `feature_key` everywhere                             | 1      |
| Named interfaces instead of an inline union     | a function can take `KeyBasedApiCaller` alone                   | 2      |
| Why a surrogate `id` nothing references?        | composite primary key `(user_id, feature_key)`                  | 3      |
| Why pass `userId` when `caller.userId` exists?  | one copy                                                        | 4      |
| Why does logging live in two functions?         | one place logs; `authorizeAndHandle` decides and returns        | 5      |
| Who mutated this object?                        | `userId` is a local, assigned where it's read                   | 5      |
| What is the seed for?                           | `packages/ops`, a home for privileged scripts                   | 7      |
| Do we need to check what's already provisioned? | `--apply` trusts `RETURNING`; the pre-read moved to the dry run | 7      |

The proposals that lost had a pattern too: they optimized or generalized ahead of a need. A `Map` for one lookup, an `enum` for three codes, a generic 403 for a signed-in caller, a `test-utils` package for one package's helpers, fixed test ids, a CLI dispatcher for one command. Each was declined with a trigger for when it becomes right (a second code producer, a second package, a second command). That's coding standard 3, "code for today's needs", applied by asking what would make the change worth it.

> **Hardest to reverse** (lesson 8's question): the feature `key`. It's stored as a plain string in every entitlement row, with no foreign key, so renaming one silently cuts off every user who has it, and fixing that is a data migration across accounts. Code shapes like `ApiHandlerArgs` can change in one PR with the compiler's help; stored keys can't. That's why lesson 1 made keys permanent and checked their format before any existed.

## How the lessons ran

Lessons 1–3 were Socratic: the coach asked, Pratik designed and wrote. Open questions ("what should the result hold?") stalled; one-field questions worked backwards from the consumer, with a generic pattern to copy, worked. From lesson 4, Pratik switched to speed: exact code for each piece, the reasoning below it, Pratik typing and questioning it. The switch didn't make the lessons passive, because the questions above kept coming. It moved the depth into the walkthroughs and these notes, which is why they're thorough.

## Docs follow the end state

- **Late fixes go into the walkthrough of the phase they belong to,** as dated post notes, so someone following the guides in order ends where Sidekick is. Phase 2 added five to Phase 0, Phase 1.1 and Pre-2 ([[05-builds/phase-2-walkthrough#Post notes in earlier walkthroughs|list]]).
- **Arkive's Prettier rewrites Sidekick's code samples** (three spaces, double quotes). Run it with `--embedded-language-formatting=off`, or not at all on notes with code.
- **A squash merge uses the PR title as the commit,** so the title gets checked before merging; `git commit -m` with a pasted multi-line message flattens it.

> **Correction to older docs.** [[with-api-guard]] held the planning sketch (JavaScript, feature check before the transaction, scope inside it) until this lesson; it now summarizes the shipped guard. Phase 10's tasks 10.1 and 10.2 (request and auth-failure logging) were built in Phase 2 lesson 5, noted in the completed plan.
