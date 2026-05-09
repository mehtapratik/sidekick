# Workspace App — Implementation Plan & Work Breakdown

> Document Type: Living Implementation Plan  
> Context: Solo developer, hobby-to-business trajectory, AI-assisted with full code review  
> Based on: Production-Grade Architecture Handover (May 2026)

---

## Reading This Document

Tasks are grouped into **phases**. Each phase is a shippable milestone — by the end of it, something real and working exists that you can use, demo, or build on top of. Phases are sequenced to minimize re-work and to teach progressively harder concepts.

**Complexity tags:**  
🟢 Beginner-friendly — follow-the-docs territory  
🟡 Intermediate — requires understanding the "why"  
🔴 Advanced — architectural weight-bearing, get it right first time  

**Learning tags:**  
📦 Monorepo / toolchain  
🔐 Auth / Security  
🗄️ Database / Drizzle  
🧩 Next.js patterns  
🎨 UI / Mantine  
✍️ Editor / Tiptap  
🤖 AI / Embeddings  
📱 Mobile / PWA  
🖥️ CLI / API  
💳 Billing / SaaS

---

## Phase 0 — Foundation & Tooling

> **Milestone:** A working monorepo that builds, lints, and runs locally. The skeleton that every future phase lives inside.  
> **Learning payoff:** Turborepo, pnpm workspaces, TypeScript strict mode, project conventions.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 0.1 | Initialize pnpm monorepo with `pnpm init` and workspace config | 🟢 | 📦 |
| 0.2 | Set up Turborepo with `turbo.json` — define `build`, `dev`, `lint`, `typecheck` pipelines | 🟢 | 📦 |
| 0.3 | Create `apps/web` as a Next.js 15 App Router project with TypeScript strict | 🟢 | 🧩 📦 |
| 0.4 | Create `apps/cli` as a bare TypeScript package (empty for now, will be wired up later) | 🟢 | 📦 |
| 0.5 | Create `packages/core` — empty package with correct `package.json` and tsconfig | 🟢 | 📦 |
| 0.6 | Create `packages/ui` — empty package, will house shared Mantine components | 🟢 | 📦 |
| 0.7 | Create `packages/features-registry` — empty, will house `ALL_FEATURES` manifest | 🟢 | 📦 |
| 0.8 | Configure shared `tsconfig.base.json` at root; extend it in all packages | 🟡 | 📦 |
| 0.9 | Add ESLint + Prettier with a shared config package; wire into Turborepo lint pipeline | 🟡 | 📦 |
| 0.10 | Add `.env.local` template and document all required environment variables (see §20.1) | 🟢 | |
| 0.11 | Set up Vercel project, link repo, configure environment variables in dashboard | 🟢 | |
| 0.12 | Confirm `turbo dev` starts `apps/web` correctly from the monorepo root | 🟢 | 📦 |
| 0.13 | Add a root `README.md` documenting how to run, build, and add packages | 🟢 | |

**Phase 0 Exit Criteria:** `pnpm turbo build` completes without errors. `pnpm turbo dev` starts the Next.js app. The package graph is correct and enforced.

---

## Phase 1 — Supabase & Auth Shell

