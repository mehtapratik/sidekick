# Decision — Error Handling and Instrumentation

---

## When to Throw (Fail Loudly)

Some failures should crash the process or return an error immediately:

- **Missing required environment variables at startup.** If `ANTHROPIC_API_KEY` is not set, fail at boot rather than producing confusing `undefined` errors when the first AI request is made.
- **Security-critical checks that fail.** If the RLS context cannot be established, throw rather than proceeding with an unsecured query.
- **Programming errors.** Wrong types, unexpected states, violated invariants — these indicate a bug, not a recoverable condition. Throw so the bug is visible immediately.

---

## When to Fail Silently (or Log and Continue)

Some failures should be swallowed:

- **Cookie writes in Server Components.** Supabase's `setAll` callback (used in `createServerClient`) wraps cookie writes in a `try/catch` that swallows errors. This is intentional — Server Components in Next.js cannot write cookies (only Route Handlers and Server Actions can). Supabase attempts the write optimistically; if it fails because we're in a Server Component, the session will be refreshed on the next request that can write cookies.
- **Non-critical background operations.** Embedding generation should not crash the primary write operation. If embedding fails, set `embeddingStatus = 'failed'`, log the error, and move on. The user's note was saved successfully; the embedding can be retried.

---

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

---

## Instrumentation Strategy

### MVP: `console.*` via Vercel dashboard

Primitive but sufficient for a single-developer MVP. Vercel streams function logs to a dashboard in real time. `console.error`, `console.warn`, and `console.log` are visible there.

Log structured objects rather than concatenated strings:

```ts
// Prefer this
console.error('Embedding failed', { noteId, userId, error: err.message })

// Over this
console.error('Embedding failed for note ' + noteId + ': ' + err.message)
```

Structured logs are easier to filter and grep, and will migrate cleanly to a proper logging service later.

### Post-MVP: Sentry or equivalent

After MVP ships, integrate a structured error tracking service (Sentry is the most common). Benefits over `console.*`:
- Error deduplication (one alert for 1000 identical errors, not 1000 alerts)
- Stack trace capture with source maps
- User context attached to errors
- Alert routing and on-call integrations
- Performance monitoring

The transition from `console.*` to Sentry is low-friction — it's an additive change, not a rewrite.

### Logging placement

The primary logging surface is inside `withApiGuard`:
- Request start: method, path, userId
- Request end: status, latency
- Auth failures: 401/403 events with reason
- Feature entitlement denials

This centralizes visibility without requiring each route handler to implement its own logging.
