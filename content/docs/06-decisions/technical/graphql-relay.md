---
id: decision.technical.graphql-relay
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - api-guard
   - rls
   - supabase
   - drizzle
   - api
   - authentication
   - nextjs
status: deferred
revisit_when: external clients, CLI, or agent integration materially expands
applies_to:
   - "[[03-system-design/non-functional/api/graphql-and-relay]]"
---

REST API for MVP. GraphQL evaluation is deferred. All API routes use standard Next.js Route Handlers returning JSON.

## Why not now

\> **Cognitive load.** Phase 1 introduced Supabase, Drizzle, Next.js App Router, RLS, and the `withApiGuard` abstraction simultaneously. Adding GraphQL schema design, resolver patterns, and the Relay compiler on top of that would have made Phase 1 unmanageable from a learning perspective.

\> **Relay + App Router friction.** Relay's compiler and Next.js App Router Server Components have a non-trivial integration story as of Phase 1. The ecosystem has not settled on a clear pattern. Using Relay now would mean fighting against both tools simultaneously.

\> **`withApiGuard` maps cleanly to REST.** The current API guard takes a handler function and options — a direct match for REST's one-handler-per-route model. Adapting it to a GraphQL resolver architecture would require a different mental model and a non-trivial adapter layer.

\> **REST is sufficient.** MVP has one client, clear endpoints, and modest data requirements. Over-fetching is not a problem at this scale.

## When to revisit

- After MVP ships, when data-fetching complexity (deeply nested relationships, multiple resources per page) becomes a real pain point
- When Relay + App Router integration matures in the ecosystem and a clear pattern emerges
- When multiple clients with different data needs make over-fetching/under-fetching a genuine problem

## How to add when the time comes

GraphQL could replace or augment the REST layer without a full architectural rework:

- REST routes that serve the web app could be replaced with GraphQL resolvers
- REST routes that serve the CLI and external agents could remain as-is (REST is a better fit for scripting)
- `withApiGuard` would need a GraphQL resolver adapter — wrapping resolvers instead of route handlers — but the core auth → entitlement → RLS → handler chain would remain the same
