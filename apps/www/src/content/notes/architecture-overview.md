---
title: Architecture Overview
deck: >-
  Sidekick's architectural overview — an API-first platform tuned for
  solo-developer
created: '2026-07-09'
updated: '2026-07-09'
version: 1.0.0
tags:
  - sidekick
  - project
  - technical
  - architecture
category: notes
sourcePath: notes/architecture-overview.md
wordCount: 5731
readingMinutes: 27
author: Pratik Mehta
license: CC BY-NC 4.0
audience: Software Engineers
status: active
description: >-
  Sidekick's architectural overview — an API-first platform tuned for
  solo-developer
---

## 1. Executive summary

The Sidekick will be a modular, API-first productivity platform with multiple types of clients in mind: a Next.js powered web app, a PWA (Progressive Web Application), and above all, a programmable API platform for agents, automations, workflows and CLI tooling.

The application architecture intentionally prioritizes security through enforceable structure, maintainability for solo-developer, incremental scalability, future support for offline capabilities, and API parity across browser, CLI, and agents.

The system is NOT designed as a hyper-scale enterprise platform from day one. Instead, it is designed to evolve safely without major re-architecture.

---

## 2. Architectural philosophy

### 2.1 API-first platform

Sidekick will be API-first product — exposed publicly through detailed documentation to let power users extend/customer its features. To keep things simple and to avoid drifts, we will not have private APIs for our own clients. Even our clients (web app, CLI, agents, native apps, automations) will have to go through same public-API to access features. This strategy comes with many benefits:

1. Product’s business logic is centralized in API-layer
2. In future, it will be easier to integrate out capability with third-party providers
3. Features are CLI and AI-agent compatible
4. Authorization is centralized

MVP version intentionally excludes api versioning to keep scope manageable and simple while keeping the architecture flexible enough to shift to that goal when warranted.

### 2.2 Enforced conventions, especially security

We want to add every guardrails possible to enforce architectural guidelines and standards through linting, and testing. This strategy eliminates the need for having to remember everything. This is prominent in our security enforcement:

1. Route security and its context is centralized
2. Feature entitlement checks are centralized
3. API-scope checks are centralized

### 2.3 Modular but pragmatic

Sidekick’s architecture is intentionally designed to to balance complexity and simplicity in a way that works today for solo-developer while keeping it open enough to add needed complexity later when need arises. For example, whether a specific feature is authorized or not, MVP (Minimum Viable Product) will build all features, deploy everything and share the runtime (i.e. features are not containerized).

This avoid premature complexity and support rapid development cycle. The architecture is open enough to support runtime feature loading, microservices, independent deployments, and offline sync-engines without large-scale rewrites.

---

## 3. System overview

```markdown
┌─────────────────────────────────────────┐
│ Clients                                 │
│                                         │
│ Browser │ PWA │ CLI │ Agents │ iOS      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ API Layer (/api/*)                      │
│                                         │
│ withApiGuard()                          │
│ ├── Auth                                │
│ ├── Feature Entitlement                 │
│ ├── RLS Context                         │
│ ├── Scope Validation                    │
│ └── Handler Execution                   │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ PostgreSQL (Supabase)                   │
│                                         │
│ RLS Policies                            │
│ Feature Tables                          │
│ Vector Search                           │
└─────────────────────────────────────────┘
```

---

## 4. Monorepo structure

