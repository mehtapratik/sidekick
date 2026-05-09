# Workspace App — Production-Grade Architecture Handover

> Status: Canonical Architecture Document  
> Audience: Solo developer initially, future small engineering team  
> Last Updated: May 2026

---

# 1. Executive Summary

This application is a modular, API-first productivity platform built as:

- A web application (Next.js App Router)
- A Progressive Web App (PWA)
- A future native iOS shell (Capacitor)
- A programmable API platform for agents, automations, workflows, and CLI tooling

The architecture intentionally prioritizes:

1. Security through enforceable structure
2. Long-term maintainability for a solo developer
3. Incremental scalability
4. Future offline-readiness
5. API parity across browser, CLI, and agents

The system is NOT designed as a hyperscale enterprise platform from day one. Instead, it is designed to evolve safely without major rearchitecture.

---

# 2. Architectural Philosophy

## 2.1 API-First

All mutations flow through `/api/v1/*`.

This guarantees:

- Consistent business logic
- Agent compatibility
- CLI compatibility
- Future sync compatibility
- Easier observability
- Centralized authorization

Even browser interactions ultimately use the same API layer.

---

## 2.2 Enforced Security > Convention

The system avoids “remember to do X” security patterns.

Instead:

- Route security is centralized
- RLS context is centralized
- Feature entitlement checks are centralized
- API scope checks are centralized

This reduces long-term drift and accidental vulnerabilities.

---

## 2.3 Modular But Pragmatic

Features are isolated into packages.

However, the MVP intentionally uses:

- Build-time feature registration
- Shared deployment artifact
- Shared runtime

This avoids premature complexity.

The architecture preserves the ability to evolve into:

- runtime plugin loading
- microservices
- independent deployments
- offline sync engines

without large-scale rewrites.

---

# 3. System Overview

```text
┌─────────────────────────────────────────┐
│ Clients                                 │
│                                         │
│ Browser │ PWA │ CLI │ Agents │ iOS     │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ API Layer (/api/v1/*)                  │
│                                         │
│ withApiGuard()                         │
│ ├── Auth                               │
│ ├── Feature Entitlement                │
│ ├── RLS Context                        │
│ ├── Scope Validation                   │
│ └── Handler Execution                  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ PostgreSQL (Supabase)                  │
│                                         │
│ RLS Policies                           │
│ Feature Tables                         │
│ Vector Search                          │
└─────────────────────────────────────────┘
```

---

# 4. Monorepo Structure

```text
apps/
  web/
  cli/

packages/
  core/
  ui/
  features-registry/
  feature-notes/
  feature-writing/
  feature-bookmarks/
  feature-recipes/
  feature-budget/
  feature-ai-chat/
```

---

# 5. Dependency Rules

## 5.1 Critical Rule

`packages/*` MUST NEVER import from `apps/*`.

This is a hard architectural constraint.

Violating this introduces:

- circular dependencies
- invalid build graphs
- hidden coupling
- future deployment problems

---

## 5.2 Allowed Dependency Direction

```text
apps/*
  ↓
packages/features/*
  ↓
packages/core
```

---

## 5.3 Feature Registry

`ALL_FEATURES` lives in:

```text
packages/features-registry
```

This package owns:

- feature manifests
- feature metadata
- feature registration

`core` MUST remain feature-agnostic.

---

# 6. Technology Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 App Router |
| Language | TypeScript Strict |
| DB | Supabase PostgreSQL |
| ORM | Drizzle ORM |
| Styling | Mantine |
| Editor | Tiptap |
| AI SDK | Vercel AI SDK |
| LLM | Anthropic Claude |
| Embeddings | OpenAI text-embedding-3-small |
| Monorepo | Turborepo + pnpm |
| Hosting | Vercel |
| Native Shell | Capacitor |

---

# 7. Security Architecture

# 7.1 Canonical API Security Model

ALL `/api/v1/*` routes MUST use:

```ts
withApiGuard()
```

Direct route handlers are prohibited.

---

# 7.2 Security Flow

Every request passes through:

1. Authentication
2. Feature entitlement validation
3. RLS context setup
4. API scope validation
5. Business logic execution

This flow is mandatory.

---

# 7.3 Why This Matters

Without centralization:

