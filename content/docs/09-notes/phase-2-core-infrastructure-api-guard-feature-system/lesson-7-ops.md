---
publish: false
id: notes.phase-2.lesson-7
title: "Phase 2 lesson 7 notes: the ops package and entitlements grant"
created: 2026-10-24
updated: 2026-10-24
kind: notes
version: 1.0.0
tags:
   - phase-2
   - feature-system
   - database
   - postgresql
   - cli
status: completed
applies_to:
   - "[[04-plans/phase-2-core-infrastructure-api-guard-feature-system/tasks/task-2-10]]"
---

These notes record what lesson 7 taught: the mental models, the surprises, and the corrections worth remembering. The steps to reproduce it are in [[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-7-ops|the walkthrough]]. The decisions are recorded in [[contracts#Ops|contracts]].

The thread running through the lesson: **ask what a piece of code is for before deciding where it lives.** The brief said "a seed script in the registry". Asking what the seed does (it plays the admin, with a role that bypasses RLS) turned it into the first command of a package for privileged tools.

---

## How the lesson ran

Same mode as lessons 4–6: the coach gave the exact code for each piece with the reasoning below; Pratik typed it, tweaked it and asked. Before piece 1 landed, Pratik stopped to ask what the script is for and what adding a database driver to the registry would cost. That reopened the design: a dedicated `ops` package, then a question about building a CLI now, then a cost check ("how much does this add?"). The agreed shape was the middle option: the package now, the dispatcher later. Seven pieces followed: the package, lint rules, `withPrivilegedDb`, flags, the database part, the command, and `.env.example`. Pratik delegated the commit, PR and docs at the end.

---

## What the seed is for

- A feature is on for an account only if `user_feature_entitlements` has a row. `app_runtime` can only read the table (lesson 3), so nobody grants themselves a feature; only `postgres` can write it.
- Until an admin UI or admin API exists, something has to play the admin. That's the seed. Pratik's framing: there will be many scripts like it (dev productivity, backdoor provisioning, break-glass), each retired when the public API and CLI cover it.
- `ALL_FEATURES` is empty, so the command grants nothing until Phase 4. Its value today is a proven path.

## Choosing the home

| Option                                                                 | Pieces   | Verdict                                                                                               |
| ---------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| Registry `scripts/`, raw SQL, Node's TypeScript                        | about 5  | the registry gains a database driver and needs a lint ban on `src/`; moves out with the second script |
| `ops` package, one command, `tsx` + Drizzle                            | about 7  | **chosen**: two extra pieces, typed queries, final home                                               |
| `ops` package plus a CLI dispatcher (`--help`, command objects, tests) | about 10 | deferred: solves discovery with one command, and Phase 9 owns CLI design                              |

- **`ops` code doesn't migrate into the Phase 9 CLI.** The CLI is an API client: API key, `withApiGuard`, RLS. `ops` is `postgres`, bypassing all of it. Retiring an `ops` command means moving its logic into an admin endpoint; the CLI calls that. What carries over is the interface, so design names, flags, output and exit codes as if they were permanent.
- **Lint makes "nothing imports `ops`" true.** A new `ops` boundaries element may import `registry` and `foundation`; no policy targets it. Without the element, `ops` would match the `packages/*` catch-all as `foundation` and fail its own registry import.

## Running TypeScript

- **Node 24 strips types but doesn't resolve extensions.** `import('@sidekick/core/db/schema')` with plain `node` fails with `ERR_MODULE_NOT_FOUND` on `./profiles`: our `moduleResolution: "bundler"` code imports without `.ts`. Node also refuses an `enum` (it generates code). The registry alone loads fine, because its only internal imports are type-only and get erased.
- **`tsx` resolves like the tsconfig,** so `ops` can import core's Drizzle schema. Typed queries are the payoff: a renamed column fails `tsc`, not a run.
- **`tsx -e` compiles to CommonJS,** so top-level `await` fails there with `Top-level await is currently not supported with the "cjs" output format`. Files in a `"type": "module"` package are ESM and can use it.
- **TypeScript 6.0 defaults `types` to `[]`.** A package with `@types/node` installed still fails with `Cannot find name 'process'` until its tsconfig says `"types": ["node"]`. Core gets away without it only because Next.js's types reference Node's. (The coach missed this in piece 1; `pnpm --filter @sidekick/ops typecheck` caught it.)

## The privileged connection

- `withPrivilegedDb` is `withRLS`'s sibling: a wrapper that owns setup and teardown. Different role, no user context.
- **`return await fn(…)` inside `try`.** Without `await`, `finally` runs immediately and closes the connection under the query.
- **`client.end()` or the script hangs:** postgres.js idle connections never time out by default, and an open socket keeps Node alive.
- **Session mode (5432) pins one connection,** so prepared statements are fine and `max: 1` is enough. Transaction mode (6543, the runtime URL) is why `unsafe.ts` needs `prepare: false`.
- **Proof the role matters:** pointed at `DATABASE_URL`, the command finds no profile (RLS hides every row without `app.current_user_id`), and a direct insert gets `permission denied for table user_feature_entitlements` (lesson 3's `REVOKE`).

## Command-line conventions

- **`parseArgs` strict mode** rejects unknown flags and stray words. A typo in `--apply` must never mean "carry on without writing, quietly" or worse.
- **`multiple: true` means repeat the flag.** Pratik's question: why didn't `--features a b` work? Because `b` is a stray word (strict: "Unexpected argument 'b'"), and `--features a,b` is one value. The fix was naming: singular `--feature`, repeated, like `git -c` and `curl -H`. Comma-splitting would also have been safe (keys can't contain commas) and fits a plural name.
- **`parseArgs` has no `required` option.** Pratik's `required: true` type-checked, because the config is inferred through a generic and skips excess-property checks, but did nothing. The explicit `if (!email)` was doing the work.
- **Exit codes: 0 ok, 1 failed, 2 usage.** `process.exitCode` instead of `process.exit()`, so stdout flushes and the connection closes before Node exits.
- **`pnpm --filter` turns every failure into exit 1.** It's a recursive run. `pnpm -C <dir>` preserves the script's own code. Found by running the usage error both ways.
- **Root scripts live only at the root.** Running `pnpm ops:entitlements:grant` from `packages/ops` fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL … Command not found`: pnpm falls back to treating an unknown script name as a shell command.
- **Env loading:** `dotenv -e ../../.env.local --`, per the [[06-decisions/technical/dotenv-cli|dotenv-cli decision]]. Both `dotenv-cli` and Node's `--env-file-if-exists` (tested under `tsx`) skip a missing file, let the shell override the file, let an empty value override it too, and pass the exit code through. The lesson first used `--env-file-if-exists`; the vault's decision surfaced while writing these docs, and the script switched to `dotenv-cli` ([sidekick#24](https://github.com/mehtapratik/sidekick/pull/24)). That commit was pushed to #23's branch after #23 had merged, so it needed its own PR: check a PR's state before pushing more to its branch.

## Idempotent writes

- **`INSERT … ON CONFLICT DO NOTHING RETURNING`** is the whole `--apply`. The composite primary key from lesson 3 defines "duplicate", the conflict clause skips it, and `RETURNING` reports only real inserts. Second run: "Granted: (none)".
- **Pratik's question: do we need to check what's already provisioned?** No, not for `--apply`. The insert's result already says what changed, so the pre-read moved into the dry run, which can't write. One query, no read-then-write race to explain.
- **Dry run by default.** A dry run is a forecast; `--apply` reports what happened.
- **Drizzle throws on `.values([])`,** so the empty-registry case returns before the insert.

## Decisions

- **A dedicated `ops` package (Pratik's choice)** for dev seeds, provisioning and break-glass scripts, each header naming what replaces it.
- **One command now, a dispatcher later.** Wrap, don't rewrite, when the second command lands.
- **The command is `entitlements grant`, not `seed:dev`.** `--all` does task 2.10; `--feature` provisions single features.
- **Writes need `--apply`** (a reversal of the brief's `--dry-run` flag), so the dangerous path is the one you have to type.
- **`ops` builds its own Drizzle client;** core still exports no privileged client.
- **`dotenv-cli` for env,** like every other package script.
- **Out of scope:** a `revoke` command (disabling is a `DELETE` with the privileged role) and a `--target` check. A script can't tell dev from production yet, because there's one Supabase project; that check comes with the first break-glass script and a second environment.

## The brief's questions

Covered while teaching, not asked as a quiz:

- **Why run it twice? What should the second run print?** To prove idempotence: the second `--apply` must grant nothing and fail on nothing. It prints "Granted: (none)".
- **Why must it never run against production as it stands?** It gives an account features on whatever database `DATABASE_DIRECT_URL` names, as a role that bypasses RLS, with nothing checking which database that is. `--apply` narrows the accident to "typed it on purpose", and a `--target` check comes with a second environment.

## Mistakes caught in review

- **The typo guard walked the wrong list.** Pratik's first version iterated `ALL_FEATURES` and sorted registry keys into known and unknown, so `--features x` exited 0 with nothing to grant, and any registered feature not requested would have counted as unknown. The check must walk the requested keys.
- **A dead branch:** a second "no keys" check after the dry run, unreachable because the same check returned earlier.
- **The `.env.example` lesson-6 note found the file still pointing at `db/index.ts`;** the Pre-2 walkthrough already said `unsafe.ts`.
- **"Done" before the cleanup.** The `seed-probe` manifest and row were still there after step 5; a read-only count caught it.