```
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

### 4.1. Dependency rules

- NEVER import `apps/*` in `packages/*`. Violating this rule may introduce circular dependencies, invalid build graph, hidden coupling and future deployment problems. Allowed dependency direction is

```
apps/*
  ↓
packages/features/*
  ↓
packages/core
```

- `packages/features-registry` is the ledger of all features Sidekick will offer. It will host feature manifests, metadata and registration information.
- `packages/core` must ALWAYS remain feature agnostic.

> [!Question] Should we make following changes and enforce…
>
> 1. That we should use folder-level depth to reflect dependencies flow. In other words, if a package `bar` and `foo` lives inside `packages` folder they may not depend on each other. But, both `foo` and `bar` and depend on `packages/globals/core`. Same way, `apps/web` and `apps/cli` cannot reference each other.
> 2. features can move into `packages/features/` folder.
> 3. `features-registry` can live inside `packages/` folder as just `registery`.

---

## 6. Technology stack

| Layer        | Choice                        |
| ------------ | ----------------------------- |
| Frontend     | Next.js 16 App Router         |
| Language     | TypeScript Strict             |
| DB           | Supabase PostgreSQL           |
| ORM          | Drizzle ORM                   |
| Styling      | Mantine                       |
| Editor       | Tiptap                        |
| AI SDK       | Vercel AI SDK                 |
| LLM          | Anthropic Claude              |
| Embeddings   | OpenAI text-embedding-3-small |
| Monorepo     | Turborepo + pnpm              |
| Hosting      | Vercel                        |
| Native Shell | Capacitor                     |

---

## 7. Security

All routes must use `withAPIGuard()` —direct route handlers are prohibited.

Every request must pass through authentication, feature entitlement check, RLS context setup, and API scope validation, before honoring the request.

Without `withAPIGuard`, routes begin to drift and security flow becomes inconsistent or even erroneous over time. For instance, a developer might forget to validate API scope.

This in line with our philosophy of enforced conventions (section 2.2). We make secure behavior easy to implement and difficult to bypass.

---

## 8. Authentication

Web app, PWA, and iOS will use cookie-based session for authentication. Whereas, CLI and agents will use bearer keys.

API keys will support SHA-256 hashing, scopes, expiry, revocation, last-used tracking.

```markdown
# Example of API scopes

- notes:read
- notes:write
- recipes:read
- chat:write
```

### 8.1 API key schema

```typescript
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, {
      onDelete: 'cascade',
    }),
  keyHash: text('key_hash').notNull(),
  label: text('label'),
  scopes: text('scopes')
    .array()
    .default(sql`'{}'`),
  expiresAt: timestamp('expires_at'),
  revokedAt: timestamp('revoked_at'),
  lastUsedAt: timestamp('last_used_at'),
});
```

---

## 9. Row-Level Security (RLS)

### 9.1 Canonical pattern

We will use PostgreSQL’s Row-Level Security features to allow operations on records (rows) that current user is permitted to see and operate on. By default, PostgreSQL enforces RLS for ALL _non-superuser_ PostgreSQL roles. We will use Drizzle ORM to query the database, and since Drizzle connects to PostgreSQL through a non-superuser role, `app_runtime`, RLS should enforced for all Drizzle queries at system level.

While RLS is enabled simply by `ENABLE ROW LEVEL SECURITY` clause, how RLS is enforced depends on the policies you define. Sidekick will have two types of tables with two different types of RLS policies:

> [!NOTE] Syncable and non-syncable tables
> Sidekick will have two type of database tables: syncable and non-syncable. The **syncable** tables are the ones that supports offline content on users’ devices and syncing of their across them all and server when online. Tables such as _bookmarks_, _notes_, _writings_ are example of syncable tables. **Non-syncable** tables, such as _profiles_ are the one that will only live on server and not on user’s devices for security purposes. Therefore, user must be online to be able to authenticate/re-authenticate.
>
> ```sql
> /* three timestamp columns of syncable table */
> createdAt
> updatedAt   /* source of truth for conflict resolution */
> deletedAt   /* null = active, timestamp = deleted (tombstone) */
> ```
>
> **What makes an entity “syncable” or “non-syncable”?**
> A syncable entity must carry three timestamp columns: `createdAt`, `updatedAt`, `deletedAt`. The presence of `updatedAt` and `deletedAt` is a tell that application supports offline features. Using these two timestamps, conflict resolution across all client and server happens when they are online. A non-syncable entity, on the other hand, doesn’t have these attributes, because they don’t have to support conflict resolution. Non-syncable entity also hard-deletes rows from the database.

Non-syncable table hard-deletes rows, we will not have `deletedAt` clause in their RLS policy:

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile"
ON profiles
FOR ALL
USING  (id::text = current_setting('app.current_user_id', true))
WITH CHECK (id::text = current_setting('app.current_user_id', true));
```