> **Milestone:** A real login screen that works. Protected routes. A profile in the database. The security skeleton everything else hangs on.  
> **Learning payoff:** Supabase auth, cookie sessions, Next.js middleware, server vs browser client separation.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 1.1 | Create Supabase project; enable email/password auth | 🟢 | 🔐 |
| 1.2 | Install Supabase client packages in `packages/core` | 🟢 | 🔐 |
| 1.3 | Implement `createBrowserClient()` helper in `packages/core/supabase/browser.ts` | 🟡 | 🔐 |
| 1.4 | Implement `createServerClient()` helper in `packages/core/supabase/server.ts` | 🟡 | 🔐 |
| 1.5 | Implement admin/service-role client in `packages/core/supabase/admin.ts` — server only | 🔴 | 🔐 |
| 1.6 | Write `profiles` table schema in `packages/core` using Drizzle; add `id`, `email`, `createdAt` | 🟡 | 🗄️ |
| 1.7 | Set up `drizzle.config.ts` in `packages/core`; configure migrations folder | 🟡 | 🗄️ |
| 1.8 | Add a root `pnpm db:migrate` script that discovers and runs all package migrations in order | 🔴 | 🗄️ 📦 |
| 1.9 | Enable RLS on `profiles`; add the canonical user-owns-rows policy | 🔴 | 🔐 🗄️ |
| 1.10 | Implement `withRLS(userId, fn)` helper in `packages/core/db/rls.ts` | 🔴 | 🔐 🗄️ |
| 1.11 | Implement Next.js middleware in `apps/web` — session refresh, redirect unauthenticated users, exclude `/api/*` | 🔴 | 🧩 🔐 |
| 1.12 | Build login page UI with Mantine form components | 🟢 | 🎨 |
| 1.13 | Build sign-up page UI with email/password | 🟢 | 🎨 |
| 1.14 | Add Mantine provider, Notifications, and PostCSS config (see §20.4) | 🟡 | 🎨 |
| 1.15 | Implement post-login redirect to `/dashboard` | 🟢 | 🧩 |
| 1.16 | Build a minimal dashboard shell layout (sidebar navigation placeholder, header) | 🟢 | 🧩 🎨 |
| 1.17 | Implement sign-out functionality | 🟢 | 🔐 |
| 1.18 | Verify session persists across page reloads; verify redirect works for unauthenticated users | 🟢 | |

**Phase 1 Exit Criteria:** You can sign up, log in, and see a dashboard. Unauthenticated access to `/dashboard` redirects to login. RLS is enabled on `profiles`.

---

## Phase 2 — Core Infrastructure (API Guard, Feature System)

> **Milestone:** The architectural backbone is live. `withApiGuard` is implemented and tested. The feature registry exists. You could add any feature safely from here.  
> **Learning payoff:** Middleware patterns, centralized auth, feature flags, the "why" behind the architecture.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 2.1 | Implement `resolveApiCaller(req)` in `packages/core/api/auth.ts` — handles both cookie sessions and Bearer API keys | 🔴 | 🔐 🧩 |
| 2.2 | Implement `withApiGuard(handler, opts)` in `packages/core/api/guard.ts` (see §10.2 canonical implementation) | 🔴 | 🔐 🧩 |
| 2.3 | Wire `withRLS` inside `withApiGuard` | 🔴 | 🔐 🗄️ |
| 2.4 | Add basic request logging inside `withApiGuard` (method, path, userId, latency) | 🟡 | 🧩 |
| 2.5 | Add auth failure logging inside `withApiGuard` | 🟡 | 🧩 |
| 2.6 | Define `FeatureManifest` type in `packages/features-registry` | 🟡 | 📦 |
| 2.7 | Implement `ALL_FEATURES` array in `packages/features-registry/index.ts` — start with an empty array | 🟡 | 📦 |
| 2.8 | Create `user_feature_entitlements` table in `packages/core` with `userId`, `featureSlug`, RLS policy | 🔴 | 🗄️ 🔐 |
| 2.9 | Implement `getEnabledFeatures(userId)` in `packages/core` — reads from entitlements table | 🟡 | 🗄️ |
| 2.10 | Write a seed script to enable all features for your own user account during development | 🟢 | 🗄️ |
| 2.11 | Create a test API route `/api/v1/health` using `withApiGuard` to verify the full guard chain works | 🟡 | 🧩 🔐 |
| 2.12 | Verify 401 is returned when unauthenticated; 403 when a feature is disabled | 🟢 | |

**Phase 2 Exit Criteria:** `withApiGuard` is implemented and the `/api/v1/health` route correctly returns 401/403 in the right conditions. The feature system can enable/disable features per user.

---

## Phase 3 — First Feature: Notes (End-to-End Vertical)