- routes drift over time
- developers forget checks
- RLS gets bypassed
- feature gating becomes inconsistent

The architecture intentionally makes secure behavior the default.

---

# 8. Authentication

## 8.1 Authentication Modes

### Browser/PWA/iOS

Supabase cookie session.

### CLI / Agents

Bearer API keys.

---

## 8.2 API Key Model

API keys support:

- SHA-256 hashing
- scopes
- expiry
- revocation
- last-used tracking

Example scopes:

```text
notes:read
notes:write
recipes:read
chat:write
```

---

## 8.3 API Key Schema

```ts
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey(),

  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, {
      onDelete: 'cascade'
    }),

  keyHash: text('key_hash').notNull(),

  label: text('label'),

  scopes: text('scopes').array().default(sql`'{}'`),

  expiresAt: timestamp('expires_at'),

  revokedAt: timestamp('revoked_at'),

  lastUsedAt: timestamp('last_used_at'),
})
```

---

# 9. Row-Level Security (RLS)

## 9.1 Canonical Pattern

Every user-owned table MUST enforce:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users access own rows"
ON table_name
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

---

## 9.2 RLS Wrapper

The application MUST NEVER manually inject RLS context inline.

Use:

```ts
withRLS(userId)
```

only.

---

## 9.3 Canonical RLS Helper

