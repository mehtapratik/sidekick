---
title: Standards & Guidelines
---

# Decision — Standards and Guidelines

---

## TypeScript Is Build-Time Only; Runtime Validation Is Required

### What

TypeScript types are erased at runtime. They cannot be used to validate data that arrives from outside the codebase — user inputs, API request bodies, query parameters, external API responses, and database rows are all untyped at runtime, regardless of what TypeScript says they are at compile time.

Runtime validation (checking actual values at runtime) is required at every boundary where external data enters the system.

### Why

A TypeScript type annotation like `body: { title: string }` does not check anything at runtime. If the request body arrives as `{ title: 42 }` or `{}`, TypeScript won't catch it — the type is a compile-time assertion, not a runtime check. Treating TypeScript types as runtime guarantees leads to silent failures, unexpected `undefined` values, and security vulnerabilities.

### What counts as an "external boundary"

- API route handlers: request body, query parameters, path parameters
- External API responses (Supabase, OpenAI, Stripe webhooks)
- Form submissions from the browser
- CLI arguments
- Environment variables (at startup)

### How

Use **Zod** for runtime validation. Define a schema, parse the input, and handle the error case before touching the parsed value.

```ts
import { z } from 'zod'

const CreateNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string(),
})

const result = CreateNoteSchema.safeParse(req.body)
if (!result.success) {
  return Response.json({ error: 'Invalid input', details: result.error.flatten() }, { status: 400 })
}

const { id, title, content } = result.data  // fully typed and validated
```

Zod integration with `withApiGuard` is planned for Phase 2+. All new API routes from Phase 2 onward must validate their inputs before processing them.

### Environment variables

Validate required environment variables at startup (when the server boots), not lazily when a route is first called. A missing `ANTHROPIC_API_KEY` should fail loudly at boot, not silently produce `undefined` errors in production at 2am.
