---
publish: true
id: system-design.non-functional.nextjs.server-actions
created: 2026-09-19
updated: 2026-10-16
kind: spec
version: 2.0.0
tags:
   - system-design
   - nextjs
   - rls
   - api
   - authentication
---

Server Actions are not allowed. Every read and write goes through the public API — App Router route handlers wrapped in [[with-api-guard|withApiGuard]] — following the [[request-flow]] standard (`UI -> Repository -> API -> DB`) and the [[api-first]] architecture.

**Why:** Next.js turns each `'use server'` function into a public `POST` endpoint. Its action ID ships in the browser bundle, so anyone can call it directly, with any arguments, signed in or not. `withApiGuard` cannot wrap a Server Action: an action receives arguments or `FormData` instead of a `Request` and returns a value instead of a `Response`. A Server Action would also be a second write path beside the API, which the planned offline sync engine would not see.

**Enforcement:**

- Lint: `no-restricted-syntax` reports any `'use server'` directive in the monorepo.
- Build: `apps/web/scripts/verify-endpoints.mjs` fails the build if Next.js's server-reference manifest contains any Server Action, regardless of how it was written.

**Changing this decision:** design a guarded pattern first — the same caller resolution, feature entitlement, scope, and RLS steps as `withApiGuard` — then lift the lint ban and the build check together, deliberately.
