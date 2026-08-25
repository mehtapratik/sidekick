---
title: Sidekick's Architectural Overview
description: Sidekick's architectural overview — an API-first platform tuned for solo developers
created: '2026-07-09'
updated: '2026-08-24'
version: 2.1.0
tags:
  - sidekick
  - project
  - technical
  - architecture
section: notes
type: note
sourcePath: notes/architecture-overview.md
wordCount: 4800
readingMinutes: 23
author: Pratik Mehta
license: CC BY-NC 4.0
audience: Software Engineers
status: active
---

## 1. Executive summary
Sidekick will be a modular, API-first **Personal Operating System** designed with multiple types of clients in mind: a Next.js-powered web app, a Progressive Web Application (PWA), and above all, a programmable API platform for agents, automations, workflows, and CLI tooling. The product vision and its modules are defined in the high-level PRD, [Project Sidekick — A Bird's Eye View](../essays/01-sidekick-birds-eye-view.md); section 5 of this document maps that vision onto the technical architecture.

The application architecture intentionally prioritizes security through enforceable structures, maintainability for a solo developer, incremental scalability, future support for offline capabilities, and API parity across browsers, CLIs, and agents. The system is NOT designed as a hyper-scale enterprise platform from day one. Instead, it is designed to evolve safely without requiring major architectural rewrites.

---

## 2. Architectural philosophy

### 2.1 API-first platform
Sidekick will be an API-first product, exposed publicly through detailed documentation to let power users extend and customize its features. To keep things simple and avoid architectural drift, we will not build private APIs for our internal clients. Even our native clients (web app, CLI, agents, native apps, and automations) must route through the same public APIs to access features. 

This strategy provides several benefits:
1. The product’s business logic is centralized within the API layer.
2. In the future, it will be easier to integrate capabilities with third-party providers.
3. All features are inherently CLI and AI-agent compatible.
4. Authorization is centralized.

The MVP intentionally excludes API versioning to keep the scope manageable and simple, while keeping the architecture flexible enough to shift toward that goal when warranted.

### 2.2 Enforced conventions, especially security
We want to implement every possible guardrail to enforce architectural guidelines and standards through linting and testing. This strategy eliminates the cognitive load of having to remember every rule. This is prominently reflected in our security enforcement:
1. Route security and its context are centralized.
2. Feature entitlement checks are centralized.
3. API-scope checks are centralized.

### 2.3 Modular but pragmatic
Sidekick’s architecture is intentionally designed to balance complexity and simplicity in a way that works efficiently for a solo developer today, while remaining open enough to introduce necessary complexity later. For example, whether a specific feature is authorized or not, the MVP will build all features, deploy everything, and share the same runtime (i.e., features are not containerized). 

This avoids premature complexity and supports a rapid development cycle. The architecture remains open enough to support runtime feature loading, microservices, independent deployments, and offline sync engines without large-scale rewrites.

### 2.4 Built for one, designed for many
The MVP serves an audience of one, but Sidekick is intended to grow into a real product. This principle governs every design choice:
1. Never bake single-user assumptions into schemas or services. Every user-data table is keyed by `userId` under RLS — multi-tenancy is already real, not aspirational.
2. Feature entitlements, invites, and billing remain in the plan — sequenced late, but never removed.
3. Quotas, limits, and usage tracking are designed as per-user concerns from the start.
4. Prefer reversible choices: a Postgres-based graph pattern now that can become a dedicated graph database at scale; a static model router now that can become a routing gateway at scale.

---

## 3. System overview

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 700">
  <style>
    .box {
      fill: none;
      stroke: currentColor;
      stroke-width: 1;
      rx: 4px;
    }
    .text {
      fill: currentColor;
      font-family: var(--ff-mono, "Space Mono", monospace);
      font-size: var(--fs-base, 16px);
      font-weight: var(--fw-base, 400);
    }
    .arrow {
      stroke: currentColor;
      stroke-width: 1;
    }
    .arrow-head {
      fill: currentColor;
    }
  </style>

  <!-- Box 1: Clients -->
  <rect class="box" x="40" y="40" width="420" height="100" />
  <text class="text" x="60" y="75">Clients</text>
  <text class="text" x="60" y="115">Browser | PWA | CLI | Agents | iOS</text>

  <!-- Arrow 1 (Clients to API Layer) -->
  <line class="arrow" x1="250" y1="140" x2="250" y2="185" />
  <polygon class="arrow-head" points="245,185 255,185 250,195" />

  <!-- Box 2: API Layer -->
  <rect class="box" x="40" y="200" width="420" height="245" />
  <text class="text" x="60" y="235">API Layer (/api/*)</text>
  <text class="text" x="60" y="275">withApiGuard()</text>
  <text class="text" x="60" y="305">├── Auth</text>
  <text class="text" x="60" y="335">├── Feature Entitlement</text>
  <text class="text" x="60" y="365">├── RLS Context</text>
  <text class="text" x="60" y="395">├── Scope Validation</text>
  <text class="text" x="60" y="425">└── Handler Execution</text>

  <!-- Arrow 2 (API Layer to PostgreSQL) -->
  <line class="arrow" x1="250" y1="445" x2="250" y2="495" />
  <polygon class="arrow-head" points="245,495 255,495 250,505" />

  <!-- Box 3: PostgreSQL -->
  <rect class="box" x="40" y="510" width="420" height="150" />
  <text class="text" x="60" y="545">PostgreSQL (Supabase)</text>
  <text class="text" x="60" y="585">RLS Policies</text>
  <text class="text" x="60" y="615">Feature Tables</text>
  <text class="text" x="60" y="645">Vector Search</text>
</svg>

---

## 4. Monorepo structure

### 4.1 Dependency rules
* **NEVER import `apps/*` into `packages/*`**: Violating this rule introduces circular dependencies, invalid build graphs, hidden coupling, and future deployment problems. 
* `packages/features-registry` serves as the ledger of all features Sidekick will offer. It will host feature manifests, metadata, and registration information.
* `packages/core` must ALWAYS remain feature-agnostic.

> [!question]
> Should we enforce the following dependency flows?
> 1. Use folder-level depth to reflect dependency boundaries (e.g., packages `foo` and `bar` cannot depend on each other, but both can depend on `packages/globals/core`. Similarly, `apps/web` and `apps/cli` cannot reference each other).
> 2. Move features into a dedicated `packages/features/` folder.
> 3. House `features-registry` inside the `packages/` folder solely as a registry.

---

## 5. Product context — the module system

Sidekick's features are **named product modules**, defined in the high-level PRD ([Bird's Eye View](../essays/01-sidekick-birds-eye-view.md)). Module names are the canonical vocabulary everywhere: feature slugs, package names, entitlements, and plan phases all use them. Detailed per-module PRDs live in `docs/prd/` and are written before each module's implementation begins.

### 5.1 Module → package mapping

| Module | Purpose | Package | MVP |
| ------ | ------ | ------ | ------ |
| **Taxila** | Knowledge management: atomic notes + knowledge sources (live links, captured content, markdown), metadata enrichment, RAG substrate | `packages/feature-taxila` | Yes |
| **Zinsser** | Writing app + AI writing coach trained on the user's own style | `packages/feature-zinsser` | Yes (editor first; coach after AI layer) |
| **Core Drive** | The value system: principles, mental models, priorities, plans — context layer for all AI features | `packages/feature-core-drive` | Yes |
| **Alter Ego** | AI confidant grounded in Core Drive + Taxila | `packages/feature-alter-ego` | Yes |
| **War Room** | Planning and strategy (tasks, day planning) | `packages/feature-war-room` | Yes |
| **Factory** | Execution and automation. MVP scope: push-button workflows + configurable input defaults | `packages/feature-factory` | Partial |
| **Parrot** | Voice dictation with gesture support | — | No (post-MVP) |

Bookmarks are not a standalone feature: a bookmark is a Taxila *knowledge source* of type `link`. Recipes and Budget are backlogged as future "minions".

### 5.2 Core Drive & context assembly

Core Drive is not a feature that only Alter Ego talks to — it is **baked into the entire system**. How War Room plans, how Factory executes, how automations run: all of it is conditioned by Core Drive. It starts as a handful of principles but will grow into thousands of entries across categories:

| Category | Nature | Loading behavior |
| ------ | ------ | ------ |
| Identity | Who the user is, brief history | Kernel (always loaded) |
| Principles | Universal truths ("No do-overs") — apply almost everywhere | Kernel (always loaded) |
| Communication styles | How the user prefers to communicate and write | Kernel (always loaded) |
| Mental models | Situational algorithms ("never shop hungry" → spending tasks only) | By applicability metadata |
| Heuristics | Mental shortcuts for low-consequence situations | By applicability metadata |
| Tools & systems | The user's day-to-day toolchain | By applicability metadata |
| Preferences & constraints | Standing preferences and hard limits | By applicability metadata |
| Domain knowledge | Subject-matter knowledge | **Lives in Taxila**, not Core Drive — Core Drive entries link to it via the graph service |

Because Core Drive powers every AI-touched operation, it must be **context-size efficient**. That drives the design below.

#### 5.2.1 Tiered context model

Context for any AI-touched operation is assembled from three tiers:

* **Tier 0 — the kernel.** Identity, universal principles, communication style. Always injected, under a hard token budget (~1–2K tokens). The budget creates deliberate curation pressure: an entry *earns* kernel status and is demoted when it stops being universal.
* **Tier 1 — conditionally loaded Core Drive.** Mental models, heuristics, tools, preferences — retrieved primarily by **applicability metadata** (domain, situation, task type — implemented as global tags from 5.3, e.g. `#domain:spending`, `#situation:planning`), with vector similarity as a secondary net. Applicability tags are the primary key precisely because "never shop hungry" must load when the *task* is about spending, not when the prompt happens to resemble it.
* **Tier 2 — situational state.** Current projects, roles, prioritized backlog, goals, calendar, daily brief — owned by War Room and Factory. Assembled via ordinary structured repository queries (not embeddings).

**Hard boundary rule:** *Core Drive never stores state; War Room and Factory never store values.* Core Drive is timeless; Tier 2 is operational and current.

#### 5.2.2 Entry anatomy

Each Core Drive entry stores, from day one:
* `category` — drives tier rules (identity | principle | mental-model | heuristic | tool | preference | …)
* `directive` — a compact one-line imperative form used for injection ("Never restart a project from scratch; pause and resume"), alongside the full prose the user reads. This is the primary context-size lever: thousands of entries stay affordable because the *distilled* form is what gets injected.
* `weight` — priority for conflict resolution when two loaded entries clash in a situation
* `kernel` — boolean marking Tier 0 membership
* Applicability via global tags (5.3); usage tracking (e.g. `lastLoadedAt`) so dead-weight entries become visible for curation

#### 5.2.3 The Context Assembler

A single **Context Assembler** service in `packages/core/ai` (alongside the model router, 5.5) is the only way features obtain AI context. Input: a task descriptor `(feature, taskType, effortLevel)`. Output: an assembled context bundle (kernel + applicable Tier 1 entries + relevant Tier 2 state, within budget). No feature ever hand-rolls its own context gathering — the same enforced-convention philosophy as `withApiGuard`: one choke point, impossible to drift.

**Effort Level** is a first-class parameter in the AI request contract. It is a budget knob on the assembler — how many tiers are consulted, retrieval depth (k), how much situational state — and the model router responds to it too (higher effort can route to a more capable model). One parameter; two systems respond.

**MVP cut:** the schema fields above and a v1 assembler (kernel + top-k by tag/similarity) ship with the first AI feature; `effortLevel` exists in the contract from day one but initially only tunes retrieval depth. Tier 2 assembly arrives when War Room/Factory exist. The interface is the investment; the sophistication arrives later.

#### 5.2.4 Relationship to Taxila

* **Taxila** is a large, growing corpus consumed via top-k similarity retrieval.
* **Core Drive** is curated and assembled by tier — kernel entries are injected wholesale, never gambled on a vector-similarity match.
* Core Drive follows a reflective write pattern: when reality forces a deviation from a principle, the deviation becomes a data point that refines the value system.

> [!note]
> **Revisit point:** Core Drive *could* fold into Taxila later as tagged knowledge entries. It is kept physically separate for now because (a) its retrieval semantics differ (tiered assembly vs. similarity search), (b) its write pattern differs, and (c) the user should see their Core Drive as its own entity. Folding in later is a cheap data migration (entries already carry global tags); extracting it out later would be hard. Decision deferred to implementation experience.

### 5.3 Graph store & global metadata service

New possibilities emerge when features combine ("power of synergies" in the PRD). While each feature owns its data tables, **relationships between entities and global metadata live in a shared service** — built in the MVP so Taxila uses it from day one.

**This is a graph *pattern*, not a graph *database*.** At MVP scale, plain PostgreSQL tables with recursive CTEs for traversal are sufficient. All access goes through a `GraphRepository` in `packages/core` — the swap boundary if scale ever demands a dedicated graph engine.

Design constraints:
1. All feature entities use client-generated UUIDs (existing invariant) and register an **entity type** in `packages/features-registry` — the registry doubles as the entity-type ledger.
2. The `edges` table (`fromId`, `fromType`, `toId`, `toType`, `relation`, timestamps) lives in `packages/core`. Core stays feature-agnostic because it stores opaque typed IDs, never feature schemas.
3. Global `tags` and `entity_tags` tables provide metadata across all entity types.
4. Edges and tags are user data: RLS by `userId`, syncable (soft-delete + trigger) rules apply.

### 5.4 Interaction model — command palette first

The MVP UI is a single command box in the center of the page (think Cmd+P in VS Code or `/` in Notion): type the command to run or the page to open. No site layout, navigation chrome, or logo. Conventional layouts are deferred.

This makes the MVP keyboard-heavy, and undiscoverable to anyone who doesn't know what they're looking for — an accepted tradeoff for an audience of one.

### 5.5 Provider-agnostic AI layer

Sidekick's AI capabilities must not be coupled to any single LLM provider. A **static model router** in `packages/core/ai` maps task types to provider/model via configuration, built on the Vercel AI SDK's unified `LanguageModel` interface and `createProviderRegistry()`:
* Features request **capabilities** (`chat`, `classify`, `coach`) — never concrete models.
* Switching providers or models is a configuration change, not a code change.
* The router honors `effortLevel` from the AI request contract (5.2.3): higher effort may resolve to a more capable model for the same task type.

**Designed extension point:** dynamic prompt-classifying routing and gateways (Vercel AI Gateway, OpenRouter, LiteLLM, NotDiamond) compose with the AI SDK. Adopting one later replaces only the router's resolution function — features are untouched.

> [!warning]
> Embedding models are **not** hot-swappable. Vectors from different embedding models are incompatible; switching requires re-embedding all content. The `embeddingStatus` field (section 13) supports this re-embed flow.

### 5.6 Source attribution in AI responses

AI responses may blend two source classes: **internal knowledge** (RAG over Taxila/Core Drive) and **live web retrieval**. The response contract must carry per-segment source class — enabling color-coded rendering of sentences by origin — plus footnoted citations to sources.

Architectural implication: AI responses are **structured streams (segments + sources), not plain text streams**. The streaming protocol must be designed with this in mind from the first AI feature, even if web retrieval itself ships later. First consumer: Alter Ego (see its PRD in `docs/prd/` when written).

### 5.7 Evolvability — how product changes flow

Requirements will keep evolving as clarity grows. To keep both this document and the plan flexible:
1. **`docs/prd/` is product truth** — the high-level PRD plus per-feature PRDs written before each feature starts.
2. **This document describes mechanisms and invariants, not feature lists.** Module-level product changes should only ever touch section 5 (this mapping) — never the security, RLS, repository, or offline sections.
3. Changes flow one way: **PRD → section 5 mapping → living plan phases**.

---

## 6. Technology stack
| Layer | Choice |
| ------ | ------ |
| Frontend | Next.js 16 App Router |
| Language | TypeScript Strict |
| DB | Supabase PostgreSQL |
| ORM | Drizzle ORM |
| Styling | Mantine |
| Editor | Tiptap |
| AI SDK | Vercel AI SDK |
| LLM | Provider-agnostic router (default: Anthropic Claude) |
| Embeddings | OpenAI text-embedding-3-small |
| Monorepo | Turborepo + pnpm |
| Hosting | Vercel |
| Native Shell | Capacitor |

---

## 7. Security
All routes must use `withAPIGuard()`—direct route handlers are strictly prohibited. 

Every request must pass through authentication, feature entitlement checks, Row-Level Security (RLS) context setup, and API scope validation before the request is honored. Without `withAPIGuard`, routes begin to drift and security flows become inconsistent or even erroneous over time (e.g., a developer might forget to validate an API scope). 

This is in line with our philosophy of enforced conventions (section 2.2). We make secure behavior easy to implement and difficult to bypass.

---

## 8. Authentication
The web app, PWA, and iOS app will use cookie-based sessions for authentication. The CLI and agents will use bearer keys. 
API keys will support SHA-256 hashing, specific scopes, expiration dates, revocation, and last-used tracking.

### 8.1 API key schema
*(Schema details pending)*

---

## 9. Row-Level Security (RLS)

### 9.1 Canonical pattern
We will use PostgreSQL’s Row-Level Security features to ensure users can only see and operate on records (rows) they are permitted to access. By default, PostgreSQL enforces RLS for ALL *non-superuser* roles. We will use Drizzle ORM to query the database, and since Drizzle connects to PostgreSQL via a non-superuser role (`app_runtime`), RLS will be enforced for all Drizzle queries at the system level.

Sidekick will feature two types of tables with distinct RLS policies:

> [!note]
> **Syncable and non-syncable tables.** **Syncable** tables support offline content on users’ devices and sync across clients and the server when online (e.g., *bookmarks*, *notes*, *writings*). **Non-syncable** tables (e.g., *profiles*) live solely on the server for security purposes. Therefore, users must be online to authenticate/re-authenticate.

**What makes an entity “syncable” or “non-syncable”?** 
A syncable entity must carry three timestamp columns: `createdAt`, `updatedAt`, and `deletedAt`. The presence of `updatedAt` and `deletedAt` indicates that the application supports offline features. Using these timestamps, conflict resolution occurs across all clients and the server when they are online. A non-syncable entity doesn’t have these attributes because it doesn't require conflict resolution and relies on hard deletions.

Because non-syncable tables hard-delete rows, we will not include a `deletedAt` clause in their RLS policy. However, syncable entities will have a `deletedAt` guard in the `USING` clause to filter soft-deleted rows from results. Notice that we omit the `deletedAt` guard in `WITH CHECK`, as reversing a soft-deleted row is a legitimate operation.

**Difference between `ENABLE` and `FORCE` RLS:**
* **`ENABLE ROW LEVEL SECURITY`**: Turns RLS on for the table. The key exception is that the **table owner (and superusers) bypass RLS** by default. If no policies exist, the default is deny-all.
* **`FORCE ROW LEVEL SECURITY`**: **Makes RLS apply to the table owner as well**. It does not affect superusers or roles with the `BYPASSRLS` attribute. `FORCE` is only meaningful in combination with `ENABLE`.

**Difference between `USING` and `WITH CHECK`:**
The `USING` clause is a guard for existing rows (applied to rows already in the table). The `WITH CHECK` clause guards which row values are allowed to result from a write (applied to the new/proposed row data).

| Command | USING applies? | WITH CHECK applies? |
| ------ | ------ | ------ |
| `SELECT` | Yes | — |
| `INSERT` | — | Yes |
| `UPDATE` | Yes (which rows you may update) | Yes (what the row may become) |
| `DELETE` | Yes | — |
| MEANING | *filters existing rows to prevent unauthorized operations* | *validates proposed changes against policy criteria* |

> [!question]
> What happens to a user’s data when their profile is deleted? Since user content is *syncable* (soft-deleted) and the profiles table is *non-syncable* (hard-deleted), how will we manage the permanent erasure of user content to comply with GDPR requirements?

### 9.2 RLS Helper
The application MUST NEVER manually inject RLS context inline. We will always use the RLS helper: `withRLS(userId, ...)`. 

Notice the presence of the `db.transaction` wrapper here, which is a critical security measure. Without this wrapper, `set_config` with `is_local = true` will not reset once the query finishes execution. These settings would persist across the entire pooled connection, leaking the current user ID to subsequent requests.

### 9.3 Soft-delete trigger functions
The Sidekick database will define two shared functions to enforce soft-delete constraints: `enforce_soft_delete` and `block_update_on_deleted`. These functions ensure that non-superuser roles cannot hard-delete or update soft-deleted rows. All feature tables will use these shared functions to enforce soft-delete constraints.

### 9.4 Database security summary

| Constraint | Mechanism | Enforced at |
| ------ | ------ | ------ |
| User sees only their own rows | RLS `USING` clause | Database |
| Soft-deleted rows invisible to users | RLS `USING` clause | Database |
| Hard deletes blocked | `BEFORE DELETE` trigger | Database |
| Updates on deleted rows blocked | `BEFORE UPDATE` trigger | Database |
| SELECT filtering (belt) | `where(isNull(deletedAt))` in repos | Application |

Triggers fire for **all roles** including the service role and superuser. RLS is enforced because Drizzle connects as `app_runtime` (non-superuser). `createAdminClient()` bypasses RLS but not triggers.

#### 9.4.1 `createAdminClient`—a Supabase interface
The `createAdminClient()` executes queries as a superuser role, bypassing RLS entirely. Queries executed this way will return all deleted and non-active-user rows. This is intentional and reserved for setup, configuration, maintenance activities, or specific user flows like profile creation.

#### 9.4.2 Drizzle client
We must not bypass RLS for most regular user-flow queries. This is where we will use the Drizzle client to query via the non-superuser role.

| Supabase client | Drizzle client |
| ------ | ------ |
| `await admin.from('notes').select('*');` | `db.select().from(table);` |
| Executed as `SELECT * FROM notes` | `SELECT * FROM notes WHERE deleted_at IS NULL AND user_id = <userId>` |
| superuser role | `app_runtime` - non-superuser role |
| No RLS | Enforces RLS |
| Enforces triggers | Enforces Triggers |

#### 9.4.3 Funnel all reads through DB repository client
By convention, we want to ensure that all queries are executed under the right context. Therefore, every query must be routed through the DB repository layer. Never execute rogue database queries directly. Whether utilizing `createAdminClient` or Drizzle ORM, funneling queries through the repository ensures the right contextual guards are applied.

> [!question]
> How can we ensure all queries are routed through the DB repository layer?

> [!question]
> How do we ensure read queries are authenticated and authorized? Can select queries be scattered? Why not route select queries through the repository layer as well?

---

## 10. API guard
We will use the `withAPIGuard` wrapper to centralize authentication, feature entitlements, RLS, and scope validations.

### 10.1 How `withAPIGuard` will be implemented?
*(Pending implementation details)*

### 10.2 How `withAPIGuard` will be used?
*(Pending implementation details)*

---

## 11. Repository architecture

### 11.1 Query flow
All queries flow strictly from **UI -> Repository -> API -> Database**. This abstraction is intentional and future-proofs the app for when the flow evolves into UI -> Repository -> Local DB -> Sync Engine -> API -> Database. In this manner, the UI will never care how data flows.

### 11.2 Server actions
Server actions are allowed as long as they 1) pass through repositories, 2) do not bypass APIs, and 3) do not bypass authorization checks. This ensures our **API-first guarantee**.

---

## 12. Offline-ready design
While offline capabilities are excluded from the MVP, the architecture is designed to support easier implementation in the future.

### 12.1 Constraints
* **UUIDs**: Clients will generate UUIDs to prevent collision issues later.
* **Idempotent APIs**: Repeated requests with the same ID must produce the same result. This is critical for sync reliability.
* **Repository layer mandatory**: The repository layer MUST NOT be bypassed. This is the primary abstraction boundary enabling future sync support.
* **Soft deletes are mandatory**: All *syncable* entities must support soft deletes, and queries must filter soft-deleted records.
* **`updatedAt` is the source of truth**: Every syncable entity includes `createdAt`, `updatedAt`, and `deletedAt`. Conflict resolution depends upon `updatedAt`.
    * **Deleting offline**: If a row is deleted locally while offline, `deletedAt` allows the server to easily resolve whether the row was deleted by the user or simply hasn't synced yet from another client. 
    * **Hard deletes are irreversible**: Soft deletion is preferred to support offline capabilities and allow users to reverse accidental deletions safely.

---

## 13. Embedding pipeline
Embedding writes must be asynchronous, atomic, *retryable*, and observable.

### 13.1 `embeddingStatus` field
Every content table that participates in the embedding pipeline MUST include an `embeddingStatus` field. This field is the source of truth for embedding state, enabling:
1. Querying for un-embedded or failed content.
2. Manual or automated retry of failed jobs.
3. Visibility into pipeline health without log-scraping.
4. Safe re-embedding after model upgrades.

**Status transitions:**
Any content with `embeddingStatus = 'failed'` MUST be logged and retryable. Silent failures are strictly unacceptable.

### 13.2 Atomic writes
Embeddings must be written as a single atomic transaction. Never delete and then insert *outside* a transaction, as doing so temporarily makes those embeddings unavailable.

### 13.3 Retry policy
Embedding jobs must retry twice using an exponential backoff strategy, log all failures, and set `embeddingStatus = 'failed'` after retries are exhausted.

### 13.4 Observability
At minimum, the pipeline must support structured logs, failed embedding logs, and latency visibility. The MVP does not require full observability infrastructure.

---

## 14. Feature system
The MVP will support a feature system with build-time registration, treating isolated packages as features and controlling them via entitlements. Inactive (unauthorized) features are still built, which is an acceptable tradeoff for the MVP. The system is designed this way to support future evolution into runtime plugins, feature-specific deployments, and microservices without major rewrites.

---

## 15. Database migration
**Package-level migration scoping**: Every feature package owns its own `schema.ts`, `drizzle.config.js`, and migration scripts. There is NO global Drizzle config.
**Migration orchestration**: We will use a `pnpm db:migrate` command in the root monorepo to orchestrate package discovery, run migration scripts in the correct order, and fail fast on errors. 
This package-level scoping eliminates schema drift, inconsistent environments, and hidden migration dependencies.

---

## 16. Background jobs
**For the MVP**, Sidekick will use lightweight async background execution using `waitUntil()`, Vercel background execution, and retry wrappers. Later, this will evolve into Inggest, queues, cron workflows, and distributed workers without changing API contracts.

---

## 17. Observability
At minimum, the MVP will support request logging, failed job logging, API latency logging, and auth failure logging. Logging will be done inside `withAPIGuard()` for centralized visibility.

---

## 18. Developer rules
1. All API routes must use `withAPIGuard()`.
2. Never set RLS context manually. Use `withRLS()` only.
3. Never mutate data outside the API layer.
4. Never import from `apps/*` inside `packages/*`.
5. The repository layer must not be bypassed.
6. All syncable APIs should be idempotent.
7. Never hard-delete syncable entities; all queries against syncable tables must filter `where(isNull(table.deletedAt))`.
8. All content tables participating in the embedding pipeline MUST include an `embeddingStatus` field. Set it to `'failed'` after retries are exhausted. Never silently drop failed embedding jobs.
9. Never use `createAdminClient().from(...).delete()` to hard-delete rows from syncable tables. The `BEFORE DELETE` trigger rejects this. Hard-deletes that must bypass the trigger (e.g., GDPR erasure) require a dedicated Drizzle transaction using `SET LOCAL` to bypass constraints safely.

---

## 19. Operational details

### 19.1 Types of Supabase clients
| Client | File | Key | Used In |
| ------ | ------ | ------ | ------ |
| `createBrowserClient()` | `browser.ts` | publishable key | Client Components (`'use client'`) |
| `createServerClient()` | `server.ts` | publishable key + cookies | Server Components, Route Handlers (Node.js runtime) |
| `createProxyClient(req, res)` | `proxy.ts` | publishable key + request cookies | `proxy.ts` only (Edge runtime) |
| `createAdminClient()` | `admin.ts` | secret key (bypasses RLS) | Server-only, trusted operations |

**The key insight: publishable key ≠ identity**. All non-admin clients use the same publishable key, which doesn't grant data access on its own. Access is unlocked by the logged-in identity carried in the session cookies. 
* **Browser client**: Runs in the user's browser. It cannot hold the secret key, cannot run Drizzle, and cannot perform mutations that bypass the API layer. It is meant strictly for reads and auth.
* **Server client**: Runs on the server during rendering or inside a route handler. 
* **Proxy client**: Runs at the edge in middleware (`proxy.ts`). Its job is session refresh and redirecting unauthenticated users before the request reaches the route.

### 19.2 Middleware responsibilities
`proxy.ts` is responsible for session refresh, redirecting unauthenticated users, and excluding API routes from redirect behavior. It must not contain authorization logic, which strictly belongs in `withAPIGuard()`.

### 19.3 Mantine setup requirements
To prevent hydration errors with Mantine's theme injection, we must add `suppressHydrationWarning` to the `<html>` element. `defaultColorScheme="auto"` must be set on both `ColorSchemeScript` and `MantineProvider`. 

> [!question]
> Can we exclude `ColorSchemaScript` to remove `suppressHydrationWarning` if we just default to the user's preferred color scheme?

### 19.4 Styling through CSS Modules
All styling uses CSS modules without exception. Pure Mantine style props that set visual styles inline are banned and enforced via the `no-mantine-style-props` ESLint rule. Behavioral props are an acceptable compromise.

### 19.5 Centralized copy
To ensure consistency across the application, all user-visible strings must live in `packages/copy`. Never hardcode strings directly in source files.

### 19.6 Runtime patterns
* **`useNavigation` hook**: Always use `useNavigation()` instead of calling `router.push()` alone to ensure `router.refresh()` is called, preventing stale server-rendered UI.
* **Force-dynamic**: Add `export const dynamic = 'force-dynamic'` to the layout of every route group that touches Supabase cookies to prevent static pre-rendering failures.

### 19.7 Profile creation — Postgres trigger
User profiles are created via a Postgres trigger on `auth.users`, not via an API route. This ensures reliability across auth providers and prevents race conditions, as profile creation becomes part of the same database transaction.

### 19.8 Deferred decisions
* **GraphQL + Relay — Deferred to Post-MVP**: The MVP will use a REST API. Right now, I am learning a lot as it is with new backend concepts and application architecture. I don’t want to add the burden of configuring GraphQL at this juncture and increase my cognitive load. Additionally, `withApiGuard` maps cleanly to REST.
* **API Versioning (`/api/v1/`) — Deferred to Post-MVP**: Adding versioning right now adds complexity with no current benefit, as the MVP only has one client and breaking changes can be coordinated directly.

### 19.9 Tiptap requirements
Embedding generation should operate on semantic markdown output rather than raw text extraction whenever possible.

### 19.10 AI / RAG requirements
The pipeline requires pgvector, HNSW indexing, semantic chunking, async embedding generation, and streaming AI responses.

### 19.11 CLI requirements
The CLI is a first-class architectural citizen. It must use the same public API surface as external agents.

### 19.12 PWA requirements
The architecture requires an installable web app, manifest, service workers, and an offline mobile-compatible shell.

### 19.13 Capacitor / iOS Strategy
The MVP native strategy remains **Capacitor + hosted Next.js application**. The architecture intentionally delays embedded offline databases and native sync engines until post-MVP.

### 19.14 MVP implementation phases
1. Monorepo foundation ✅
2. Auth + security shell (incl. DB-level RLS enforcement) ✅
3. Core infrastructure — `withApiGuard` + feature system
4. Graph store & metadata service
5. Taxila v1 (+ command-palette shell)
6. Zinsser v1 (editor)
7. Core Drive + AI layer + Alter Ego
8. War Room + Factory v1 (push-button workflows)
9. PWA & native shell
10. API keys & CLI
11. Observability & hardening
12. Dogfooding, then billing (optional — not a product goal per PRD)

See the [living plan](../plans/00-living-plan/living-plan.md) for the authoritative task breakdown.

### 19.15 Remaining constraints from original handover
* Feature manifests remain the canonical feature contract.
* Background embedding generation must never block user writes.
* Server Components are preferred for data-fetching.
* Client Components should only exist where interactivity is required.
* Drizzle must never execute in browser/client components.

---

## 20. Repository visibility
The GitHub repository is **public**. This is intentional, as the project is built in the open as a learning exercise and portfolio. 

### 20.1 Why is this safe?
Security in this architecture comes from correct implementation, not obscurity. RLS policies enforce isolation, `withApiGuard()` centralizes authorization, API keys are hashed, and `.env.local` is gitignored.

### 20.2 Permanent caution—never commit secrets
We must **never** commit `.env.local`, Supabase service keys, API keys, or database credentials. If a secret is ever accidentally committed, it must be immediately rotated in the service dashboard—removing it from git history is insufficient.

---

## 21. Final architectural position
This architecture intentionally optimizes for:
* Maintainability
* Correctness
* Solo-developer velocity
* Future extensibility

While explicitly avoiding:
* Premature microservices
* Premature offline complexity
* Runtime plugin overengineering
* Unnecessary infrastructure

The system is designed to evolve safely over time without foundational rewrites.
