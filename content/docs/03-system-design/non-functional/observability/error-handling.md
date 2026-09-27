---
id: system-design.non-functional.observability.error-handling
created: 2026-09-19
kind: spec
version: 1.0.0
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

- **Cookie writes in Server Components.** Supabase's `setAll` callback (used in `createServerClient`) wraps cookie writes in a `try/catch` that swallows errors. This is intentional — Server Components in Next.js cannot write cookies (only Route Handlers and Server Actions can). Supabase attempts the write optimistically; if it fails because we're in a Server Component, the session will be refreshed on the next request that can write cookies.
- **Non-critical background operations.** Embedding generation should not crash the primary write operation. If embedding fails, set `embeddingStatus = 'failed'`, log the error, and move on. The user's note was saved successfully; the embedding can be retried.

## API Error Shape

All API errors must use a consistent shape (to be enforced via `withApiGuard` in Phase 2):

```ts
{ error: string, code?: string }
```

Examples:

```json
{ "error": "Unauthorized" }
{ "error": "Feature disabled", "code": "FEATURE_DISABLED" }
{ "error": "Invalid input", "code": "VALIDATION_ERROR" }
```

Never return raw error objects, stack traces, or internal database errors to the client. Log those server-side.
