---
title: Supabase & API
---

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

---

## `app_runtime` Role for Drizzle Runtime Connection

### What

`DATABASE_URL` (the pooler connection used by Drizzle at runtime) connects as `app_runtime`, a non-superuser PostgreSQL role. `DATABASE_DIRECT_URL` (used by Drizzle Kit for migrations) continues to connect as the superuser `postgres`.

### Why

Drizzle connecting as the `postgres` superuser bypasses Row Level Security entirely — all RLS policies are ignored for superuser connections. This meant the RLS policies defined on user tables were never actually enforced for any runtime query; enforcement relied solely on application-level `WHERE user_id = ...` clauses.

Switching to `app_runtime` makes RLS enforced at the database level for all runtime queries, consistent with the architecture's philosophy of "Enforced Security > Convention."

### Setup

Role creation is a **one-time manual step** performed in the Supabase SQL Editor — it is not in any migration file. The reason: the `CREATE ROLE` statement includes a password, and the repository is public. Credentials must never enter version control.

```sql
-- Run once in Supabase SQL Editor only — never commit
CREATE ROLE app_runtime WITH LOGIN PASSWORD 'your-strong-password';
```

GRANT statements and `DEFAULT PRIVILEGES` are in migration `0001_app_runtime_grants.sql` (safe to commit — no secrets):

```sql
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
```

`ALTER DEFAULT PRIVILEGES` means every new table created by future migrations is automatically accessible to `app_runtime` — no per-table GRANT needed when adding feature packages.

### Verification

`SET ROLE app_runtime` does not work in the Supabase SQL Editor — Supabase restricts role switching in the dashboard. Verify the setup using system catalog queries instead:

```sql
-- Role exists
SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = 'app_runtime';

-- Grants applied
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'app_runtime';

-- RLS policies exist
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'profiles';
```

True end-to-end verification: update `DATABASE_URL` in `.env.local` to `app_runtime` credentials and confirm the running application loads correctly.

### Tradeoff

Non-superuser roles require explicit privilege grants. `ALTER DEFAULT PRIVILEGES` eliminates the per-table maintenance burden for future tables, but the initial role creation and `GRANT` on existing tables is a one-time manual step that lives outside of the automated migration flow. This is documented here as the single source of truth for that step.
