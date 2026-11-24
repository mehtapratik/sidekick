---
publish: true
id: system-design.non-functional.observability.error-handling
title: Error Handling
created: 2026-09-19
updated: 2026-11-22
kind: spec
version: 1.2.0
tags:
   - system-design
   - observability
   - api-guard
   - rls
   - supabase
   - api
   - nextjs
   - react
   - ai
---

## Loud failures

Some failures should crash the process or return an error immediately:

- **Missing required environment variables at startup.** If `ANTHROPIC_API_KEY` is not set, fail at boot rather than producing confusing `undefined` errors when the first AI request is made.
- **Security-critical checks that fail.** If the RLS context cannot be established, throw rather than proceeding with an unsecured query.
- **Programming errors.** Wrong types, unexpected states, violated invariants — these indicate a bug, not a recoverable condition. Throw so the bug is visible immediately.

## Silent failures

Some failures should be swallowed:

- **Cookie writes in Server Components.** Supabase's `setAll` callback (used in `createServerClient`) wraps cookie writes in a `try/catch` that swallows errors. This is intentional — Server Components in Next.js cannot write cookies (only Route Handlers can; Server Actions are banned). Supabase attempts the write optimistically; if it fails because we're in a Server Component, the session will be refreshed on the next request that can write cookies.
- **Non-critical background operations.** Embedding generation should not crash the primary write operation. If embedding fails, set `embeddingStatus = 'failed'`, log the error, and move on. The user's note was saved successfully; the embedding can be retried.

## API Error Shape

An error response's body is a stable code the client branches on and looks up words for, never words of its own ([[D201]]). Handlers build it with `errorResponse(code, status)` from `@sidekick/core/api` (Synergy lesson 4); a code may carry values the client needs, and invalid input answers 400 with one code and one issue per problem:

```json
{ "code": "stale_content" }
{ "code": "validation_failed", "issues": [{ "path": ["title"], "message": { "key": "common.validation.too_small", "values": { "minimum": 1 } } }] }
```

Each package keeps an inventory of its codes and their statuses (Synergy's `SYNERGY_ERROR_CODE` and `SYNERGY_ERROR_STATUS`), and statuses are named with `HTTP_STATUS` (`@sidekick/core/http`). An error response rolls back everything the handler wrote ([[D268]]).

`withApiGuard`'s own errors predate this and still carry an English `error` field next to an UPPER_CASE code, `{ "error": "Feature disabled", "code": "FEATURE_DISABLED" }`, listed in [[04-phases/02-gatekeeper/01-contracts#Error shape|the Phase 2 contracts]]. Bringing them in line is backlog item [[backlogged-unplanned#B15 — One style for every error response|B15]].

Never return raw error objects, stack traces, or internal database errors to the client. Log those server-side.
