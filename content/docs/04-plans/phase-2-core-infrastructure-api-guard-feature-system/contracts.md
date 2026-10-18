---
publish: true
id: plan.phase-2.contracts
title: Phase 2 build rules and target design
created: 2026-10-18
kind: plan
version: 2.1.0
updated: 2026-10-18
tags:
   - plan
   - phase-2
   - api-guard
   - rls
   - api
   - authentication
   - typescript
   - guidance
status: planned
---

Phase 2 is built piece by piece, with Pratik learning as it goes. The general rules are in the agent guide's [[agent-guide#Working with Pratik|Working with Pratik]]: build fast, never vibe-code. This note adds what's specific to Phase 2. The lessons run one at a time, in the order in [[phase-2-core-infrastructure-api-guard-feature-system|the Phase 2 plan]], and each lesson is its own thread.

## How we build

Each lesson step uses one of three modes. Pratik picks the mode and can switch at any time. Each brief suggests which steps are "good to write yourself".

**Piece by piece (the default).**

1. **Set it up.** Say in a sentence or two what this step is for. Where the brief asks a design question, ask it first, and let Pratik's answer shape the piece.
2. **Hand over one small piece.** That means one function, one migration, one config block or one test file: small enough to discuss in one go. Follow the [[#Target design|target design]] and the repo's conventions.
3. **Explain below the code.** Say what each part does and why, how it fits Sidekick's architecture, and what alternatives were rejected. Link the vault note for depth. Take extra care with Supabase, Drizzle, auth, repo setup, CI/CD, Next.js and hosting.
4. **Discuss.** Answer Pratik's questions and change the piece if Pratik's idea is sound. It's final only when Pratik agrees. Then Pratik puts it in place, or asks the coach to write it into the file.
5. **Prove it.** Pratik runs the check (a test, `pnpm lint`, a curl). For a security check, Pratik breaks it on purpose and watches it fail, then puts it back.
6. **Next piece.**

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
| `packages/features-registry/scripts/seed-dev-entitlements.ts`      | 7 [[task-2-10]]        | `pnpm` script                 |

No new user-visible UI copy is needed in Phase 2. API error strings are machine-facing and stay in `packages/core`, because foundation packages can't import `@sidekick/copy`.

### Caller

```ts
// packages/core/src/api/auth.ts
export type ApiCaller =
   | { kind: "session"; userId: string }
   | {
        kind: "apiKey";
        userId: string;
        keyId: string;
        scopes: readonly string[];
     };

export async function resolveApiCaller(req: Request): Promise<ApiCaller | null>;
```

- `null` means "no authenticated caller". The guard turns it into a 401.
- A request with an `Authorization: Bearer …` header always resolves to `null` in Phase 2, even when it also carries a session cookie. There is no `api_keys` table until Phase 9 (task 9.4 wires the lookup in), so Bearer callers fail closed.
- The `apiKey` variant exists now so the guard's scope check compiles and can be tested with a synthetic caller. Nothing in Phase 2 produces it.

### Entitlements

```ts
// packages/core/src/features/entitlements.ts
import type { RlsTx } from "../db/rls";

export async function getEnabledFeatures(tx: RlsTx): Promise<string[]>; // feature slugs
```

- This departs from the plan's `getEnabledFeatures(userId)`. It takes the RLS transaction, because the entitlements table is RLS-protected and the guard already holds a transaction for the user. Opening a second transaction per request would cost another pooled connection.
- It returns slugs, not manifests. `packages/core` stays feature-agnostic ([[03-system-design/functional-design/00-feature-system/core|core]]) and can't import the registry.

Table `user_feature_entitlements`:

| Column         | Type                      | Notes                                   |
| -------------- | ------------------------- | --------------------------------------- |
| `id`           | `uuid` PK                 | `defaultRandom()`                       |
| `user_id`      | `uuid` not null           | FK → `profiles.id`, `ON DELETE CASCADE` |
| `feature_slug` | `text` not null           | matches a `FeatureManifest.slug`; no FK |
| `created_at`   | `timestamptz` not null    | `defaultNow()`                          |
| unique         | `(user_id, feature_slug)` | makes enabling idempotent               |

- RLS is enabled and forced. One policy allows `SELECT` of the caller's own rows (`user_id::text = current_setting('app.current_user_id', true)`).
- `app_runtime` gets `INSERT`, `UPDATE` and `DELETE` revoked on this table. Users must never grant themselves features. Only the privileged migration/seed role (`DATABASE_DIRECT_URL`) writes rows.
- A present row means enabled. Disabling deletes the row with the privileged role. This isn't a syncable entity, so no soft delete.

### Guard

```ts
// packages/core/src/api/guard.ts
import type { RlsTx } from "../db/rls";
import type { ApiCaller } from "./auth";

export type GuardOptions = {
   feature?: string; // slug the caller must be entitled to
   requireScope?: string; // checked for apiKey callers only
};

export type ApiHandler<Ctx> = (args: {
   tx: RlsTx;
   userId: string;
   caller: ApiCaller;
   req: Request;
   ctx: Ctx; // Next.js's second route-handler argument, passed through
}) => Promise<Response>;

export function withApiGuard<Ctx = unknown>(
   handler: ApiHandler<Ctx>,
   opts?: GuardOptions,
): (req: Request, ctx: Ctx) => Promise<Response>;
```

Order of checks:

1. `resolveApiCaller(req)`. If it returns `null`, respond 401 `UNAUTHENTICATED`.
2. If `opts.requireScope` is set and the caller is `apiKey` without that scope, respond 403 `SCOPE_MISSING`. This check needs no database, so it runs before a transaction opens. Session callers skip it.
3. Open `withRLS(caller.userId, …)`.
4. Inside the transaction, if `opts.feature` is set and `getEnabledFeatures(tx)` doesn't include it, respond 403 `FEATURE_DISABLED`.
5. Call `handler({ tx, userId, caller, req, ctx })` and return its response.
6. If anything throws, the transaction rolls back. Log the error server-side and respond 500 `INTERNAL`. Never send error details to the client.

This reorders the sketch in [[with-api-guard]]: the scope check moves before the transaction, and the feature check moves inside it.

### Error shape

All guard errors use `{ error: string, code: string }` ([[error-handling]]):

| Status | `code`             | `error`              |
| ------ | ------------------ | -------------------- |
| 401    | `UNAUTHENTICATED`  | `"Unauthorized"`     |
| 403    | `SCOPE_MISSING`    | `"Forbidden"`        |
| 403    | `FEATURE_DISABLED` | `"Feature disabled"` |
| 500    | `INTERNAL`         | `"Internal error"`   |

### Logging

`packages/core/src/observability/log.ts` writes one JSON object per line ([[03-system-design/non-functional/observability/centralized|centralized observability]]):

- `api.request`, at request end: `method`, `path`, `status`, `latencyMs`, `userId` (or `null`).
- `api.denied`, on every 401 and 403: `method`, `path`, `reason` (`unauthenticated` | `scope_missing` | `feature_disabled`), plus `userId`, `feature` or `scope` when known.
- `api.error`, on a 500: `method`, `path`, `userId`, and the error's message and stack (server-side only).
- `path` is the URL pathname without the query string. Never log emails, cookies, tokens, headers or bodies.

### Feature manifest

```ts
// packages/features-registry/src/manifest.ts
export type FeatureManifest = {
   slug: string; // kebab-case, unique, stored in user_feature_entitlements.feature_slug
   name: string;
   description: string;
};

// packages/features-registry/src/index.ts
export const ALL_FEATURES: readonly FeatureManifest[] = [];
```

The shape stays minimal until the first feature package lands. Phase 4 (Taxila) adds what it needs.
