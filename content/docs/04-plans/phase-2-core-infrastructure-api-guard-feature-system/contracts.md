---
publish: true
id: plan.phase-2.contracts
title: Phase 2 shared contracts
created: 2026-10-18
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - api-guard
   - rls
   - api
   - authentication
   - typescript
status: planned
---

Every Phase 2 handoff codes against these names, signatures and rules, so handoffs in the same wave can run in parallel without seeing each other's work. A handoff that needs to change a contract stops and reports back instead of changing it alone. Plan: [[phase-2-core-infrastructure-api-guard-feature-system|Phase 2]].

## Rules for every handoff

- Read `AGENTS.md` in the Sidekick repo first, then only the notes your brief lists.
- One handoff is one branch and one pull request into `main`. CI `checks` must pass. Stay inside the files your brief names. If you need another file, say why in the PR.
- Before pushing, run the repo's checks the way CI runs them: `pnpm prettier:check`, `pnpm turbo lint typecheck build test --force`, and `pnpm test:integration` when you touch the database. Integration tests need PostgreSQL 17 tools. If they are missing, install them the way `.github/workflows/ci.yml` does. If you can't install them, say so in the PR and let CI run them.
- Prove each guard by watching it fail. Every security test should fail once when the check it covers is removed.
- When a note disagrees with the code, stop and report. Don't widen the handoff to fix it.
- No new user-visible UI copy is needed in Phase 2. API error strings are machine-facing and stay in `packages/core`, because foundation packages can't import `@sidekick/copy`.

## File map

| Path (Sidekick repo)                                               | Owner handoff        | Exported as                   |
| ------------------------------------------------------------------ | -------------------- | ----------------------------- |
| `packages/core/src/api/auth.ts`                                    | [[task-2-1]]         | internal (used by the guard)  |
| `packages/core/src/db/schema/user-feature-entitlements.ts`         | [[task-2-8and2-9]]   | `@sidekick/core/db/schema`    |
| `packages/core/src/db/migrations/0006_*`, `0007_*`                 | [[task-2-8and2-9]]   | n/a                           |
| `packages/core/src/features/entitlements.ts`                       | [[task-2-8and2-9]]   | internal (used by the guard)  |
| `packages/features-registry/src/index.ts` (+ `manifest.ts`)        | [[task-2-6and2-7]]   | `@sidekick/features-registry` |
| `packages/core/src/api/guard.ts`, `packages/core/src/api/index.ts` | [[task-2-2and2-3]]   | `@sidekick/core/api`          |
| `packages/core/src/observability/log.ts`                           | [[task-2-4and2-5]]   | internal (used by the guard)  |
| `packages/features-registry/scripts/seed-dev-entitlements.ts`      | [[task-2-10]]        | `pnpm` script                 |
| `apps/web/src/app/api/health/route.ts`                             | [[task-2-11and2-12]] | `GET /api/health`             |

Only [[task-2-2and2-3]] adds an entry to `packages/core/package.json` `exports` (`"./api": "./src/api/index.ts"`). Only [[task-2-8and2-9]] writes migrations, so the Drizzle journal never conflicts.

## Caller

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

## Entitlements

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

## Guard

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

## Error shape

All guard errors use `{ error: string, code: string }` ([[error-handling]]):

| Status | `code`             | `error`              |
| ------ | ------------------ | -------------------- |
| 401    | `UNAUTHENTICATED`  | `"Unauthorized"`     |
| 403    | `SCOPE_MISSING`    | `"Forbidden"`        |
| 403    | `FEATURE_DISABLED` | `"Feature disabled"` |
| 500    | `INTERNAL`         | `"Internal error"`   |

## Logging

`packages/core/src/observability/log.ts` writes one JSON object per line ([[03-system-design/non-functional/observability/centralized|centralized observability]]):

- `api.request`, at request end: `method`, `path`, `status`, `latencyMs`, `userId` (or `null`).
- `api.denied`, on every 401 and 403: `method`, `path`, `reason` (`unauthenticated` | `scope_missing` | `feature_disabled`), plus `userId`, `feature` or `scope` when known.
- `api.error`, on a 500: `method`, `path`, `userId`, and the error's message and stack (server-side only).
- `path` is the URL pathname without the query string. Never log emails, cookies, tokens, headers or bodies.

## Feature manifest

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
