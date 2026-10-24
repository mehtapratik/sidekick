---
publish: true
id: system-design.non-functional.security.with-api-guard
created: 2026-09-19
updated: 2026-10-24
kind: spec
version: 2.0.0
tags:
   - system-design
   - security
   - api-guard
   - rls
   - api
   - authentication
   - typescript
---

1. Centralizes common security concerns at public API layer so these checks aren’t scattered across multiple clients.
2. Funnels request through auth, feature entitlement checks, API scope validations, and RLS context setup before handing over request to handler.

This note is the short spec. The source of truth for the details is [[contracts#Guard|Phase 2 contracts]] (guard, error shape and logging), and the code is `packages/core/src/api/guard.ts`, exported from `@sidekick/core/api`. It shipped in Phase 2 ([[05-builds/phase-2-walkthrough]]).

## Signature

```ts
export interface GuardOptions {
  /** Key of the feature the caller must be entitled to */
  feature?: string;
  /** Scope an API-key caller must hold; session callers skip this check */
  requireScope?: string;
}

export interface ApiHandlerArgs<Ctx> {
  tx: RlsTx; // one RLS transaction for the caller
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

## Order of checks

Cheapest first; a request stops at the first failure.

1. `resolveApiCaller(req)`. No caller (no session, or any `Authorization` header until Phase 9) → 401 `UNAUTHENTICATED`.
2. `requireScope` set and a key caller without it → 403 `SCOPE_MISSING`. Needs no database, so it runs before a transaction takes a pooled connection.
3. `withRLS(caller.userId, …)` opens one transaction with `app.current_user_id` set.
4. `feature` set and `getEnabledFeatures(tx)` doesn't include it → 403 `FEATURE_DISABLED`. Entitlements are RLS-protected, so they're read inside the transaction.
5. `handler({ tx, caller, req, ctx })`. Resolving commits; throwing rolls back. A handler that writes and then returns an error response commits, so handlers validate before they write.
6. Anything thrown → rolled back, logged, and 500 `INTERNAL`. No details reach the client.

## Errors

Every guard error is `{ error, code }` ([[error-handling]]):

| Status | `code`             | `error`              |
| ------ | ------------------ | -------------------- |
| 401    | `UNAUTHENTICATED`  | `"Unauthorized"`     |
| 403    | `SCOPE_MISSING`    | `"Forbidden"`        |
| 403    | `FEATURE_DISABLED` | `"Feature disabled"` |
| 500    | `INTERNAL`         | `"Internal error"`   |

## Logs

The guard is the only place that logs a request, one JSON line per event ([[03-system-design/non-functional/observability/centralized|centralized observability]]):

| Event         | When                | Adds                                                   |
| ------------- | ------------------- | ------------------------------------------------------ |
| `api.denied`  | every 401 and 403   | `code`, and `feature` or `scope`                       |
| `api.error`   | every 500           | `error: { name, message, stack }`, no query parameters |
| `api.request` | every request, last | `status`, `latencyMs`                                  |

Every event carries `method`, `path` (no query string) and `userId` (`null` without a caller). Headers, cookies, tokens, bodies and emails are never logged.

## Enforcement

**Public API handlers must be protected by this wrapper.** Enforced in two layers, both in CI: the `sidekick/require-api-guard` ESLint rule on every `app/**/route.*` file in every app, and `apps/web/scripts/verify-endpoints.mjs`, which reads Next.js's build manifests and fails the build if anything is served that is not a lint-checked route handler (Server Actions, Pages Router entries, code-generated metadata routes). `next build` no longer runs ESLint (Next.js 16), so a local build serves an unguarded route: CI's `lint` step is the gate.

## Usage

```ts
import { withApiGuard } from '@sidekick/core/api';

export const GET = withApiGuard(
  async function GET({ tx }) {
    const rows = await tx.select().from(notes);

    return Response.json({ data: rows });
  },
  { feature: 'taxila', requireScope: 'notes:read' },
);
```

Each HTTP method is its own export with its own options. The handler's queries need no user filter: RLS limits `tx` to the caller's rows.
