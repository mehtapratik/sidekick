---
publish: true
id: harness.best-practices
title: Best Practices
created: 2026-09-19
kind: guidance
version: 1.1.0
updated: 2026-11-01
tags:
   - ai-coding-harness
   - agent-guidance
   - drizzle
   - api
   - react
   - pnpm
   - css
   - offline
   - embedding
   - soft-delete
---

1. All handlers to be wrapped in [[03-system-design/non-functional/security/with-api-guard|withApiGuard]].
2. Always use [[03-system-design/non-functional/security/row-level-security|row-level security]] via `withRLSGuard`.
3. [[03-system-design/non-functional/api/never-mutate-outside-api-layer|Never mutate outside the API layer]].
4. [[03-system-design/non-functional/monorepo/dependency-flow|Follow dependency flow]].
5. [[03-system-design/non-functional/database/repository-client|Use the repository client]].
6. [[03-system-design/non-functional/api/idempotent-api|Keep APIs idempotent]].
7. [[03-system-design/non-functional/database/soft-delete-support|Never hard-delete syncable entities]]. A [[03-system-design/non-functional/database/syncable-tables|syncable table]] is one a client may sync offline; [[03-system-design/non-functional/database/non-syncable-tables|non-syncable tables]] (such as Synergy's outbox and idempotency keys) hard-delete on purpose.
8. All select queries filter soft-deleted rows. The one exception is a table whose tombstones must stay visible (Synergy's, see [[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]]): its repository is the only way in, and every query it runs states whether it wants live rows.
9. Every content table participating in embedding must include `embedding_status` field, never fail silently, and must support retries.
10.   Feature manifests remain the canonical feature contract.
11.   Background embedding generation must never block user writes.
12.   Server Components are preferred for data-fetching.
13.   Client Components should only exist where interactivity is required
14.   Drizzle must never execute in browser/client components.
15.   Install dependencies at package-level when they are specific to that package’s runtime only (e.g. `drizzle-org` for `packages/core`). [[03-system-design/non-functional/monorepo/dependency-flow|Why?]]
16.   Install the dependencies at root when given dependency is shared across multiple package. [[03-system-design/non-functional/monorepo/dependency-flow|Why?]]
17.   Always add dependencies in `package.json` of each package even though such dependency is available through pnpm hoisting. Implicitly relying on pnpm hoisting works in monorepo context but it breaks when the package runs in isolated context or different monorepo environment. Therefore, being explicit about each dependency in `package.json` is safeguard we want to enforce. [[03-system-design/non-functional/monorepo/dependency-flow|Why?]]
18.   No barrel exports, and similarly, do not use `main` prop of `package.json` to expose barrel file. Use `exports` prop to explicitly expose individual artifacts.
19.   Include `”side-effects": false` in `package.json` from day one. This will let bundlers perform aggressive tree-shaking and highlight errors and bad practices that comes out of side effects.
20.   Do not hardcode user-visible strings. Define/use them from `packages/copy`. Excludes non-user strings such as instrumentation message sent to server, css class names, and attribute values.
21.   [[03-system-design/non-functional/monorepo/prefer-json-config|Prefer JSON configuration]].
22.   Validate every external input at the boundary (request bodies, query parameters, external API responses, database rows) with Zod; TypeScript types are erased at runtime. [[03-system-design/non-functional/runtime-validations|Why?]]
23.   Add `export const dynamic = 'force-dynamic'` to the layout of every route group that touches Supabase cookies. [[03-system-design/non-functional/nextjs/force-dynamic|Why?]]
24.   List every environment variable in the `env` array of the `build` task in `turbo.json`, not in the Vercel dashboard. [[03-system-design/non-functional/monorepo/env-vars-in-turbo-json|Why?]]
25.   Style with CSS modules only. No Mantine style props, no Tailwind, no utility classes; Mantine's behavioural props are fine. [[03-system-design/non-functional/css/css—modules|Why?]]
26.   Test at four layers and prove a behaviour at the cheapest layer that can observe it; integration tests through the guarded API are the main seam. Mock only at boundaries. [[03-system-design/non-functional/testing/testing-layers|Why?]]
27.   Packages that use React list `react` (and `react-dom`) as peer dependencies; `apps/web` owns the installed version. [[03-system-design/non-functional/monorepo/dependency-flow|Why?]]
28.   In `proxy.ts` (Edge runtime) use `createProxyClient`, never `createServerClient`, and use `createProxyClient` nowhere else. [[03-system-design/non-functional/security/edge-runtime|Why?]]
29.   Build REST route handlers that return JSON. No GraphQL and no `/api/v1` prefix until the deferred decisions change. [[03-system-design/non-functional/api/graphql-and-relay|GraphQL]], [[03-system-design/non-functional/api/api-versioning|versioning]]
30.   Every metadata field a user or bot fills in is optional; Sidekick's own bookkeeping (ids, counters, timestamps) stays out of the user's way. [[principle.individual-first|Individual First]]
31.   Ask of every item what it costs to add later. A new endpoint or a stylesheet waits; a data migration across every record, or a change to every caller of a shared contract, ships now. A foundation needs a planned, near-term use. [[principle.cost-to-add-later|Cost to Add Later]]
