# Decision — Supabase & API-Related Decisions

---

## API Versioning Deferred to Post-MVP

### What

Current API routes live at `/api/` with no version prefix. Versioning (`/api/v1/`, `/api/v2/`) is deferred.

### Why not now

MVP has one client: the web application. There is no external party that needs migration time when a breaking change is made. Adding `/api/v1/` adds URL complexity and forces a naming convention decision (what constitutes a "version"?) with no current benefit. Breaking changes during MVP can be coordinated directly — there is only one consumer.

### When to add

Add API versioning when:
- Multiple external clients (CLI, agents, third-party integrations) need time to migrate after breaking changes
- Breaking changes become frequent enough that direct coordination is impractical

### How to add when the time comes

Create a versioned route group at `apps/web/src/app/api/v1/`. Move route handlers into the versioned group. No architectural rework is needed — Next.js route groups handle the URL structure, and `withApiGuard` works identically regardless of the URL prefix. Old unversioned routes can be aliased or left in place during a migration period.

---

## GraphQL + Relay Deferred to Post-MVP

### What

REST API for MVP. GraphQL evaluation is deferred. All API routes use standard Next.js Route Handlers returning JSON.

### Why not now

**Cognitive load.** Phase 1 introduced Supabase, Drizzle, Next.js App Router, RLS, and the `withApiGuard` abstraction simultaneously. Adding GraphQL schema design, resolver patterns, and the Relay compiler on top of that would have made Phase 1 unmanageable from a learning perspective.

**Relay + App Router friction.** Relay's compiler and Next.js App Router Server Components have a non-trivial integration story as of Phase 1. The ecosystem has not settled on a clear pattern. Using Relay now would mean fighting against both tools simultaneously.

**`withApiGuard` maps cleanly to REST.** The current API guard takes a handler function and options — a direct match for REST's one-handler-per-route model. Adapting it to a GraphQL resolver architecture would require a different mental model and a non-trivial adapter layer.

**REST is sufficient.** MVP has one client, clear endpoints, and modest data requirements. Over-fetching is not a problem at this scale.

### When to revisit

- After MVP ships, when data-fetching complexity (deeply nested relationships, multiple resources per page) becomes a real pain point
- When Relay + App Router integration matures in the ecosystem and a clear pattern emerges
- When multiple clients with different data needs make over-fetching/under-fetching a genuine problem

### How to add when the time comes

GraphQL could replace or augment the REST layer without a full architectural rework:
- REST routes that serve the web app could be replaced with GraphQL resolvers
- REST routes that serve the CLI and external agents could remain as-is (REST is a better fit for scripting)
- `withApiGuard` would need a GraphQL resolver adapter — wrapping resolvers instead of route handlers — but the core auth → entitlement → RLS → handler chain would remain the same
