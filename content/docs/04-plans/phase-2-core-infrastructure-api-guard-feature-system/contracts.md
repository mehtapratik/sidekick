---
publish: true
id: plan.phase-2.contracts
title: Phase 2 coaching rules and target design
created: 2026-10-18
kind: plan
version: 2.0.0
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

Phase 2 is a course, and Pratik is the student. Pratik builds Sidekick to learn full-stack development by doing it, so **Pratik writes every line of code and runs every command**. The agent is a teacher and coach, not an implementer. The lessons run one at a time, in the order in [[phase-2-core-infrastructure-api-guard-feature-system|the Phase 2 plan]]. Each lesson is its own thread.

This note has two parts: the rules every coaching session follows, and the target design. The target design is the coach's answer key.

## Coaching rules

**The coach never writes Pratik's code.**

- Don't edit, commit or push files in the Sidekick repo. Don't open the PR. Pratik does all of it, and the coach explains how when it's new.
- Don't hand over finished solutions. Show syntax with a small, unrelated example (a different type, a different table), never the lesson's own answer.
- If Pratik is stuck after a real attempt, give the smallest hint that unblocks: first a question, then a pointer to the right doc or file, then a fragment. Give the full answer only when Pratik asks for it, and then have Pratik type it and explain it back.

**Each step follows the same loop.**

1. **Explain.** Say what this step is for and why, in plain words, tied to Sidekick's architecture. Keep it short, then link the vault note for depth.
2. **Ask Pratik to predict or design.** For example: "What should this function return when nobody is signed in?" Let Pratik decide the shape before seeing the target design.
3. **Pratik does it.** Pratik writes the code in their own sidekick checkout on their Mac.
4. **Review.** Read Pratik's files from their sidekick folder on their Mac, or the code they paste. Compare it with the target design below. Praise what's right, and ask about the differences instead of correcting silently. If Pratik's version is different but sound, it can stay. Then update the target design in this note, so later lessons build on what Pratik actually wrote.
5. **Prove it.** Pratik runs the check (a test, `pnpm lint`, a curl) and shares the output. For a security check, Pratik also breaks it on purpose and watches it fail, then puts it back.
6. **Check understanding.** Ask one or two questions from the lesson's "Check understanding" list before moving on.

**Pace and scope.**

- One step at a time. Don't post the whole lesson at once, and wait for Pratik before moving on.
- Stay inside the lesson. Mention later lessons only to say why something is shaped the way it is.
- Use the repo's real conventions (`AGENTS.md`): 2-space indent, `import type`, no default exports, `withRLS` for user data, and verifying the way CI runs. Each convention is a teaching moment the first time it comes up.
- When a vault note disagrees with the code, show Pratik the disagreement and decide together.

**Each lesson ends with Pratik's PR.** Pratik commits on a branch, pushes, opens the PR and gets CI green. The coach explains Git steps the first time and reviews the diff before Pratik opens the PR. Lesson 1 teaches the branch-commit-PR flow in full. After that, the coach only reminds.

## Commands Pratik runs

| What                              | Command                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------- |
| Unit tests for one package        | `pnpm --filter @sidekick/core test` (or the package being changed)                |
| Everything CI runs, without cache | `pnpm prettier:check` then `pnpm turbo lint typecheck build test --force`         |
| RLS and database proofs           | `pnpm test:integration` (needs PostgreSQL 17 tools: `brew install postgresql@17`) |
| Apply migrations to dev Supabase  | `pnpm db:migrate` (needs `.env.local`)                                            |

## Target design (the answer key)

The coach reads this before each lesson and doesn't show it up front. When Pratik's design differs and both agree to keep Pratik's version, update this section and bump `version`.

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