> **Milestone:** A fully working Notes feature — create, read, update, soft-delete. This is your "proof of architecture" feature. Every future feature follows this exact same pattern.  
> **Learning payoff:** The complete feature loop: schema → migration → API → repository → UI. This is the template you'll reuse for every other feature.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 3.1 | Create `packages/feature-notes` with its own `package.json`, tsconfig, and Drizzle config | 🟡 | 📦 🗄️ |
| 3.2 | Define `notes` table schema in `packages/feature-notes/schema.ts` — include `id` (client UUID), `userId`, `title`, `content`, `createdAt`, `updatedAt`, `deletedAt`, `embeddingStatus` | 🔴 | 🗄️ |
| 3.3 | Run migration; verify table appears in Supabase dashboard | 🟢 | 🗄️ |
| 3.4 | Enable RLS on `notes`; add canonical user-owns-rows policy | 🔴 | 🔐 🗄️ |
| 3.5 | Register `notes` feature in `packages/features-registry/ALL_FEATURES` | 🟢 | 📦 |
| 3.6 | Implement `NotesRepository` in `packages/feature-notes/repository.ts` — `list()`, `getById()`, `create()`, `update()`, `softDelete()` | 🔴 | 🗄️ |
| 3.7 | Implement `GET /api/v1/notes` route using `withApiGuard` + feature guard + `notes:read` scope | 🔴 | 🧩 🔐 |
| 3.8 | Implement `POST /api/v1/notes` route — accept client-generated UUID | 🔴 | 🧩 🔐 |
| 3.9 | Implement `GET /api/v1/notes/[id]` route | 🟡 | 🧩 |
| 3.10 | Implement `PATCH /api/v1/notes/[id]` route | 🟡 | 🧩 |
| 3.11 | Implement `DELETE /api/v1/notes/[id]` route — soft delete only, set `deletedAt` | 🟡 | 🧩 🗄️ |
| 3.12 | Build Notes list page at `/notes` — server component fetching notes via repository | 🟡 | 🧩 🎨 |
| 3.13 | Build Note detail/edit page at `/notes/[id]` | 🟡 | 🧩 🎨 |
| 3.14 | Build "New Note" flow with client-generated UUID | 🟡 | 🧩 🎨 |
| 3.15 | Wire up soft-delete in the UI with confirmation | 🟢 | 🎨 |
| 3.16 | Enable the `notes` feature for your own user account via seed script | 🟢 | |
| 3.17 | Manually test the full CRUD loop via both UI and direct API calls (use curl or Postman) | 🟢 | |

**Phase 3 Exit Criteria:** Notes can be created, edited, listed, and soft-deleted through the UI. The API layer enforces auth and feature entitlement. All queries filter `where(isNull(notes.deletedAt))`.

---

## Phase 4 — Rich Text Editor (Writing Feature)

> **Milestone:** A proper writing experience with Tiptap. Notes and Writing share the editor component. This is where the app starts feeling real.  
> **Learning payoff:** Tiptap configuration, rich text as JSON storage, markdown export, editor extensions.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 4.1 | Install Tiptap dependencies in `packages/ui` | 🟢 | ✍️ |
| 4.2 | Build a `<RichTextEditor>` component in `packages/ui` using `@mantine/tiptap` | 🟡 | ✍️ 🎨 |
| 4.3 | Configure extensions: Bold, Italic, Heading, BulletList, OrderedList, Code, Link, Image | 🟡 | ✍️ |
| 4.4 | Implement JSON storage — editor outputs `editor.getJSON()` for storage | 🔴 | ✍️ |
| 4.5 | Implement markdown export — `editor.storage.markdown.getMarkdown()` for embedding pipeline | 🔴 | ✍️ |
| 4.6 | Make editor mobile-friendly (touch targets, mobile toolbar) | 🟡 | ✍️ 📱 |
| 4.7 | Swap plain textarea in Notes editor for `<RichTextEditor>` | 🟢 | |
| 4.8 | Create `packages/feature-writing` with its own schema | 🟡 | 📦 🗄️ |
| 4.9 | Define `documents` table — similar shape to `notes` but with `type` (essay, journal, draft) | 🟡 | 🗄️ |
| 4.10 | Implement full API routes for Writing feature (same pattern as Notes) | 🟡 | 🧩 |
| 4.11 | Register `writing` feature in feature registry | 🟢 | |
| 4.12 | Build Writing section in the app shell (`/writing`) | 🟡 | 🧩 🎨 |

**Phase 4 Exit Criteria:** The rich text editor is shared, reusable, stores JSON, exports markdown. Notes and Writing both use it.