Whereas, syncable entity will have `deletedAt` guard in `USING` clause to filter soft-deleted rows from its result. Notice that we did not include `deletedAt` guard in `WITH CHECK`. That’s because reversal of soft-deleted row is a legitimate operation.

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_name FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_own_rows"
ON table_name
FOR ALL
USING (
  user_id::text = current_setting('app.current_user_id', true)
  AND deleted_at IS NULL
)
WITH CHECK (
  user_id::text = current_setting('app.current_user_id', true)
);
```

**Difference between `ENABLE` and `FORCE` RLS**:

- `ENABLE ROW LEVEL SECURITY`:
  - Turns RLS on for the table. Once enabled, any policies you’ve defined start being enforced.
  - Key exception is that the **table _owner_ (and _superusers_) bypass RLS** by default. So even with RLS enabled, the owner still sees and modifies all rows as if no policies existed.
  - If RLS is enabled but _no_ policies exist, the default is deny-all — normal users see zero rows.
- `FORCE ROW LEVEL SECURITY`:
  - **Makes RLS apply to the table owner as well**, closing the default owner-bypass loophole.
  - It **does not affect superusers or roles with the `BYPASSRLS` attribute** — those always bypass RLS regardless.
  - `FORCE` is only **meaningful in combination with `ENABLE`**; on its own it does nothing because RLS still has to be turned on.

**Difference between `USING` and `WITH CHECK`**
The USING clause is a guard for existing rows the policy can see / touch (applied to rows already in the table). And the WITH CHECK guards which row values are allowed to result from a write (applied to the new/proposed row data).

| Command   | `USING` applies?                                                                                                                                       | `WITH CHECK` applies?                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ‎⁠SELECT⁠ | Yes                                                                                                                                                    | —                                                                                                                                                                |
| ‎⁠INSERT⁠ | —                                                                                                                                                      | Yes                                                                                                                                                              |
| ‎⁠UPDATE⁠ | Yes (which rows you may update)                                                                                                                        | Yes (what the row may become)                                                                                                                                    |
| ‎⁠DELETE⁠ | Yes                                                                                                                                                    | —                                                                                                                                                                |
| MEANING   | _filters the existing rows (even for write operations like `UPDATE` and `DELETE` to prevent operations on rows systems is not supposed to operate on)_ | _validates proposed changes (validate new insertions and updates, i.e. what would row become if operation were to be permitted must meet `WITH CHECK` criteria)_ |

> [!Question] What happens to user’s data when their profiles are deleted?
> Since user’s content is _syncable_ (therefore, soft-deleted) and profiles table is _non-syncable_ (therefore, hard-deleted when user closes/deletes their account), how we will manage erasure of user’s content? This is also GDPR requirement to support user’s request to permenent delete their data.

### 9.2 RLS Helper

The application MUST NEVER manually inject RLS context inline. Always use RLS helper, `withRLS(userId, …)` only.

```typescript
export async function withRLS<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
```

Notice the presence of `db.transaction` wrapper here, which is one of the key security measure. Without this wrapper, `set_config` with `is_local = true` will not reset once query finishes execution. And thus, these settings will persist across entire pooled connection - leaking current user ID to next requests.

### 9.3 Soft-delete trigger functions

The Sidekick database will define two shared functions to enforce soft-delete constraints: `enforce_soft_delete` and `block_update_on_deleted`. As the name suggests, these function ensures that non-superuser role cannot hard-delete or update soft-deleted rows.

```sql
-- Blocks hard deletes unless explicitly opted in
CREATE OR REPLACE FUNCTION enforce_soft_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_hard_delete', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'Hard deletes are prohibited on %. Use soft delete (set deleted_at).', TG_TABLE_NAME;
  END IF;
  RETURN OLD;
END;
$$;

-- Blocks updates on already soft-deleted rows
CREATE OR REPLACE FUNCTION block_update_on_deleted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot update a soft-deleted row in % (id: %). Restore it first.',
      TG_TABLE_NAME, OLD.id;
  END IF;
  RETURN NEW;
END;
$$;
```

All feature tables will use these shared functions to enforce soft-delete constraints:

```sql
CREATE TRIGGER no_hard_delete_[table]
  BEFORE DELETE ON [table]
  FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();

CREATE TRIGGER no_update_deleted_[table]
  BEFORE UPDATE ON [table]
  FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();
