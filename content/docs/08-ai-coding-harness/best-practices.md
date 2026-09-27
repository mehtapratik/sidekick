---
id: harness.best-practices
created: 2026-09-19
kind: guidance
version: 1.0.0
tags:
   - ai-coding-harness
   - agent-guidance
   - drizzle
   - api
   - react
   - pnpm
   - css
   - offline
   - embeddings
   - soft-delete
---

1. All handlers to be wrapped in [[03-system-design/non-functional/security/with-api-guard|withApiGuard]].
2. Always use [[03-system-design/non-functional/security/row-level-security|row-level security]] via `withRLSGuard`.
3. [[03-system-design/non-functional/api/never-mutate-outside-api-layer|Never mutate outside the API layer]].
4. [[03-system-design/non-functional/monorepo/dependency-flow|Follow dependency flow]].
5. [[03-system-design/non-functional/database/repository-client|Use the repository client]].
6. [[03-system-design/non-functional/api/idempotent-api|Keep APIs idempotent]].
7. [[03-system-design/non-functional/database/soft-delete-support|Never hard-delete syncable entities]].
8. All select queries to filter soft deleted rows
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