---

## Phase 5 — Content Features (Bookmarks, Recipes, Budget)

> **Milestone:** The app is a multi-feature productivity tool. Three more features built using the established pattern.  
> **Learning payoff:** Repetition builds fluency. Schema design for varied content types. Simpler after Notes.

Each sub-feature follows the same pattern: schema → migration → RLS → feature registry → API routes → repository → UI pages.

### 5A — Bookmarks

| # | Task | Complexity |
|---|------|-----------|
| 5A.1 | Create `packages/feature-bookmarks`; define `bookmarks` schema (url, title, description, tags, favicon) | 🟡 |
| 5A.2 | Migration, RLS, feature registry entry | 🟡 |
| 5A.3 | API routes: list, create, update, soft-delete | 🟡 |
| 5A.4 | Implement `BookmarksRepository` | 🟡 |
| 5A.5 | UI: Bookmarks list with search/filter by tag | 🟡 |
| 5A.6 | UI: Add bookmark form (URL, auto-fetch title/description via server action) | 🟡 |

### 5B — Recipes

| # | Task | Complexity |
|---|------|-----------|
| 5B.1 | Create `packages/feature-recipes`; define `recipes` schema (title, ingredients, steps, tags, servings) | 🟡 |
| 5B.2 | Migration, RLS, feature registry entry | 🟡 |
| 5B.3 | API routes: list, create, update, soft-delete | 🟡 |
| 5B.4 | Implement `RecipesRepository` | 🟡 |
| 5B.5 | UI: Recipe list with search | 🟡 |
| 5B.6 | UI: Recipe detail with structured ingredients and steps | 🟡 |

### 5C — Budget

| # | Task | Complexity |
|---|------|-----------|
| 5C.1 | Create `packages/feature-budget`; define `transactions` schema (amount, category, date, notes) | 🟡 |
| 5C.2 | Migration, RLS, feature registry entry | 🟡 |
| 5C.3 | API routes: list (with date range filter), create, update, soft-delete | 🟡 |
| 5C.4 | Implement `BudgetRepository` | 🟡 |
| 5C.5 | UI: Transaction list with monthly grouping | 🟡 |
| 5C.6 | UI: Simple spending summary by category | 🟡 |

**Phase 5 Exit Criteria:** All three content features are live, follow the same architectural patterns, and are protected by the feature entitlement system.

---

## Phase 6 — AI Layer (Embeddings + RAG + Chat)

> **Milestone:** Your content is semantically searchable. An AI chat interface can answer questions about your notes, bookmarks, and recipes. This is where the app becomes genuinely powerful.  
> **Learning payoff:** pgvector, HNSW indexes, semantic chunking, the Vercel AI SDK, streaming responses, RAG pipeline design.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 6.1 | Enable `pgvector` extension in Supabase | 🟢 | 🤖 |
| 6.2 | Add `embedding` vector column to `notes`, `documents`, `bookmarks`, `recipes` tables | 🟡 | 🤖 🗄️ |
| 6.3 | Create HNSW indexes on each embedding column | 🔴 | 🤖 🗄️ |
| 6.4 | Implement `generateEmbedding(text)` in `packages/core/ai/embed.ts` using OpenAI `text-embedding-3-small` | 🟡 | 🤖 |
| 6.5 | Implement semantic chunking strategy — split tiptap JSON → markdown → chunks with overlap | 🔴 | 🤖 ✍️ |
| 6.6 | Implement async background embedding job with retry (2 retries, exponential backoff) using `waitUntil()` | 🔴 | 🤖 🧩 |
| 6.7 | Wire embedding generation into Notes create/update API routes — non-blocking, sets `embeddingStatus` | 🔴 | 🤖 🔐 |
| 6.8 | Implement `match_content()` PostgreSQL function for vector similarity search | 🔴 | 🤖 🗄️ |
| 6.9 | Create `packages/feature-ai-chat` with its own schema (`chat_sessions`, `chat_messages`) | 🟡 | 📦 🗄️ |
| 6.10 | Migration, RLS, feature registry entry for AI Chat | 🟡 | |
| 6.11 | Implement `POST /api/v1/ai/chat` streaming route using Vercel AI SDK + Anthropic Claude | 🔴 | 🤖 🧩 |
| 6.12 | Implement RAG context retrieval in the chat handler — retrieve top-k relevant chunks before calling LLM | 🔴 | 🤖 |
| 6.13 | Build AI Chat UI in `packages/feature-ai-chat` — streaming message display, input, loading states | 🟡 | 🎨 🧩 |
| 6.14 | Add `/chat` page to app shell | 🟢 | |
| 6.15 | Implement `embeddingStatus` monitoring — a simple admin view showing failed embeddings | 🟡 | 🤖 |
| 6.16 | Add retry trigger API endpoint for failed embeddings | 🟡 | 🤖 |

