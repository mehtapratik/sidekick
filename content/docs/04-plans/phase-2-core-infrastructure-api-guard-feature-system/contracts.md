---
publish: true
id: plan.phase-2.contracts
title: Phase 2 build rules and target design
created: 2026-10-18
updated: 2026-10-24
kind: plan
version: 2.8.1
tags:
   - plan
   - phase-2
   - api-guard
   - rls
   - api
   - authentication
   - typescript
   - guidance
status: completed
---

Phase 2 is built piece by piece, with Pratik learning as it goes. The general rules are in the agent guide's [[agent-guide#Working with Pratik|Working with Pratik]]: build fast, never vibe-code. This note adds what's specific to Phase 2. The lessons run one at a time, in the order in [[phase-2-core-infrastructure-api-guard-feature-system-complete|the Phase 2 plan]], and each lesson is its own thread.

## How we build

Each lesson step uses one of three modes. Pratik picks the mode and can switch at any time. Each brief suggests which steps are "good to write yourself".

**Piece by piece (the default).**

1. **Set it up.** Say in a sentence or two what this step is for. Where the brief asks a design question, ask it first, and let Pratik's answer shape the piece.
2. **Hand over one small piece.** That means one function, one migration, one config block or one test file: small enough to discuss in one go. Follow the [[#Target design|target design]] and the repo's conventions.
3. **Explain below the code.** Say what each part does and why, how it fits Sidekick's architecture, and what alternatives were rejected. Link the vault note for depth. Take extra care with Supabase, Drizzle, auth, repo setup, CI/CD, Next.js and hosting.
4. **Discuss.** Answer Pratik's questions and change the piece if Pratik's idea is sound. It's final only when Pratik agrees. Then Pratik puts it in place, or asks the coach to write it into the file.
5. **Prove it.** Pratik runs the check (a test, `pnpm lint`, a curl). For a security check, Pratik breaks it on purpose and watches it fail, then puts it back.
6. **Next piece.**

From lesson 4, Pratik prefers speed over probing: the coach gives the exact code for each piece first, with the reasoning, concepts, consequences and trade-offs below it, and turns design questions into recommendations. Pratik types the piece in, questions it and can change it. Everything explained goes into the lesson's walkthrough and learning notes.

**Pratik writes it** (for steps Pratik calls core, important or new):

- Explain the concept, let Pratik design and write it, then review it against the target design. Ask about differences instead of correcting silently.
- When Pratik is stuck, give the smallest hint first: a question, then a pointer, then a fragment. Give the full answer only when Pratik asks for it.

**Coach codes it** (only when Pratik asks, for work with no learning payoff): write it, then say briefly what changed.

**In every mode:**

- One piece at a time. Never post a whole lesson or make large unexplained changes.
- Nothing lands in the repo until Pratik has agreed to it.
- Ask one or two "Check understanding" questions before the lesson ends.
- Pratik commits, pushes and opens the PR unless they ask otherwise. Lesson 1 walks through the branch, commit and PR flow in full.
- When Pratik's design wins, update the target design below and bump `version`, so later lessons build on what was actually built.
- When a vault note disagrees with the code, show Pratik the disagreement and decide together.

## Commands Pratik runs

| What                              | Command                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------- |
| Unit tests for one package        | `pnpm --filter @sidekick/core test` (or the package being changed)                |
| Everything CI runs, without cache | `pnpm prettier:check` then `pnpm turbo lint typecheck build test --force`         |
| RLS and database proofs           | `pnpm test:integration` (needs PostgreSQL 17 tools: `brew install postgresql@17`) |
| Apply migrations to dev Supabase  | `pnpm db:migrate` (needs `.env.local`)                                            |

## Target design

The coach builds pieces from this design. In "Pratik writes it" steps it's the answer key, so the coach doesn't show it up front. When Pratik's design differs and both agree to keep Pratik's version, update this section and bump `version`.

Object shapes are `interface`s. `type` is only for what an interface can't express: unions, tuples, function, mapped and conditional types. ESLint enforces this with `@typescript-eslint/consistent-type-definitions` (decided in lesson 1).

| Path (Sidekick repo)                                               | Lesson                 | Exported as                   |
| ------------------------------------------------------------------ | ---------------------- | ----------------------------- |
| `packages/features-registry/src/index.ts` (+ `manifest.ts`)        | 1 [[task-2-6and2-7]]   | `@sidekick/features-registry` |
| `packages/core/src/api/auth.ts`                                    | 2 [[task-2-1]]         | internal (used by the guard)  |
| `packages/core/src/db/schema/user-feature-entitlements.ts`         | 3 [[task-2-8and2-9]]   | `@sidekick/core/db/schema`    |
| `packages/core/src/db/migrations/0006_*`, `0007_*`                 | 3 [[task-2-8and2-9]]   | n/a                           |
| `packages/core/src/features/entitlements.ts`                       | 3 [[task-2-8and2-9]]   | internal (used by the guard)  |
| `packages/core/src/api/guard.ts`, `packages/core/src/api/index.ts` | 4 [[task-2-2and2-3]]   | `@sidekick/core/api`          |
| `packages/core/src/observability/log.ts`                           | 5 [[task-2-4and2-5]]   | internal (used by the guard)  |
| `apps/web/src/app/api/health/route.ts`                             | 6 [[task-2-11and2-12]] | `GET /api/health`             |
| `packages/ops/src/lib/db.ts`, `src/scripts/entitlements-grant.ts`  | 7 [[task-2-10]]        | `pnpm ops:entitlements:grant` |

No new user-visible UI copy is needed in Phase 2. API error strings are machine-facing and stay in `packages/core`, because foundation packages can't import `@sidekick/copy`.

### Caller

```ts
// packages/core/src/api/auth.ts
export interface SessionBasedApiCaller {
   kind: "session";
   userId: string;
}

export interface KeyBasedApiCaller {
   kind: "key";
   userId: string;
   keyId: string;
   scopes: readonly string[];
}

export type ApiCaller = SessionBasedApiCaller | KeyBasedApiCaller;

export async function resolveApiCaller(
   req: Request,
): Promise<ApiCaller | undefined>;
```

- `undefined` means "no authenticated caller". The guard turns it into a 401. `undefined` sits on the return type, not inside `ApiCaller`, so code that runs after the 401 check (the handler's `caller`) never has to check for it again.
- Any request with a non-empty `Authorization` header resolves to `undefined` in Phase 2, even when it also carries a valid session cookie, and the session isn't read at all. There is no `api_keys` table until Phase 9 (task 9.4 wires the lookup in), so header callers fail closed. The header wins over the cookie so a limited key can never borrow the browser's full session. An empty header carries no credential and falls through to the session.
- The session comes from `createServerClient()` and `supabase.auth.getUser()`, which verifies the token with Supabase Auth. `getSession()` would trust the cookie as sent. Any Auth error (including `AuthSessionMissingError` when there's no session) resolves to `undefined`. A missing env var still throws, so a misconfigured app fails loudly instead of looking signed out.
- The `key` variant exists now so the guard's scope check compiles and can be tested with a synthetic caller. Nothing in Phase 2 produces it. Sessions have no scopes: scopes only narrow what a key may do for its user.
- The file imports `server-only`.

Decided in lesson 2:

- The variants are named interfaces joined in a union (Pratik's choice), so a function can take `KeyBasedApiCaller` alone, for example the guard's scope check.
- The key variant's tag is `'key'`, not `'apiKey'` (Pratik's choice).
- Any `Authorization` header, not only `Bearer …`, skips the session. Phase 9 adds the Bearer parsing when there's a key to look up.

Changed after lesson 3 ([sidekick#16](https://github.com/mehtapratik/sidekick/pull/16)):

- "No caller" is `undefined`, not `null`, following Pratik's coding standard: prefer `undefined`, the value JavaScript already uses for "nothing assigned". Supabase's own types keep `null` (`user: User | null`); `resolveApiCaller` converts at its boundary.

### Entitlements

```ts
// packages/core/src/features/entitlements.ts
import type { RlsTx } from "../db/rls";

export async function getEnabledFeatures(tx: RlsTx): Promise<string[]>; // feature keys
```

- This departs from the plan's `getEnabledFeatures(userId)`. It takes the RLS transaction, because the entitlements table is RLS-protected and the guard already holds a transaction for the user. Opening a second transaction per request would cost another pooled connection.
- It returns keys, not manifests. `packages/core` stays feature-agnostic ([[03-system-design/functional-design/00-feature-system/core|core]]) and can't import the registry.

Table `user_feature_entitlements`:

| Column        | Type                     | Notes                                                   |
| ------------- | ------------------------ | ------------------------------------------------------- |
| `user_id`     | `uuid` not null          | FK → `profiles.id`, `ON DELETE CASCADE`                 |
| `feature_key` | `text` not null          | matches a `FeatureManifest.key`; no FK                  |
| `created_at`  | `timestamptz` not null   | `defaultNow()`                                          |
| primary key   | `(user_id, feature_key)` | one row per feature per user; makes enabling idempotent |

- RLS is enabled and forced. One policy allows `SELECT` of the caller's own rows (`user_id::text = current_setting('app.current_user_id', true)`).
- `app_runtime` gets `INSERT`, `UPDATE` and `DELETE` revoked on this table. Users must never grant themselves features. Only the privileged migration/seed role (`DATABASE_DIRECT_URL`) writes rows.
- There's no FK on `feature_key` because features live in code, not in a table. If a `features` table arrives later, it can use the same key as its primary key, and `feature_key` gains the FK without a data migration.
- A present row means enabled. Disabling deletes the row with the privileged role. This isn't a syncable entity, so no soft delete.

Decided in lesson 3:

- The table has a composite primary key on `(user_id, feature_key)` and no surrogate `id` (Pratik's choice). Nothing references a single entitlement row, and the key's leading `user_id` column is the index `getEnabledFeatures` needs.
- The column is `user_id`, not `profile_id`. `profiles.id` is the auth user's id, and the same value is `userId` everywhere else (`ApiCaller.userId`, `withRLS(userId)`, `app.current_user_id`). User-owned tables follow this.
- The foreign key points at `profiles`, not `auth.users`, so our tables reference our tables. Deleting from `auth.users` still cascades through `profiles`. An entitlement is account state, not a transaction record, so nothing here needs to outlive the account.
- No `deleted_at`: the table isn't syncable. `0003`'s soft-delete triggers also assume an `id` column.
- `app_runtime` holds only `SELECT`. The `REVOKE` stays even though RLS already blocks writes: without it, a forbidden `DELETE` matches zero rows and succeeds silently, and the `REVOKE` makes it fail with "permission denied".
- The integration test seeds rows through `TEST_ADMIN_DATABASE_URL` (the `postgres` role), which `tests/with-test-db.sh` exports.

### Guard

```ts
// packages/core/src/api/guard.ts
import type { RlsTx } from "../db/rls";
import type { ApiCaller } from "./auth";

export interface GuardOptions {
   feature?: string; // key of the feature the caller must be entitled to
   requireScope?: string; // checked for key callers only
}

export interface ApiHandlerArgs<Ctx> {
   tx: RlsTx;
   caller: ApiCaller; // handlers read caller.userId
   req: Request;
   ctx: Ctx; // Next.js's second route-handler argument, passed through
}

export type ApiHandler<Ctx> = (args: ApiHandlerArgs<Ctx>) => Promise<Response>;

export function withApiGuard<Ctx = unknown>(
   handler: ApiHandler<Ctx>,
   opts?: GuardOptions,
): (req: Request, ctx: Ctx) => Promise<Response>;
```

Order of checks:

1. `resolveApiCaller(req)`. If it returns `undefined`, respond 401 `UNAUTHENTICATED`.
2. If `opts.requireScope` is set and the caller is a `key` caller without that scope, respond 403 `SCOPE_MISSING`. This check needs no database, so it runs before a transaction opens. Session callers skip it.
3. Open `withRLS(caller.userId, …)`.
4. Inside the transaction, if `opts.feature` is set and `getEnabledFeatures(tx)` doesn't include it, respond 403 `FEATURE_DISABLED`.
5. Call `handler({ tx, caller, req, ctx })` and return its response.
6. If anything throws, the transaction rolls back. Log the error server-side and respond 500 `INTERNAL`. Never send error details to the client.

This reorders the planning sketch that [[with-api-guard]] held until lesson 8: the scope check moves before the transaction, and the feature check moves inside it. The note now summarizes this section.

Decided in lesson 4:

- Handlers get `caller`, not a separate `userId` (Pratik's choice): `caller.userId` is the one copy, and after the 401 check `caller` is already narrowed to `ApiCaller`.
- The handler's argument is a named interface, `ApiHandlerArgs<Ctx>`, following the interface rule from lesson 1.
- `feature` stays optional. With no `feature`, the guard skips the entitlements query (`opts.feature && …` short-circuits).
- `getEnabledFeatures` keeps returning `string[]`. A `Set` or `Map` gains nothing for one lookup per request.
- The client keeps distinct `SCOPE_MISSING` and `FEATURE_DISABLED` codes: the caller is signed in and asking about their own account. Detailed reasons go to the server log (lesson 5).
- A handler that writes and then returns an error response commits. Only a throw rolls back, so handlers validate before they write. The integration test pins this.
- Shared test helpers live in `packages/core/tests/helpers/` ([sidekick#18](https://github.com/mehtapratik/sidekick/pull/18)) until a second package needs them.

### Error shape

All guard errors use `{ error: string, code: string }` ([[error-handling]]):

| Status | `code`             | `error`              |
| ------ | ------------------ | -------------------- |
| 401    | `UNAUTHENTICATED`  | `"Unauthorized"`     |
| 403    | `SCOPE_MISSING`    | `"Forbidden"`        |
| 403    | `FEATURE_DISABLED` | `"Feature disabled"` |
| 500    | `INTERNAL`         | `"Internal error"`   |

### Logging

`packages/core/src/observability/log.ts` (internal, `server-only`) writes one JSON object per line ([[03-system-design/non-functional/observability/centralized|centralized observability]]). `logEvent(event)` picks the console method, which sets the level the host shows: `console.log` for `api.request`, `console.warn` for `api.denied`, `console.error` for `api.error`.

- Every event carries `event`, `method`, `path` and `userId` (`null` when there's no caller: `JSON.stringify` drops `undefined`).
- `api.request`, at the end of every request: `status`, `latencyMs` (`performance.now()`, rounded).
- `api.denied`, on every 401 and 403: `code` (`UNAUTHENTICATED` | `SCOPE_MISSING` | `FEATURE_DISABLED`, the same value as the response body), plus `feature` or `scope` when that check failed.
- `api.error`, on every 500: `error: { name, message, stack }` from `toLoggedError`. `stack` holds only the `at …` frames. For a `DrizzleQueryError`, `name` and `message` come from its `cause`, because Drizzle's own message embeds the query's parameters.
- `path` is the URL pathname without the query string. Never log emails, cookies, tokens, headers or bodies.
- `withApiGuard` is the only caller. A denied or failed request logs its reason, then `api.request`; every request logs exactly one `api.request`.
- ESLint allows `console.log` in `log.ts` only, through a per-file `no-console` override in `eslint.config.js`.

Decided in lesson 5:

- `api.denied` logs `code`, not a lowercase `reason`: one vocabulary for the client and the log, so a reported code greps straight to its line.
- `userId` is on every event, `null` without a caller, rather than optional.
- `toLoggedError` replaces "the error's message and stack". Drizzle's `DrizzleQueryError` message carries user data (`params: …`).
- One place logs (Pratik's design). An internal `authorizeAndHandle(caller, handler, opts, req, ctx)` runs the auth, scope and feature checks and the handler, and returns the handler's `Response` or a `GuardDenial` (`Pick<ApiDeniedEvent, 'code' | 'feature' | 'scope'>`). It never logs or catches. `withApiGuard` resolves the caller, logs `api.denied`, `api.error` and `api.request`, and turns a throw into the 500. `userId` is a local in `withApiGuard`, not a mutated shared object.
- The 401 check sits in `authorizeAndHandle` with the other refusals (Pratik's choice): `resolveApiCaller` says who the caller is, `authorizeAndHandle` says whether they may proceed.
- Event names and codes stay literal unions, not an `enum` or constants: `LogEvent` and `GUARD_ERRORS` are the inventory, and the compiler checks both. Revisit with a shared `as const` code table when Phase 3 handlers add their own codes.
- The `console.log` exception is a config override, not an inline `eslint-disable`: policies live in `eslint.config.js`, and `log.ts` carries a comment pointing there.

### Health route

```ts
// apps/web/src/app/api/health/route.ts
import { withApiGuard } from '@sidekick/core/api';

export const GET = withApiGuard(async function GET() {
  return Response.json({ status: 'ok' });
});
```

- `200 { status: 'ok' }` for a signed-in caller; `401 { error: 'Unauthorized', code: 'UNAUTHENTICATED' }` otherwise, including any `Authorization` header.
- No `feature`: health belongs to no feature, and a fake one would put a false entry in the registry. The guard skips the entitlements query. It can't return `403`; `FEATURE_DISABLED` is proven by `packages/core/tests/integration/guard.test.ts`.
- No public mode. A public liveness probe for hosting would be a deliberate, recorded exception to `require-api-guard`, decided by Pratik. Out of scope for Phase 2.
- No `export const dynamic`: route handlers are dynamic by default in Next.js 16, and the guard's cookie read keeps them dynamic under Cache Components too.

Decided in lesson 6:

- The body is `{ status: 'ok' }`, the health-check convention, rather than `{ message: 'OK' }`.
- The handler is a named function expression (`async function GET()`, Pratik's choice), so `api.error` stacks show `at GET`.
- The database client is created on first use: `packages/core/src/db/unsafe.ts` exports `getUnsafeDb()` instead of an `unsafeDb` constant ([sidekick#21](https://github.com/mehtapratik/sidekick/pull/21)). `next build` imports every route module, and CI's build has no `DATABASE_URL`. A missing `DATABASE_URL` now fails the first signed-in request (logged `api.error`, 500) instead of the import.
- `apps/web/src/instrumentation.ts` checks `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `DATABASE_URL` once when a server starts, and never during `next build` ([sidekick#22](https://github.com/mehtapratik/sidekick/pull/22)). A variable the server can't run without goes on its list.
- The guard's layers: lint checks every `route.*` file uses `withApiGuard`, `verify-endpoints.mjs` checks every served endpoint comes from a `route.*` file, and `next build` (which no longer runs ESLint in Next.js 16) checks neither. CI's `lint` step is the gate.

### Ops

`packages/ops` (`@sidekick/ops`) holds privileged scripts: dev seeds, provisioning backdoors and break-glass fixes. Each one is retired when an admin UI, the public API or the CLI covers it, and its header comment says which.

```ts
// packages/ops/src/lib/db.ts
export type PrivilegedDb = PostgresJsDatabase<typeof schema>; // core's schema
export type PrivilegedDbHandler<T> = (db: PrivilegedDb) => Promise<T>;

export async function withPrivilegedDb<T>(
   fn: PrivilegedDbHandler<T>,
): Promise<T>;
```

- `withPrivilegedDb` reads `DATABASE_DIRECT_URL` when called (the `postgres` role, which bypasses RLS), opens one connection (`max: 1`; session mode, so prepared statements are fine), runs `fn` and always closes it.
- A boundaries element `ops` may import `registry` and `foundation`. No policy targets it, so nothing may import `ops`. Core exports no privileged client.
- Scripts run under `tsx`, because Node's type stripping can't resolve core's extensionless schema imports. Env comes from `dotenv -e ../../.env.local --` ([[06-decisions/technical/dotenv-cli|dotenv-cli]]).
- `ops` has no `exports`, `build` or `test`; nothing CI builds or tests needs `DATABASE_DIRECT_URL`.

Every script follows these conventions:

1. Top level declares: `main()` runs only `if (import.meta.main)`, and env reads and connections happen inside it.
2. Flags come from `node:util`'s `parseArgs` with `strict: true`. A repeatable flag is repeated (`--feature a --feature b`), not a list.
3. Dry run by default; writes need `--apply`.
4. Results on stdout, errors on stderr. Exit 0 ok, 1 failed, 2 usage error, set through `process.exitCode`.
5. The header comment names what replaces the script.

Each script has a package script in `packages/ops` and a root shortcut, `ops:<noun>:<verb>`, that calls it with `pnpm -C packages/ops` (not `--filter`, which reports every failure as 1).

`entitlements grant`: `pnpm ops:entitlements:grant --email <email> (--all | --feature <key>…) [--apply]`.

- The email must match exactly one profile (exit 1 otherwise). Keys are checked against `ALL_FEATURES` before any connection (exit 2 on an unknown key), because `feature_key` has no foreign key.
- The dry run reads the account's existing rows and prints what would change. `--apply` is one `INSERT … ON CONFLICT DO NOTHING RETURNING`, and prints only the rows it inserted, so a second run prints "Granted: (none)".
- `--all` with an empty registry still looks up the profile, then grants nothing.

Decided in lesson 7:

- A dedicated package instead of the registry's `scripts/` (Pratik's choice): the registry stays free of database drivers, and privileged scripts get one home.
- One command now; a dispatcher (`pnpm ops <noun> <verb>`, `--help`) when a second command lands. `ops` code doesn't move into the Phase 9 CLI, which is an API client; its logic moves into admin endpoints and the interface carries over.
- `--apply` instead of the brief's `--dry-run` flag, so the writing path is the one you have to type.
- `--apply` doesn't pre-read existing rows (Pratik's simplification): the insert's `RETURNING` is the record of what changed.
- Out of scope: a `revoke` command (disabling is a `DELETE` with the privileged role) and a `--target` check, which needs a second environment.

### Feature manifest

```ts
// packages/features-registry/src/manifest.ts
export interface FeatureManifest {
   readonly key: string; // lowercase and hyphenated, unique, never changes: stored in user_feature_entitlements.feature_key
   readonly name: string;
   readonly description: string;
}

// packages/features-registry/src/index.ts
export const ALL_FEATURES: readonly FeatureManifest[] = [];
```

The shape stays minimal until the first feature package lands. Phase 4 (Taxila) adds what it needs. `src/index.test.ts` checks, in one test per rule so the rules run even on an empty list, that keys are lowercase and hyphenated (`/^[a-z0-9]+(-[a-z0-9]+)*$/`) and unique, and that every manifest has a name and description.

Decided in lesson 1:

- The field is `key`, not `slug` (Pratik's choice). Columns and options follow it: `feature_key`, `GuardOptions.feature` takes a key.
- The registry is only a catalog of what features exist. Whether a feature is ready to show anyone (rollout gating) is a separate system, built post-MVP ([[backlogged-unplanned#B5 — Feature rollout gating|B5]]). When it exists, the guard checks it before entitlements.