```ts
export async function withRLS(userId, fn) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claim.sub', ${userId}, true)`
    )

    return fn(tx)
  })
}
```

This removes:

- duplicated SQL
- injection risk
- inconsistent setup

---

# 10. API Guard

## 10.1 Purpose

`withApiGuard()` centralizes:

- auth
- feature checks
- RLS
- scope validation

---

## 10.2 Canonical Implementation

```ts
export function withApiGuard(handler, opts = {}) {
  return async (req) => {
    const auth = await resolveApiCaller(req)

    if (!auth?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (opts.feature) {
      const features = await getEnabledFeatures(auth.userId)

      if (!features.some(f => f.slug === opts.feature)) {
        return Response.json({ error: 'Feature disabled' }, { status: 403 })
      }
    }

    return withRLS(auth.userId, async (tx) => {
      if (opts.requireScope && auth.isApiKey) {
        if (!auth.scopes?.includes(opts.requireScope)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      return handler({
        tx,
        userId: auth.userId,
        req,
      })
    })
  }
}
```

---

# 11. API Route Pattern

## 11.1 Required Structure

```ts
export const GET = withApiGuard(handler, options)
```

This is mandatory.

---

## 11.2 Example

```ts
export const GET = withApiGuard(
  async ({ tx }) => {
    const rows = await tx.select().from(notes)

    return Response.json({ data: rows })
  },
  {
    feature: 'notes',
    requireScope: 'notes:read'
  }
)
```

---

# 12. Repository Architecture

## 12.1 Canonical Mutation Flow

```text
UI → Repository → API → Database
```

---

## 12.2 Why This Exists

This abstraction is intentionally future-oriented.

Today:

```text
Repository → API
```

Future:

```text
Repository → Local DB → Sync Engine → API
```

The UI layer must not care.

---

## 12.3 Server Actions Policy

Server Actions ARE allowed.

However:

- they must use repositories
- they must not bypass APIs
- they must not bypass authorization

This preserves API-first guarantees.

---

# 13. Offline-Ready Design

## 13.1 MVP Status

Offline mode is NOT an MVP feature.

However, the architecture intentionally avoids blocking future implementation.

---

## 13.2 Required Constraints

### Client-generated IDs

Clients generate UUIDs.

This prevents sync collision problems later.

---

### Idempotent APIs

Repeated requests with the same ID must produce the same result.

This is critical for sync reliability.

---

### Repository Layer Mandatory

The repository layer MUST NOT be bypassed.

This is the primary abstraction boundary enabling future sync support.

---

### updatedAt Is Source of Truth

Every syncable entity includes:

```text
createdAt
updatedAt
deletedAt
```

Future conflict resolution depends on `updatedAt`.

`deletedAt` enables soft deletes. This is mandatory from day one — hard deletes cannot propagate to offline clients and cannot be undone after sync data exists. Never use hard deletes on syncable entities.

---

### Soft Deletes Are Mandatory

All syncable entities MUST use soft deletes.

```ts
deletedAt: timestamp('deleted_at')  // null = active, timestamp = deleted
```

Hard deletes are prohibited on syncable tables because:

- Offline clients cannot receive a deletion event for a row that no longer exists
- Sync conflict resolution requires tombstone records
- Data recovery becomes impossible after a hard delete

All queries against syncable tables MUST filter deleted records:

```ts
where(isNull(table.deletedAt))
```

---

# 14. Embedding Pipeline

## 14.1 Requirements

Embedding writes must be:

- asynchronous
- atomic
- retryable
- observable

---

## 14.2 Embedding Status Field

Every content table that participates in the embedding pipeline MUST include an `embeddingStatus` field:

```ts
embeddingStatus: text('embedding_status')
  .notNull()
  .default('pending')  // 'pending' | 'complete' | 'failed'
```

This field is the source of truth for embedding state. It enables:

- querying for un-embedded or failed content
- manual or automated retry of failed jobs
- visibility into pipeline health without log-scraping
- safe re-embedding after model upgrades

Status transitions:

```text
pending → complete   (successful embedding write)
pending → failed     (all retries exhausted)
failed  → pending    (manual or automated retry trigger)
```

Any content with `embeddingStatus = 'failed'` MUST be logged and retryable. Silent failures are not acceptable.

---

## 14.3 Atomic Writes

Embeddings must be written in a transaction.

Never:

```text
delete → insert (outside transaction)
```

This can temporarily remove embeddings.

---

## 14.4 Retry Policy

Embedding jobs:

- retry twice
- exponential backoff
- log all failures
- set `embeddingStatus = 'failed'` after retries exhausted

---

## 14.5 Observability

At minimum:

- structured logs
- failed embedding logs
- latency visibility

MVP does NOT require full observability infrastructure.

---

# 15. Feature System

## 15.1 Current Design

Features are:

- build-time registered
- package isolated
- entitlement controlled

This is intentional.

---

## 15.2 Current Limitation

Inactive features are still included in the build.

This is acceptable for MVP.

---

## 15.3 Future Evolution

The architecture can later evolve toward:

- runtime plugin loading
- independent deployments
- feature microservices

without major rewrites.

---

# 16. Database Migrations

## 16.1 Package Ownership

Every feature package owns:

```text
schema.ts
drizzle.config.ts
migrations/
```

There is NO global drizzle config.

---

## 16.2 Migration Orchestration

Root command:

```bash
pnpm db:migrate
```

This script:

1. discovers packages
2. executes migrations in deterministic order
3. fails fast on errors

---

## 16.3 Why This Matters

This prevents:

- schema drift
- inconsistent environments
- hidden migration dependencies

---

# 17. Background Jobs

## 17.1 MVP Strategy

Use lightweight async background execution:

- `waitUntil()`
- Vercel background execution
- retry wrappers

---

## 17.2 Future Strategy

Can evolve toward:

- Inngest
- queues
- cron workflows
- distributed workers

without changing API contracts.

---

# 18. Observability

## 18.1 Minimal MVP Requirements

- request logging
- failed job logging
- API latency logging
- auth failure logging

---

## 18.2 Recommended Logging Placement

Inside:

```text
withApiGuard()
```

This provides centralized visibility.

---

# 19. Developer Rules

## Critical Enforcement Rules

### Rule 1

All API routes MUST use:

```ts
withApiGuard()
```

---

### Rule 2

Never manually set RLS context.

Use:

```ts
withRLS()
```

only.

---

### Rule 3

Never mutate data outside the API layer.

---

### Rule 4

Never import from `apps/*` inside `packages/*`.

---

### Rule 5

Repository layer must not be bypassed.

---

### Rule 6

All syncable APIs should be idempotent.

---

### Rule 7

Never hard-delete syncable entities.

Use soft deletes:

```ts
deletedAt: timestamp('deleted_at')
```

All queries against syncable tables must filter `where(isNull(table.deletedAt))`.

---

### Rule 8

All content tables participating in the embedding pipeline MUST include an `embeddingStatus` field.

Set it to `'failed'` after retries are exhausted. Never silently drop failed embedding jobs.

---

# 20. Operational Details Preserved From Original Handover

## 20.1 Environment Variables

The original handover contained important operational environment variables that must remain part of the canonical architecture.

### Supabase

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
```

### AI Providers

```env
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

### Billing

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### App

```env
NEXT_PUBLIC_APP_URL=
```

---

## 20.2 Supabase Client Separation

The architecture intentionally separates:

- browser client
- server client
- admin/service-role client

This separation is security-critical.

### Browser Client

Uses:

```ts
createBrowserClient()
```

### Server Client

Uses:

```ts
createServerClient()
```

### Admin Client

Uses service-role credentials and must only execute in trusted server environments.

---

## 20.3 Middleware Responsibilities

Next.js middleware is responsible for:

- session refresh
- redirecting unauthenticated browser users
- excluding API routes from redirect behavior

Middleware MUST NOT contain business authorization logic.

Authorization belongs in:

```text
withApiGuard()
```

---

## 20.4 Mantine Setup Requirements

The original handover included important Mantine setup requirements.

### Required Imports

```css
@import '@mantine/core/styles.css';
@import '@mantine/notifications/styles.css';
@import '@mantine/tiptap/styles.css';
```

### Required Providers

```tsx
<MantineProvider>
<Notifications />
```

### PostCSS Plugins

```text
postcss-preset-mantine
postcss-simple-vars
```

These are required for Mantine CSS variable resolution.

---

## 20.5 Tiptap Requirements

The original architecture contained several important editor requirements.

### Requirements

- JSON storage format
- Markdown export support
- Rich text toolbar
- Mobile-friendly editing
- Semantic chunk generation for embeddings

### Important Constraint

Embedding generation should operate on semantic markdown output rather than raw text extraction whenever possible.

---

## 20.6 AI / RAG Requirements

The original handover included important AI pipeline details.

### Requirements

- pgvector enabled
- HNSW index
- semantic chunking
- overlap chunk strategy
- async embedding generation
- retrieval-augmented generation
- streaming AI responses

### Required Database Function

```text
match_content()
```

This function remains part of the canonical design.

---

## 20.7 CLI Requirements

The CLI remains a first-class architectural citizen.

### Responsibilities

- authenticated API access
- streaming chat support
- automation support
- local scripting support
- future agent interoperability

### Canonical Principle

The CLI must use the same public API surface as external agents.

---

## 20.8 PWA Requirements

The original handover included important PWA constraints.

### Requirements

- installable web app
- manifest.json
- service worker
- offline asset caching
- mobile-compatible shell

### Canonical Tooling

```text
Serwist
```

---

## 20.9 Capacitor / iOS Strategy

The MVP native strategy remains:

```text
Capacitor + hosted Next.js application
```

The architecture intentionally delays:

- embedded offline DB
- native sync engine
- fully local-first execution

until post-MVP.

---

## 20.10 Implementation Phases

The phased rollout strategy from the original handover remains valid.

### Canonical Order

1. Monorepo foundation
2. Auth + shell
3. Notes feature
4. Writing feature
5. Content features
6. AI layer
7. Billing
8. Bots / workflows
9. Native shell

This phased sequence intentionally reduces architectural risk.

---

## 20.11 Remaining Important Constraints From Original Handover

### Constraint 1

Feature manifests remain the canonical feature contract.

### Constraint 2

All features must enforce entitlement checks at API boundaries.

### Constraint 3

Background embedding generation must never block user writes.

After all retries are exhausted, `embeddingStatus` must be set to `'failed'`. Failed jobs must remain queryable and retryable.

### Constraint 3a

All syncable entities must include `deletedAt` for soft delete support. Hard deletes are prohibited on syncable tables.

### Constraint 4

Server Components are preferred for data-fetching.

### Constraint 5

Client Components should only exist where interactivity is required.

### Constraint 6

Drizzle must never execute in browser/client components.

### Constraint 7

Repository abstractions are mandatory for all mutations.

---

# 21. Final Architectural Position

This architecture intentionally optimizes for:

- maintainability
- correctness
- solo-developer velocity
- future extensibility

while explicitly avoiding:

- premature microservices
- premature offline complexity
- runtime plugin overengineering
- unnecessary infrastructure

The system is designed to evolve safely over time without foundational rewrites.