**Phase 6 Exit Criteria:** You can type a question in the chat, it retrieves relevant chunks from your notes/recipes/bookmarks, and streams a contextual answer from Claude. Failed embeddings are visible and retriable.

---

## Phase 7 — PWA & iOS Shell

> **Milestone:** The app is installable on your iPhone. It works as a PWA in the browser and as a side-loaded Capacitor app.  
> **Learning payoff:** Service workers, PWA manifest, Capacitor, mobile UX constraints.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 7.1 | Install and configure `Serwist` for service worker support in `apps/web` | 🟡 | 📱 |
| 7.2 | Create `manifest.json` — app name, icons, display mode, theme color | 🟢 | 📱 |
| 7.3 | Configure offline asset caching strategy in the service worker | 🟡 | 📱 |
| 7.4 | Test PWA install flow in Chrome DevTools and on iPhone via Safari | 🟢 | 📱 |
| 7.5 | Audit mobile UI — touch targets, viewport, safe areas, keyboard behavior | 🟡 | 📱 🎨 |
| 7.6 | Initialize Capacitor in `apps/web` | 🟡 | 📱 |
| 7.7 | Configure Capacitor to point at the hosted Vercel Next.js URL | 🟡 | 📱 |
| 7.8 | Build and side-load the iOS app onto your iPhone using Xcode | 🟡 | 📱 |
| 7.9 | Test core flows (login, notes, chat) on device | 🟢 | |
| 7.10 | Handle iOS safe area insets in the layout | 🟡 | 📱 |

**Phase 7 Exit Criteria:** App is installable as a PWA from Safari, side-loadable as an iOS app via Capacitor. Core features work on-device.

---

## Phase 8 — API Keys & CLI

> **Milestone:** You can use your own app from the terminal. API keys are manageable from the UI. The CLI is a real working tool.  
> **Learning payoff:** CLI tooling (commander.js or similar), API key security patterns, Bearer auth flows, streaming in a terminal context.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 8.1 | Create `api_keys` table in `packages/core` (see §8.3 canonical schema) | 🟡 | 🗄️ 🔐 |
| 8.2 | Migration + RLS for `api_keys` | 🟡 | 🗄️ 🔐 |
| 8.3 | Implement API key generation — secure random bytes → raw key returned once → SHA-256 hash stored | 🔴 | 🔐 |
| 8.4 | Wire Bearer API key lookup into `resolveApiCaller()` in `packages/core` | 🔴 | 🔐 |
| 8.5 | Implement `POST /api/v1/api-keys` — create key, return raw key once | 🔴 | 🔐 🧩 |
| 8.6 | Implement `GET /api/v1/api-keys` — list keys (no raw key values, show label/scopes/last-used) | 🟡 | 🧩 |
| 8.7 | Implement `DELETE /api/v1/api-keys/[id]` — revoke key by setting `revokedAt` | 🟡 | 🧩 |
| 8.8 | Update `withApiGuard` to track `lastUsedAt` on successful API key auth | 🟡 | 🔐 |
| 8.9 | Build API key management UI — list keys, create key (show raw key once), revoke | 🟡 | 🎨 |
| 8.10 | Build `apps/cli` as a Node.js CLI tool — authenticate with API key from env/config file | 🟡 | 🖥️ |
| 8.11 | Implement `cli notes list` command | 🟡 | 🖥️ |
| 8.12 | Implement `cli notes create` command (from stdin or file) | 🟡 | 🖥️ |
| 8.13 | Implement `cli chat` command with streaming output to terminal | 🔴 | 🖥️ 🤖 |
| 8.14 | Document CLI usage in README | 🟢 | |

