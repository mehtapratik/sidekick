---
publish: true
id: harness.best-practices
title: Best Practices
created: 2026-09-19
kind: guidance
version: 1.1.1
updated: 2026-11-08
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

1. **D4** `rule` #api #security: All handlers to be wrapped in [[03-system-design/non-functional/security/with-api-guard|withApiGuard]].
2. **D5** `rule` #rls #database: Always use [[03-system-design/non-functional/security/row-level-security|row-level security]] via `withRLS`. derived-from [[D35]]
3. **D6** `rule` #api: [[03-system-design/non-functional/api/never-mutate-outside-api-layer|Never mutate outside the API layer]]. derived-from [[D48]]
4. **D7** `rule` #monorepo: [[03-system-design/non-functional/monorepo/dependency-flow|Follow dependency flow]]. derived-from [[D57]]
5. **D8** `rule` #database: [[03-system-design/non-functional/database/repository-client|Use the repository client]].
6. **D9** `rule` #api: [[03-system-design/non-functional/api/idempotent-api|Keep APIs idempotent]].
7. **D10** `rule` #database #soft-delete: [[03-system-design/non-functional/database/soft-delete-support|Never hard-delete syncable entities]]. A [[03-system-design/non-functional/database/syncable-tables|syncable table]] is one a client may sync offline; [[03-system-design/non-functional/database/non-syncable-tables|non-syncable tables]] (such as Synergy's outbox and idempotency keys) hard-delete on purpose.
8. **D11** `rule` #database #soft-delete: All select queries filter soft-deleted rows. The one exception is a table whose tombstones must stay visible (Synergy's, see [[03-system-design/functional-design/04-synergy/tombstone-visibility|Tombstone visibility]]): its repository is the only way in, and every query it runs states whether it wants live rows.
9. **D12** `rule` #ai #database: Every content table participating in embedding must include `embedding_status` field, never fail silently, and must support retries.
10.   **D13** `rule` #features: Feature manifests remain the canonical feature contract.
11.   **D14** `rule` #ai: Background embedding generation must never block user writes.
12.   **D15** `rule` #react: Server Components are preferred for data-fetching.
13.   **D16** `rule` #react: Client Components should only exist where interactivity is required
14.   **D17** `rule` #database #react: Drizzle must never execute in browser/client components.
15.   **D18** `rule` #monorepo #dependencies: Install dependencies at package-level when they are specific to that package’s runtime only (e.g. `drizzle-org` for `packages/core`). [[03-system-design/non-functional/monorepo/dependency-flow|Why?]]
16.   **D19** `rule` #monorepo #dependencies: Install the dependencies at root when given dependency is shared across multiple package. [[03-system-design/non-functional/monorepo/dependency-flow|Why?]]
17.   **D20** `rule` #monorepo #dependencies: Always add dependencies in `package.json` of each package even though such dependency is available through pnpm hoisting. Implicitly relying on pnpm hoisting works in monorepo context but it breaks when the package runs in isolated context or different monorepo environment. Therefore, being explicit about each dependency in `package.json` is safeguard we want to enforce. [[03-system-design/non-functional/monorepo/dependency-flow|Why?]]
18.   **D21** `rule` #packaging: No barrel exports, and similarly, do not use `main` prop of `package.json` to expose barrel file. Use `exports` prop to explicitly expose individual artifacts.
19.   **D22** `rule` #packaging: Include `”side-effects": false` in `package.json` from day one. This will let bundlers perform aggressive tree-shaking and highlight errors and bad practices that comes out of side effects.
20.   **D23** `rule` #copy: Do not hardcode user-visible strings. Until lesson I1, define and use them from `packages/copy`; from I1, from the owning package's catalog. Excludes non-user strings such as instrumentation message sent to server, css class names, and attribute values. derived-from [[D36]] derived-from [[D243]]
21.   **D24** `rule` #config: [[03-system-design/non-functional/monorepo/prefer-json-config|Prefer JSON configuration]].
22.   **D25** `rule` #validation: Validate every external input at the boundary (request bodies, query parameters, external API responses, database rows) with Zod; TypeScript types are erased at runtime. [[03-system-design/non-functional/runtime-validations|Why?]] derived-from [[D49]]
23.   **D26** `rule` #nextjs: Add `export const dynamic = 'force-dynamic'` to the layout of every route group that touches Supabase cookies. [[03-system-design/non-functional/nextjs/force-dynamic|Why?]] derived-from [[D43]]
24.   **D27** `rule` #monorepo #env: List every environment variable in the `env` array of the `build` task in `turbo.json`, not in the Vercel dashboard. [[03-system-design/non-functional/monorepo/env-vars-in-turbo-json|Why?]] derived-from [[D39]]
25.   **D28** `rule` #css: Style with CSS modules only. No Mantine style props, no Tailwind, no utility classes; Mantine's behavioural props are fine. [[03-system-design/non-functional/css/css—modules|Why?]] derived-from [[D47]]
26.   **D29** `rule` #testing: Test at four layers and prove a behaviour at the cheapest layer that can observe it; integration tests through the guarded API are the main seam. Mock only at boundaries. [[03-system-design/non-functional/testing/testing-layers|Why?]] derived-from [[D60]]
27.   **D30** `rule` #react #dependencies: Packages that use React list `react` (and `react-dom`) as peer dependencies; `apps/app` owns the installed version. [[03-system-design/non-functional/monorepo/dependency-flow|Why?]] derived-from [[D58]]
28.   **D31** `rule` #supabase #edge: In `proxy.ts` (Edge runtime) use `createProxyClient`, never `createServerClient`, and use `createProxyClient` nowhere else. [[03-system-design/non-functional/security/edge-runtime|Why?]] derived-from [[D38]]
29.   **D32** `rule` #api: Build REST route handlers that return JSON. No GraphQL and no `/api/v1` prefix until the deferred decisions change. derived-from [[D44]] derived-from [[D46]]
30.   **D33** `rule` #product #metadata: Every metadata field a user or bot fills in is optional; Sidekick's own bookkeeping (ids, counters, timestamps) stays out of the user's way. [[principle.individual-first|Individual First]] derived-from [[D1]]
31.   **D34** `rule` #product #planning: Ask of every item what it costs to add later. A new endpoint or a stylesheet waits; a data migration across every record, or a change to every caller of a shared contract, ships now. A foundation needs a planned, near-term use. [[principle.cost-to-add-later|Cost to Add Later]] derived-from [[D2]]
