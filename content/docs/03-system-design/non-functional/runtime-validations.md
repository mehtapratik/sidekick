---
publish: true
id: system-design.non-functional.runtime-validations
title: Runtime Validations
created: 2026-09-19
updated: 2026-11-06
kind: spec
version: 1.2.0
tags:
   - system-design
   - typescript
---

**D49** `decision` #validation: External input is validated at runtime with Zod at every boundary, because TypeScript types are erased.

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

The example's `error: "Invalid input"` and zod's own `flatten()` messages are English sentences; from Phase 3 the shape below replaces them.

## Errors are keys

**D252** `rule` #validation #i18n: Every zod issue's message is a catalog key, set once with zod's `customError`, and the API returns validation failures in Sidekick's own shape, `{ path, message: { key, values } }`, never zod's issue objects or sentences. derived-from [[D49]] derived-from [[D201]]

```ts
// the /contracts entry module, loaded wherever the schemas are used (server, browser, tests)
z.config({
   customError: (issue) => `common.validation.${issue.code}`, // the message IS the key
});
```

- **Values come with the issue.** zod already puts `minimum`, `maximum`, `expected` and the like on each issue, so a form calls `t(issue.message, issue)` and the ICU message reads `{minimum}` from it: `"Enter at least {minimum, plural, one {# character} other {# characters}}"`. The words live in `common` ([[D243]]), since every form needs them.
- **A custom check passes a key,** never a sentence: `.refine(fn, { message: "sandbox-notes.title.reserved" })`.
- **The API shapes errors once**, next to `withApiGuard`, where responses are already formatted: `{ code: "validation_failed", issues: [{ path, message: MessageRef }] }` ([[D250]]). Consumers never see zod's format, so a zod upgrade or a swap to another validator changes one file and no consumer (Pratik, 2026-11-06).
- `z.config` changes zod for the whole process. That is safe because it sets keys, never words, so it is the same for every request and every locale.
- Not used: zod 4's own translated messages. They are zod's wording, outside Sidekick's catalogs and the catalog check, and translated on the server.

Zod integration with `withApiGuard` is planned for Phase 2+. All new API routes from Phase 2 onward must validate their inputs before processing them.

## Environment variables

Validate required environment variables at startup (when the server boots), not lazily when a route is first called. A missing `ANTHROPIC_API_KEY` should fail loudly at boot, not silently produce `undefined` errors in production at 2am.

## Decision History

- 2026-09-19 · accepted · Runtime Validations
- 2026-11-06 · accepted · Errors are keys ([[D252]])