**Phase 8 Exit Criteria:** You can generate an API key in the UI, set it as an env var, and run `cli notes list` and `cli chat` from your terminal.

---

## Phase 9 — Observability & Hardening

> **Milestone:** The app is reliable enough for friends and family. You have visibility into what's failing. Error handling is consistent.  
> **Learning payoff:** Structured logging, error boundaries, rate limiting, the operational side of running a web service.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 9.1 | Add structured request logging to `withApiGuard` — method, path, userId, latency, status | 🟡 | 🧩 |
| 9.2 | Add auth failure logging — track 401/403 patterns | 🟡 | 🔐 |
| 9.3 | Add failed embedding logging with enough context to retry | 🟡 | 🤖 |
| 9.4 | Add Next.js error boundaries to all main UI sections | 🟡 | 🧩 |
| 9.5 | Add global API error response normalization — consistent `{ error, code }` shape | 🟡 | 🧩 |
| 9.6 | Review and audit all API routes — confirm every route uses `withApiGuard` | 🟢 | 🔐 |
| 9.7 | Audit all queries — confirm `where(isNull(table.deletedAt))` on syncable tables | 🟢 | 🗄️ |
| 9.8 | Add basic rate limiting on auth routes and AI chat endpoint | 🟡 | 🔐 |
| 9.9 | Run a manual penetration test of your own app — try to access another user's data | 🔴 | 🔐 |
| 9.10 | Add input validation (zod) on all API route handlers | 🟡 | 🧩 |

**Phase 9 Exit Criteria:** Logs are structured and useful. All routes are guarded. No RLS gaps. Input validation is consistent across the API.

---

## Phase 10 — Dogfooding (Friends & Family Access)

> **Milestone:** You can invite others to use the app. They have their own isolated data. You have a basic way to manage who has access.  
> **Learning payoff:** Multi-user ops, invite flows, feature management for different users.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 10.1 | Build an invite flow — generate invite link that pre-approves sign-up | 🔴 | 🔐 🧩 |
| 10.2 | Build a simple admin page (your user only) to list users and manage feature entitlements | 🟡 | 🎨 🔐 |
| 10.3 | Add `isAdmin` flag to `profiles` table; gate admin pages behind it | 🟡 | 🔐 |
| 10.4 | Enable specific features for invited users from the admin panel | 🟡 | |
| 10.5 | Test full sign-up and feature access flow from a fresh incognito session | 🟢 | |
| 10.6 | Collect feedback from dogfood users; create a prioritized bug list | 🟢 | |

**Phase 10 Exit Criteria:** You can invite someone, they can sign up, they have access only to the features you enabled for them, and their data is fully isolated from yours.

---

## Phase 11 — Billing & SaaS Readiness (Optional Path)

> **Milestone:** The app can charge for access. Feature entitlement is tied to subscription tier. The foundation for a real business offering.  
> **Learning payoff:** Stripe integration, webhook handling, subscription state management, SaaS architecture patterns.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 11.1 | Create Stripe account; configure products and price tiers | 🟢 | 💳 |
| 11.2 | Add `subscriptions` table — `userId`, `stripeCustomerId`, `stripePriceId`, `status`, `currentPeriodEnd` | 🟡 | 🗄️ 💳 |
| 11.3 | Implement Stripe checkout session creation in `POST /api/v1/billing/checkout` | 🟡 | 💳 🧩 |
| 11.4 | Implement Stripe webhook handler — sync subscription state into `subscriptions` table | 🔴 | 💳 🔐 |
| 11.5 | Update `getEnabledFeatures()` to resolve features from subscription tier as well as manual entitlements | 🔴 | 💳 🗄️ |
| 11.6 | Build billing settings page — current plan, upgrade CTA, portal link | 🟡 | 🎨 💳 |
| 11.7 | Implement Stripe customer portal redirect for managing subscriptions | 🟡 | 💳 |
| 11.8 | Add a landing page or marketing page explaining features per tier | 🟢 | 🎨 |
| 11.9 | End-to-end test: sign up → subscribe → gain feature access → cancel → lose access | 🟡 | |

