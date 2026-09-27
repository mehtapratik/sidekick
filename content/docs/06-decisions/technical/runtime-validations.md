---
id: decision.technical.runtime-validations
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - api-guard
   - supabase
   - api
   - typescript
   - cli
applies_to:
   - "[[03-system-design/non-functional/runtime-validations]]"
status: accepted
---

TypeScript types are erased at runtime. They cannot be used to validate data that arrives from outside the codebase — user inputs, API request bodies, query parameters, external API responses, and database rows are all untyped at runtime, regardless of what TypeScript says they are at compile time.

Runtime validation is required at every boundary where external data enters the system.

## What counts as an "external boundary"

- API route handlers: request body, query parameters, path parameters
- External API responses (Supabase, OpenAI, Stripe webhooks)
- Form submissions from the browser
- CLI arguments
- Environment variables (at startup)

## How

Use **Zod** for runtime validation. Define a schema, parse the input, and handle the error case before touching the parsed value.

```ts
import { z } from "zod";
const CreateNoteSchema = z.object({
   id: z.string().uuid(),
   title: z.string().min(1).max(255),
   content: z.string(),
});

const result = CreateNoteSchema.safeParse(req.body);

if (!result.success) {
   return Response.json(
      {
         error: "Invalid input",
         details: result.error.flatten(),
      },
      { status: 400 },
   );
}

// fully typed and validated
const { id, title, content } = result.data;
```

Zod integration with `withApiGuard` is planned for Phase 2+. All new API routes from Phase 2 onward must validate their inputs before processing them.

## Environment variables

Validate required environment variables at startup (when the server boots), not lazily when a route is first called. A missing `ANTHROPIC_API_KEY` should fail loudly at boot, not silently produce `undefined` errors in production at 2am.