```

### 9.4 Database security summary

| Constraint                           | Mechanism                           | Enforced at |
| ------------------------------------ | ----------------------------------- | ----------- |
| User sees only their own rows        | RLS USING clause                    | Database    |
| Soft-deleted rows invisible to users | RLS USING clause                    | Database    |
| Hard deletes blocked                 | BEFORE DELETE trigger               | Database    |
| Updates on deleted rows blocked      | BEFORE UPDATE trigger               | Database    |
| SELECT filtering (belt)              | `where(isNull(deletedAt))` in repos | Application |

Triggers fire for **all roles** including service role and superuser. RLS is enforced because Drizzle connects as `app_runtime` (non-superuser). `createAdminClient()` bypasses RLS but not triggers.

```typescript
// packages/feature-notes/notesRepository.ts
export const notesRepository = {
  listActive(tx) {
    // `where(isNull(notes.deletedAt))`, here, is double insurance that
    // RLS policy enforced at DB level, plus this additional clause,
    // ensures that soft-deleted rows are not let-in unintentionally
    return tx.select().from(notes).where(isNull(notes.deletedAt));
  },

  getById(tx, id) {
    return tx
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)));
  },

  create(tx, data) {
    return tx.insert(notes).values(data);
  },

  softDelete(tx, id) {
    return tx.update(notes).set({ deletedAt: new Date() }).where(eq(notes.id, id));
  },
};
```

#### 9.4.1 `createAdminClient`—a Supabase interface

The `createAdminClient()` executes queries as a superuser role, and thus, it bypasses RLS entirely. Therefore, query executed using `createAdminClient` will return all deleted and non-active-user rows as well. This is intentional and has legitimate purpose. When you use `createAdminClient` interface explicitly, you’re essentially saying “_I need to bypass RLS and I know what I am doing._” Setup, configuration and maintenance activities usually fall under this category but sometime regular user flow such as user profile creation, accepting other user’s invite also flow into this category.

However, you must not by pass RLS for most regular user-flow queries. This is where we will use Drizzle client.

#### 9.4.2 Drizzle client

We already noted that Drizzle queries are executed through non-superuser role and RLS is enforced on all non-superuser roles. Therefore, it becomes crucial that all regular user queries are invoked through Drizzle ORM to enforce RLS.

| Supabase client                          | Drizzle client                                                        |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `await admin.from('notes').select('*');` | `db.select().from(table);`                                            |
| Executed as `SELECT * FROM notes`        | `SELECT * FROM notes WHERE deleted_at IS NULL AND user_id = <userId>` |
| superuser role                           | `app_runtime` - non-superuser role                                    |
| No RLS                                   | Enforces RLS                                                          |
| Enforces triggers                        | Enforces Triggers                                                     |

#### 9.4.3 Funnel all reads through DB repository client

By conventions, we want to ensure that all queries are executed under right context. And ensuring this is the job of DB repository layer through which every query must be routed. Never execute any rogue database query directly. This simple convention will in turn will ensure right guards (RLS or no-RLS) before executing the query. Whether the query is executed through Supabase client’s `createAdminClient` or Drizzle ORM, all queries must pass through DB repository client where we ensure right guard are added.

> [!Question] How can we ensure all queries, `createAdminClient` or Drizzle, are routed through DB repository layer?

> [!Question] How do we ensure read queries are authenticated, and authorized?
> Original handover document only talks about mutations, not select queries. Can select queries be scattered? If so, why? Why not route select queries also through repository layer?

---

## 10. API guard

We will `withAPIGuard` wrapper to centralize auth, feature entitlements, RLS and scope validations.

### 10.1 How `withAPIGuard` will be implemented?

```typescript
export function withApiGuard(handler, opts = {}) {
  return async (req) => {
    const auth = await resolveApiCaller(req);

    if (!auth?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (opts.feature) {
      const features = await getEnabledFeatures(auth.userId);

      if (!features.some((f) => f.slug === opts.feature)) {
        return Response.json({ error: 'Feature disabled' }, { status: 403 });
      }
    }

    return withRLS(auth.userId, async (tx) => {
      if (opts.requireScope && auth.isApiKey) {
        if (!auth.scopes?.includes(opts.requireScope)) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      return handler({
        tx,
        userId: auth.userId,
        req,
      });
    });
  };
}
```

### 10.2 How `withAPIGuard` will be used?

```typescript
const handler = async ({ tx }) => {
  const rows = await tx.select().from(notes);
  return Response.json({ data: rows });
};

const options = {
  feature: 'notes',
  requireScope: 'notes:read',
};

export const GET = withAPIGuard(handler, options);
```

---

## 11. Repository architecture

### 11.1 Query flow

All queries flow from `UI -> Repository -> API -> Database`, strictly. This abstraction is intentional and future-proof when `UI -> Repository -> Local DB -> Sync Engine -> API -> Database`. In this manner, UI will never care how data flows.

### 11.2 Server actions

Server actions are allowed as long as 1) they pass through repositories, 2) does not bypass APIs, and 3) neither does it bypass authorization checks. Once again, this is to ensure our **API-first guarantee**.

## 12. Offline-ready design

Offline capabilities are excluded from MVP scope. However, architecture has left the door easier implementation in future.

### 12.1 Constraints

- **UUIDs**: Client will generate `UUID`s to prevent collision issues later.
- **Idempotent APIs**: Repeated requests with the same ID must produce the same result. This is critical for sync reliability.
- **Repository layer mandatory**: The repository layer MUST NOT be bypassed. This is the primary abstraction boundary enabling future sync support.
- Soft deletes are mandatory: All _syncable_ entities must support soft deletes. Therefore, all queries against syncable tables must filter soft-deleted records.
- **`updatedAt` is the source of truth**: Every syncable entity includes `createdAt`, `updatedAt`, and `deletedAt`. Conflict resolutions depends upon `updatedAt`. And `deletedAt` supports soft-delete, which is mandatory from day one since hard-delete are difficult to support in offline environment.
  - **You deleted a row when you were offline**: How would server know when a row was deleted from a your iPhone when it becomes online? Deleted row is simply gone from iPhone’s local storage. When we see difference between server and iPhone storage, is that the row is added from different client (say, iPad) and current iPhone’s storage is missing the row? Or that the iPhone deleted the row and server isn’t synced yet. There is no easy way to answer this. `deletedAt` answers this easily and without much complication.
  - Hard deletes are irreversible: Even if you manage to implement an algorithm to identify whether a new row was added or deleted between different clients and server (may be using complicated logic of checking `createdAt`, `updatedAt`, `lastSynced` attributes), you are still facing a serious user experience problem: user’s actions are unforgiving. Once rows are deleted, there is no way to bring them back. If user says “oops, I deleted a wrong blog,” there is no way to bring it back. Therefore, soft deletion is preferred to support offline capabilities and reversibility.

---

## 13. Embedding pipeline

Embedding writes must be asynchronous, atomic, _retryable_, and observable.

### 13.1 `embedding_status` field

Every content table that participates in the embedding pipeline MUST include an `embeddingStatus` field:

```typescript
embeddingStatus: text('embedding_status').notNull().default('pending'); // 'pending' | 'complete' | 'failed'
```

This field is the source of truth for embedding state. It enables:

1. querying for un-embedded or failed content
2. manual or automated retry of failed jobs
3. visibility into pipeline health without log-scraping
4. safe re-embedding after model upgrades

**Status transitions:**

```markdown
pending → complete (successful embedding write)
pending → failed (all retries exhausted)
failed → pending (manual or automated retry trigger)
```

Any content with `embeddingStatus = 'failed'` MUST be logged and retryable. Silent failures are not acceptable.

### 13.2 Atomic writes

Embedding must be written as single atomic transaction. Never `delete and then insert` _outside_ a transaction. Doing so outside an transaction, temporary makes those embedding unavailable.

### 13.3 Retry policy

Embedding jobs must retry twice, used exponential backoff strategy, log all failures, and set `embeddingStatus = ‘failed’` after retries are exhausted

### 13.4 Observability

At minimum, support structured logs, failed embedding logs, and latency visibility. MVP does not require full observability infrastructure.

---

## 14. Feature system

MVP will support feature system with build time registration, isolated packages as features, and control them via entitlements. Inactive (unauthorized) features are still built, which is acceptable tradeoff for MVP. The feature system is designed this way intentionally support its future evolution where we load plugins runtime, support feature-wise deployments, and features microservices (and even microfrontends). All these without major rewrites.

---

## 15. Database migration

**Package-level migration scoping**: Every feature (also a package) owner its own `schema.ts`, `drizzle.config.js`, and `migration` scripts. There is NO global Drizzle config.

**Migration orchestration**:We will have `pnpm db:migrate` command in root of the monorepo that will orchestrate package discovery, running migration script in right order and failing fast on errors.

Having each package own its own database migration config eliminates the issues of schema drift, inconsistent environments, and hidden migration dependencies.

---

## 16. Background jobs

**For the MVP**, Sidekick will use lightweight async background execution using `waitUntil()`, Vercel background execution, and retry wrappers. Later, this will evolve into Inggest, queues, cron workflows, and distributed workers without changing API contracts.

---

## 17. Observability

At minimum, MVP will support request logging, failed job logging, API latency logging, and auth failure logging. Logging will be done inside `withAPIGuard()` for centralized visibility.

---

## 18. Developer rules

1. All API routes must use `withAPIGuard()`.
2. Never set RLS context manually. Use `withRLS()` only.
3. Never mutate data outside the API layer.
4. Never import from `apps/*` inside `packages/*`.
5. Repository layer must not be bypassed.
6. All syncable APIs should be idempotent.
7. Never hard-delete syncable entities, and all queries against syncable tables must filter `where(isNull(table.deletedAt))`.
8. All content tables participating in the embedding pipeline MUST include an `embeddingStatus` field. Set it to `'failed'` after retries are exhausted. Never silently drop failed embedding jobs.
9. Never use `createAdminClient().from(...).delete()` to hard-delete rows from syncable tables. The BEFORE DELETE trigger fires for all roles including service role. The delete will be rejected regardless of the client used. Hard-deletes that must bypass the trigger (e.g. GDPR erasure) require a dedicated Drizzle transaction:

```typescript
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL app.allow_hard_delete = 'true'`);
  await tx.delete(table).where(eq(table.id, id));
});
```

`SET LOCAL` scopes the flag to the transaction — it resets on commit or rollback. This is the only legitimate hard-delete pathway.

---

## 19. Operational details

### 19.1 Types of Supabase clients

| Client                        | File         | Key                               | Used In                                             |
| ----------------------------- | ------------ | --------------------------------- | --------------------------------------------------- |
| `createBrowserClient()`       | `browser.ts` | publishable key                   | Client Components (`'use client'`)                  |
| `createServerClient()`        | `server.ts`  | publishable key + cookies         | Server Components, Route Handlers (Node.js runtime) |
| `createProxyClient(req, res)` | `proxy.ts`   | publishable key + request cookies | `proxy.ts` only (Edge runtime)                      |
| `createAdminClient()`         | `admin.ts`   | secret key (bypasses RLS)         | Server-only, trusted operations                     |

1. **createBrowserClient**—the untrusted client
   1. **Runs in:** the user’s browser, inside `'use client'` client components
   2. Uses **publishable key** (safe to expose publicly)
   3. **Auth:** reads the session from browser storage automatically
2. **createServerClient**—the standard server client:
   1. **Runs in:** Server Components and Route Handlers, on the **Node.js runtime**
   2. **Key:** publishable key **+ cookies**
   3. **Auth:** reads the session from cookies via `next/headers`
3. **createProxyClient**—the edge/middleware:
   1. **Runs in:** `proxy.ts` only (Next.js 16’s renamed
   2. **Key:** publishable key **+ request cookies**
   3. **Auth:** reads cookies directly off the incoming `Request` and outgoing `Response`
4. **createAdminClient**—the trusted superuser:
   1. **Runs in:** server-only, trusted operations
   2. **Key:** secret key — **bypasses RLS entirely**
   3. **Auth:** none per-user; it acts with full privileges

There’s an important subtlety here: the difference between these four clients isn’t really about _permissions_ — it’s about **who the client knows you are, and where it can act**.

**The key insight: publishable key ≠ identity**: All three non-admin clients use the **same publishable key**. The publishable key doesn’t grant _any_ data access on its own — it just identifies your Supabase project. What actually unlocks a user’s rows is the **session** (the logged-in identity), and that’s carried in **cookies**.

- **Browser client** — gets the session from **browser storage** (localStorage/IndexedDB), managed automatically by the Supabase SDK in the browser.
- **Server/proxy clients** — get the session from **cookies** sent with the HTTP request, because there’s no browser storage on the server.

**The browser client is not more limited than the server client in terms of what data it can read.** Both operate under the same RLS policies as the same logged-in user. If you’re signed in, your browser client can read your own notes just like the server client can.

**Where the code runs:** The browser client runs on the user’s machine. That means:

- It **cannot** hold the secret key (it would be visible in DevTools/network tab to anyone).
- It **cannot** run `Drizzle` — the document is explicit about this: “Drizzle must never execute in browser/client components” (Constraint 6, line 1206). Drizzle connects directly to Postgres as the `app_runtime` role; you can’t expose a raw database connection to a browser.
- It **cannot** do anything the architecture routes through the API layer — remember, this app is API-first: “All mutations flow through `/api/*`” (§2.1). The browser client is meant for reads and Supabase auth, not for mutations that bypass `withApiGuard()`.

**When in the request lifecycle they run**: This is what separates proxy from server:

- **Proxy client** runs in **middleware** (`proxy.ts`), _before_ the request reaches your page or route. Its job (§20.3, line 900) is **session refresh** and **redirecting unauthenticated users**. It runs on every matched request, at the edge, before rendering.
- **Server client** runs _during_ rendering (Server Components) or _inside_ a route handler. It acts on a request that has already passed through middleware.

So the proxy client can do something neither of the others can: **intercept and redirect a request before it’s handled**. The browser client can’t do that — by the time browser code runs, the page has already loaded.

### 19.2 Middleware responsibilities

The `proxy.ts` (formerly `middleware.ts`) is responsible for session refresh (via `createProxyClient`), redirecting unauthenticated users, and excluding API routes from redirect behavior.

`proxy.ts` must not contain authorization logic. It belongs in `withAPIGuard()`.

### 19.3 Mantine setup requirements

**Required imports**

```typescript
@import '@mantine/core/styles.css';
@import '@mantine/notifications/styles.css';
@import '@mantine/tiptap/styles.css';
```

**Required providers**

```tsx
<MantineProvider>
<Notifications />
```

**Post-CSS plugin**

```
postcss-preset-mantine
postcss-simple-vars
```

**Hydration fix**

Add `suppressHydrationWarning` to the `<html>` element. `ColorSchemeScript` injects a `data-mantine-color-scheme` attribute via a script tag before React hydrates — without `suppressHydrationWarning`, React will emit a hydration warning because the attribute wasn’t present during server render.

Set `defaultColorScheme="auto"` on BOTH `ColorSchemeScript` AND `MantineProvider`. A mismatch between the two causes hydration errors.

```tsx
<html suppressHydrationWarning>
  <head>
    <ColorSchemeScript defaultColorScheme="auto" />
  </head>
  <body>
    <MantineProvider defaultColorScheme="auto">{children}</MantineProvider>
  </body>
</html>
```

> [!Question] Can we exclude `ColorSchemaScript` to remove `suppressHydrationWarning`?
> What does this script does that we need it our page for? If it’s just allowing user to manually toggle between light-and-dark themes, can we ignore it and default to user’s prefered color scheme.

### 19.4 Styling through CSS Modules

All styling uses CSS modules. No exceptions. Pure Mantine style props that set visual styles inline are banned.

```tsx
// BANNED — style props
<Box h={100} px="md" fw={700} c="red" mt={8} />
```

However, Mantine behavioral props that configure component behavior along with its visual style, are an acceptable compromise.

```tsx
// ALLOWED — behavioral props
<AppShell navbar={{ width: 240, breakpoint: 'sm' }} withBorder shadow="sm" />
```

**Enforcement:**
`packages/eslint-plugin-sidekick` contains the `no-mantine-style-props` rule. It is compiled with `tsup` (not raw `tsc`) because ESLint plugins must run as CommonJS in Node.js and cannot load `.ts` files directly. This rule is registered in the root `eslint.config.js` and fails lint immediately on any violation.

### 19.5 Centralized copies

Want want consistency of copy between pages and components. If we use “login” and not “Log in”, then it should show “login” everywhere and not “login” in one page and in another either “Log in” or “Sign in”. To make this possible, all user-visible strings must live in `packages/copy` to help others discover existing copies and reuse across entire application. Never hardcode strings directly in source files.

```tsx
import { copy } from '@sidekick/copy';

// Use
<Button>{copy.auth.signIn}</Button>;
```

### 19.6 Runtime patterns

**`useNavigation` hook**: Always use `useNavigation()` instead of calling `router.push()` alone. The hook calls `router.push()` followed by `router.refresh()` together. Forgetting `router.refresh()` after auth actions leaves the UI in a stale server-rendered state.

```tsx
const { navigate } = useNavigation();
navigate('/dashboard'); // push + refresh
```

**Use `force-dynamic` on Supabase-touching route groups**: Add `export const dynamic = 'force-dynamic'` to the layout of every route group that touches Supabase (e.g. `(app)/layout.tsx`, `(auth)/layout.tsx`). Without it, Next.js may attempt to statically pre-render these layouts at build time, which fails because Supabase cookie reads are request-time operations.

### 19.7 Profile creation — Postgres trigger

User profiles are created via a Postgres trigger on `auth.users`, not via API route.

```sql
CREATE FUNCTION public.create_profile_for_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();
```

Critical: the function must use `public.profiles` (fully qualified) because triggers run in the `auth` schema context. An unqualified `profiles` reference would fail to resolve.

We chose trigger over API route because it works well for auth providers (email, OAuth, magic link) without per-provider app-level code. It also cannot fail silently after authentication succeeds because profile creation is part of same database transaction—either everything succeeds or everything fails. Plus, there won’t be any race condition between auth completion and API calls.

### 19.8 Deferred decisions

**GraphQL + Relay — Deferred to Post-MVP**: MVP will use REST API with space to evolve into GraphQL at a later phase.

Right now, I am learning a lot as it is with new backend concepts, application architecture and so on. I don’t want to add burden of configuring GraphQL at this junction and add to the cognitive load, not to mention that Relay + App Router integration is an unresolved upstream. Finally, `withApiGuard` maps cleanly to REST; adapting it to a GraphQL resolver layer requires rethinking.

Once MVP ships and when data-fetching complexity justifies it, and/or when Relay/App Router integration matures, we can revisit this decision.

**How to add:** Could replace or augment REST without full architectural rework. `withApiGuard` would need a GraphQL resolver adapter.

**API Versioning (/api/v1/) — Deferred to Post-MVP**: Current API will use `/api/` with no version prefix. Versioning API adds to the complexity with no current benefit. MVP only has one client and breaking changes can be coordinated directly.

When multiple external clients need migration time, or when breaking changes become frequent, we can revisit this decision.

**How to add:** Route group at `/api/v1/` in Next.js. No architectural rework needed — just move route handlers into the versioned group.

### 19.9 Tiptap requirements

The original architecture contained several important editor requirements including JSON storage format, Markdown export support, rich-text toolbar, mobile-friendly editing, and semantic chunk generation for embeddings.

**Important Constraint**: Embedding generation should operate on semantic markdown output rather than raw text extraction whenever possible.

### 19.10 AI / RAG requirements

The original handover included important AI pipeline details of enabling pgvector, HNSW index, semantic chunking, overlap chunk strategy, async embedding generation, retrieval-augmented generation, and streaming AI responses.

**Required database function**: This function remains part of the canonical design.

```
match_content()
```

### 19.11 CLI requirements

The CLI remains a first-class architectural citizen supporting authenticated API access, streaming chat support, automation support, and future agent interoperability.

**Canonical principle**: The CLI must use the same public API surface as external agents.

### 19.12 PWA requirements

The original handover included important PWA constraints of installable web app, manifest.json, service workers, offline asset caching and mobile compatible sheel.

**Canonical tooling**:

```
Serwist
```

### 19.13 Capacitor / iOS Strategy

The MVP native strategy remains **Capacitor + hosted Next.js application** . The architecture intentionally delays embedded offline DB, native sync engine, and fully local-first execution until post-MVP.

### 19.10 MNP implementation phases

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

### 19.11 Remaining important constraints from original handover

- Feature manifests remain the canonical feature contract.
- All features must enforce entitlement checks at API boundaries.
- Background embedding generation must never block user writes. After all retries are exhausted, `embeddingStatus` must be set to `'failed'`. Failed jobs must remain queryable and _retry-able_.
  - All syncable entities must include `deletedAt` for soft delete support. Hard deletes are prohibited on syncable tables.
- Server Components are preferred for data-fetching.
- Client Components should only exist where interactivity is required.
- Drizzle must never execute in browser/client components.
- Repository abstractions are mandatory for all mutations.

---

## 20. Repository visibility

The GitHub repository is **public**. This is intentional. The project is built in the open as a learning exercise and portfolio. Friends and collaborators can view progress without requiring explicit invitations.

### 20.1 Why is this safe?

Security in this architecture comes from correct implementation, not obscurity:

1. RLS policies enforce data isolation at the database level regardless of who reads the source code
2. `withApiGuard()` centralizes authorization — knowing the code exists doesn’t bypass it
3. API keys are hashed (SHA-256) before storage — the schema being public is irrelevant
4. `.env.local` is gitignored — real secrets never enter the repository

Making the architecture and implementation decisions public is consistent with standard open-source practice. The actual security surface is the running application, not the source code.

### 20.2 Permanent caution—never commit secrets

The following must **never** be committed to the repository under any circumstances:

- `.env.local` or any file containing real environment variable values
- Supabase service role keys
- API keys (Anthropic, OpenAI, Stripe)
- Database connection strings with credentials
- Any token, password, or private key

The `.gitignore` blocks `.env*` files (with the exception of `.env.example`). This is a technical safeguard, not a substitute for vigilance. Always verify `git status` before committing.

If a secret is ever accidentally committed:

1. Immediately rotate the exposed key/token in the relevant service dashboard
2. Remove the secret from git history using `git filter-repo` or GitHub’s secret scanning remediation tools
3. Force-push the cleaned history

Rotation is mandatory — removing from git history is not sufficient on its own because the secret may already have been cloned or cached.

## 21. Final architectural position

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