**Phase 11 Exit Criteria:** A new user who subscribes to a paid plan automatically gains access to paid features. A cancelled user loses access at period end.

---

## Phase 12 — Bots, Workflows & Agents (Future)

> **Milestone:** The app can execute automations on your behalf. External agents can interact with your data via the public API.  
> **Learning payoff:** Agent interoperability, webhook-driven automation, workflow design patterns.

| # | Task | Complexity | Learning |
|---|------|-----------|---------|
| 12.1 | Design a `workflows` schema — trigger type, actions, enabled flag | 🔴 | 🗄️ |
| 12.2 | Implement a simple recurring workflow — e.g., weekly digest of bookmarks emailed to self | 🟡 | 🧩 |
| 12.3 | Add webhook ingest endpoint — external services can push events to the app | 🔴 | 🔐 🧩 |
| 12.4 | Document the public API surface for agents — OpenAPI spec or equivalent | 🟡 | 🖥️ |
| 12.5 | Evaluate Inngest for durable workflows if complexity warrants it | 🟡 | |
| 12.6 | Add agent-friendly scoped API keys for automation use cases | 🟡 | 🔐 |

---

## Recommended Learning Order

If you're new to some of the tech in this stack, here's the minimum viable reading before each phase:

| Before Phase | Read / Watch |
|---|---|
| Phase 0 | Turborepo docs getting started; pnpm workspaces |
| Phase 1 | Supabase Auth docs; Next.js App Router docs (routing, middleware, server components) |
| Phase 2 | Next.js Route Handlers; how middleware chains work |
| Phase 3 | Drizzle ORM quickstart; PostgreSQL RLS basics |
| Phase 4 | Tiptap getting started; `@mantine/tiptap` docs |
| Phase 6 | pgvector README; Vercel AI SDK docs; Anthropic API docs |
| Phase 7 | Serwist docs; Capacitor iOS quickstart |
| Phase 8 | Node.js CLI patterns (commander.js); API key security best practices |
| Phase 11 | Stripe docs: Checkout, webhooks, customer portal |

---

## Architectural Invariants to Review After Every Phase

Before moving to the next phase, verify:

- [ ] Every new API route uses `withApiGuard()`
- [ ] No `packages/*` imports from `apps/*`
- [ ] Every new user-owned table has RLS enabled with the canonical policy
- [ ] Every new table with user content uses `withRLS()` via the guard, not inline
- [ ] All mutations go through the repository layer
- [ ] Syncable tables include `createdAt`, `updatedAt`, `deletedAt`
- [ ] Soft deletes only — no hard deletes on user data
- [ ] All queries on syncable tables filter `where(isNull(table.deletedAt))`
- [ ] Content tables in the embedding pipeline have `embeddingStatus`

---

## Rough Effort Estimates (Solo, AI-assisted, Learning pace)

| Phase | Estimated Sessions | Notes |
|---|---|---|
| Phase 0 | 2–3 sessions | Mostly config, fast with AI help |
| Phase 1 | 3–5 sessions | Auth has depth; worth going slow |
| Phase 2 | 2–4 sessions | Conceptually dense; revisit often |
| Phase 3 | 4–6 sessions | The learning payoff is highest here |
| Phase 4 | 2–4 sessions | Tiptap is well-documented |
| Phase 5 | 4–8 sessions | Repetition; gets faster each sub-feature |
| Phase 6 | 6–10 sessions | Most technically complex phase |
| Phase 7 | 2–4 sessions | Mostly config and testing |
| Phase 8 | 3–5 sessions | CLI is fun; API key crypto needs care |
| Phase 9 | 2–3 sessions | Audit work; methodical |
| Phase 10 | 2–3 sessions | Satisfying milestone |
| Phase 11 | 4–6 sessions | Stripe webhooks need careful testing |
| Phase 12 | Open-ended | Exploratory; do when ready |

> Sessions are loosely defined as focused 2–3 hour working blocks. Estimates assume you're reviewing every line and asking questions — that's the point.
