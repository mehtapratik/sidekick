---
title: Living Implementation Plan of Sidekick
---

# Sidekick — Implementation Plan & Work Breakdown

> Document Type: Master and Living Implementation Plan
> Context: Solo developer, hobby-to-business trajectory, AI-assisted with full code review
> Based on: [Architecture Overview](../../notes/architecture-overview.md) and the high-level PRD, [Project Sidekick — A Bird's Eye View](../../essays/01-sidekick-birds-eye-view.md)

---

## Plan ↔ PRD Traceability

Product truth lives in `docs/prd/` (the high-level PRD plus per-feature PRDs written before each feature's phase starts). This table maps PRD modules to plan phases; when a PRD changes, this table and the affected phases are revised — never the completed foundation phases.

| PRD Module | Phase(s) | Notes |
| ---------- | -------- | ----- |
| *(infrastructure)* | 0, 1, 1.1, 2, 3 | Product-agnostic: monorepo, auth, RLS, API guard, graph/metadata service |
| Taxila | 4 | Absorbs "Notes" and "Bookmarks" (bookmark = knowledge source of type `link`) |
| Zinsser | 5 (editor), post-6 (AI coach) | Editor first; coach depends on AI layer |
| Core Drive | 6 | Separate feature for now; may fold into Taxila later (see architecture §5.2) |
| Alter Ego | 6 | Grounded in Core Drive + Taxila RAG |
| War Room | 7 | Tasks / planning entity |
| Factory | 7 (push-button workflows), post-MVP (rest) | MVP scope per PRD: push-button workflows + input defaults |
| Parrot | — | Post-MVP, backlogged |

**Changelog**

- **2026-08-24** — Core Drive redesigned as a system-wide **tiered context model** (kernel / applicability-loaded / situational state) with a centralized **Context Assembler** and first-class **Effort Level** in the AI request contract (architecture §5.2). Domain knowledge assigned to Taxila; state/values boundary between Core Drive and War Room/Factory made explicit. Phase 6A/6B/7A tasks updated.
- **2026-07-27** — Realigned the entire plan to the bird's-eye-view essay (high-level PRD). Adopted module names; rejected Bookmarks/Recipes/Budget as standalone features; added graph store & metadata service, Core Drive, command-palette shell, and provider-agnostic AI router; moved dogfooding/billing to optional tail. Phases 0–2 unchanged.

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

## Phase 0 — Foundation & Tooling ✅ COMPLETE

> **Milestone:** A working monorepo that builds, lints, and runs locally. The skeleton that every future phase lives inside.
> **Learning payoff:** Turborepo, pnpm workspaces, TypeScript strict mode, project conventions.
> **Completed:** May 2026

| #    | Task                                                                                      | Complexity | Learning | Status |
| ---- | ----------------------------------------------------------------------------------------- | ---------- | -------- | ------ |
| 0.1  | Initialize pnpm monorepo with `pnpm init` and workspace config                            | 🟢         | 📦       | ✅     |
| 0.2  | Set up Turborepo with `turbo.json` — define `build`, `dev`, `lint`, `typecheck` pipelines | 🟢         | 📦       | ✅     |
| 0.3  | Create `apps/web` as a Next.js 16 App Router project with TypeScript strict               | 🟢         | 🧩 📦    | ✅     |
| 0.4  | Create `apps/cli` as a bare TypeScript package (empty for now, will be wired up later)    | 🟢         | 📦       | ✅     |
| 0.5  | Create `packages/core` — empty package with correct `package.json` and tsconfig           | 🟢         | 📦       | ✅     |
| 0.6  | Create `packages/ui` — empty package, will house shared Mantine components                | 🟢         | 📦       | ✅     |
| 0.7  | Create `packages/features-registry` — empty, will house `ALL_FEATURES` manifest           | 🟢         | 📦       | ✅     |
| 0.8  | Configure shared `tsconfig.base.json` at root; extend it in all packages                  | 🟡         | 📦       | ✅     |
| 0.9  | Add ESLint + Prettier with boundary enforcement; wire into Turborepo lint pipeline        | 🟡         | 📦       | ✅     |
| 0.10 | Add `.env.example` template and document all required environment variables (see §20.1)   | 🟢         |          | ✅     |
| 0.11 | Set up Vercel project, link repo, configure environment variables in dashboard            | 🟢         |          | ✅     |
| 0.12 | Confirm `turbo dev` starts `apps/web` correctly from the monorepo root                    | 🟢         | 📦       | ✅     |
| 0.13 | Add a root `README.md` documenting how to run, build, and add packages                    | 🟢         |          | ✅     |

**Phase 0 Exit Criteria:** ✅ All met.

- `pnpm turbo build` completes without errors or warnings
- `pnpm turbo dev` starts `apps/web` at `localhost:3000`
- `pnpm turbo lint` and `pnpm turbo typecheck` pass across all 5 packages
- Dependency boundary enforcement active — `packages/*` → `apps/*` blocked by ESLint
- Deployed to Vercel at `https://sidekick-six-bay.vercel.app`

**Implementation notes:**

- Next.js 16 was current at time of implementation (plan said 15 — updated in place)
- pnpm 11.0.8 via Corepack (plan said pnpm@8 — Corepack handles version enforcement)
- `apps/web/eslint.config.mjs` generated by scaffolder was removed — root `eslint.config.js` handles all packages
- `apps/web/pnpm-lock.yaml` generated by scaffolder was removed — root lockfile manages the workspace
- `packages/features-registry` not `packages/feature-registry` — corrected after initial scaffold
- `turbo.json` `build.env` array added to prevent stale Vercel cache when env vars change
- Repo made public intentionally — see architecture handover §21

---

## Phase 1 — Supabase & Auth Shell ✅ COMPLETE

> **Milestone:** A real login screen that works. Protected routes. A profile in the database. The security skeleton everything else hangs on.
> **Learning payoff:** Supabase auth, cookie sessions, Next.js middleware, server vs browser client separation.
> **Completed:** May 2026

| #    | Task                                                                                                      | Complexity | Learning | Status |
| ---- | --------------------------------------------------------------------------------------------------------- | ---------- | -------- | ------ |
| 1.1  | Create Supabase project; enable email/password auth                                                       | 🟢         | 🔐       | ✅     |
| 1.2  | Install Supabase client packages in `packages/core`                                                       | 🟢         | 🔐       | ✅     |
| 1.3  | Implement `createBrowserClient()` helper in `packages/core/supabase/browser.ts`                           | 🟡         | 🔐       | ✅     |
| 1.4  | Implement `createServerClient()` helper in `packages/core/supabase/server.ts`                             | 🟡         | 🔐       | ✅     |
| 1.5  | Implement admin/service-role client in `packages/core/supabase/admin.ts` — server only                    | 🔴         | 🔐       | ✅     |
| 1.6  | Write `profiles` table schema in `packages/core` using Drizzle; add `id`, `email`, `createdAt`            | 🟡         | 🗄️       | ✅     |
| 1.7  | Set up `drizzle.config.ts` in `packages/core`; configure migrations folder                                | 🟡         | 🗄️       | ✅     |
| 1.8  | Add a root `pnpm db:migrate` script that discovers and runs all package migrations in order               | 🔴         | 🗄️ 📦    | ✅     |
| 1.9  | Enable RLS on `profiles`; add the canonical user-owns-rows policy                                         | 🔴         | 🔐 🗄️    | ✅     |
| 1.10 | Implement `withRLS(userId, fn)` helper in `packages/core/db/rls.ts`                                       | 🔴         | 🔐 🗄️    | ✅     |
| 1.11 | Implement Next.js proxy in `apps/web` — session refresh, redirect unauthenticated users, exclude `/api/*` | 🔴         | 🧩 🔐    | ✅     |
| 1.12 | Build login page UI with Mantine form components                                                          | 🟢         | 🎨       | ✅     |
| 1.13 | Build sign-up page UI with email/password                                                                 | 🟢         | 🎨       | ✅     |
| 1.14 | Add Mantine provider, Notifications, and PostCSS config (see §20.4)                                       | 🟡         | 🎨       | ✅     |
| 1.15 | Implement post-login redirect to `/dashboard`                                                             | 🟢         | 🧩       | ✅     |
| 1.16 | Build a minimal dashboard shell layout (sidebar navigation placeholder, header)                           | 🟢         | 🧩 🎨    | ✅     |
| 1.17 | Implement sign-out functionality                                                                          | 🟢         | 🔐       | ✅     |
| 1.18 | Verify session persists across page reloads; verify redirect works for unauthenticated users              | 🟢         |          | ✅     |

**Phase 1 Exit Criteria:** ✅ All met.

- You can sign up, log in, and see a dashboard
- Unauthenticated access to `/dashboard` redirects to login
- RLS is enabled on `profiles`

**Implementation notes:**

- **Next.js 16 renamed middleware → proxy.** File: `middleware.ts` → `proxy.ts`. Export: `export function middleware` → `export function proxy`. The `config` export is unchanged. This affects how session refresh and route protection work at the edge.
- **Profile creation via Postgres trigger, not API route.** Trigger `on_auth_user_created` on `auth.users` calls `create_profile_for_new_user()`. The function must reference `public.profiles` (fully qualified) because triggers run in the `auth` schema context. This approach handles all auth providers (email, OAuth, magic link) without per-provider app-level code, and cannot fail silently after auth succeeds.
- **CSS modules only.** No inline styles. No Mantine style props. `packages/eslint-plugin-sidekick` with a `no-mantine-style-props` rule enforces this. Mantine behavioral props (`withBorder`, `shadow`, `navbar={{ width, breakpoint }}`) are allowed; pure style props (`h`, `px`, `fw`, `c`, `mt`, `size`, `color`, `justify`, `gap`) are banned.
- **4 Supabase clients.** A fourth client, `createProxyClient(request, response)`, was added for the Edge runtime. It reads cookies from the incoming request/response directly and never imports `next/headers` (which is Node.js-only). Used exclusively in `proxy.ts`.
- **`packages/copy` added.** Centralized string copy shared across all apps. Never hardcode user-visible strings in source files — import from `packages/copy` instead.
- **`useNavigation` hook added.** Always calls `router.push()` + `router.refresh()` together. Prevents forgetting the refresh step after auth actions that change server-rendered state.
- **`export const dynamic = 'force-dynamic'` required.** Must be set on all route groups that touch Supabase (e.g. `(app)/layout.tsx`, `(auth)/layout.tsx`). Prevents Next.js from pre-rendering server-rendered auth-dependent routes at build time.
- **`dotenv-cli` pattern for env loading.** `.env.local` lives at the repo root only. All scripts that need env vars prefix with `dotenv -e ../../.env.local --`. Node.js `--env-file` flag is blocked as a security measure by Node.js itself.
- **GraphQL + Relay deferred to post-MVP.** REST is sufficient for MVP. Relay + App Router friction is unresolved upstream. `withApiGuard` maps cleanly to REST. Can add GraphQL later without a full rewrite.
- **API versioning (/api/v1/) deferred to post-MVP.** Current routes are at `/api/`. Versioning adds URL complexity for no current benefit — MVP has one client and breaking changes can be coordinated directly.
- **`DATABASE_DIRECT_URL` (port 5432) for migrations only; `DATABASE_URL` (port 6543) for runtime.** `DATABASE_DIRECT_URL` is NOT needed in Vercel — migrations run locally, never on Vercel.
- **Supabase renamed keys in 2025.** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` replaces the old `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SECRET_KEY` replaces the old `SUPABASE_SERVICE_ROLE_KEY`.

---

## Phase 1.1 — DB-Level RLS & Soft-Delete Enforcement ✅ COMPLETE

> **Milestone:** Drizzle connects as a non-superuser role (`app_runtime`). RLS is enforced at the database level — not by convention. Soft-delete filtering, user-data isolation, and hard-delete prevention are guaranteed by the database regardless of what application code does.
> **Learning payoff:** PostgreSQL roles, RLS enforcement vs. convention, trigger functions, migration journal mechanics, connection pooling and session variable scoping.
> **Completed:** May 2026

| #      | Task                                                                                                                           | Complexity | Learning | Status |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- | ------ |
| 1.1.1  | Create `app_runtime` PostgreSQL role via Supabase SQL Editor (not in git — contains password)                                  | 🟢         | 🗄️ 🔐    | ✅     |
| 1.1.2  | Create migration `0001_app_runtime_grants.sql` — GRANT + ALTER DEFAULT PRIVILEGES                                              | 🟡         | 🗄️ 🔐    | ✅     |
| 1.1.3  | Create migration `0002_profiles_rls_policy.sql` — formalize `profiles` RLS policy in version control                           | 🟡         | 🗄️ 🔐    | ✅     |
| 1.1.4  | Create migration `0003_soft_delete_trigger_fns.sql` — shared `enforce_soft_delete()` and `block_update_on_deleted()` functions | 🟡         | 🗄️       | ✅     |
| 1.1.5  | Register all three migrations in `meta/_journal.json` with increasing `when` timestamps                                        | 🟢         | 🗄️       | ✅     |
| 1.1.6  | Run `pnpm db:migrate` — apply all three migrations                                                                             | 🟢         | 🗄️       | ✅     |
| 1.1.7  | Drop the dashboard-created `profiles` policy that predated version-controlled migrations                                       | 🟢         | 🗄️       | ✅     |
| 1.1.8  | Update `DATABASE_URL` in `.env.local` to use `app_runtime` credentials (pooler, port 6543)                                     | 🟢         | 🔐       | ✅     |
| 1.1.9  | Fix `withRLS` — wrap in `db.transaction()` so `set_config` is properly transaction-scoped                                      | 🔴         | 🗄️ 🔐    | ✅     |
| 1.1.10 | Verify: `pg_roles`, `role_table_grants`, `pg_policies` queries confirm setup; app loads after `DATABASE_URL` change            | 🟢         |          | ✅     |

**Phase 1.1 Exit Criteria:** ✅ All met.

- `app_runtime` role exists with `SELECT/INSERT/UPDATE/DELETE` on all public tables
- `DEFAULT PRIVILEGES` ensures future tables are auto-granted
- `profiles` RLS policy is in version control and enforced
- `withRLS` wraps queries in a real transaction — no session variable leakage
- Trigger functions `enforce_soft_delete()` and `block_update_on_deleted()` exist, ready to bind in Phase 3+

**Implementation notes:**

- `SET ROLE` in Supabase SQL Editor is restricted — cannot be used to test role-based access. Verify via `pg_roles`, `information_schema.role_table_grants`, and `pg_policies`. True end-to-end test is the running application.
- Migration `when` timestamps must be strictly increasing. Always base new timestamps on the previous entry.
- `db:generate` is NOT run for hand-written SQL migrations. Custom SQL goes straight to `db:migrate`.
- Two policies existed on `profiles` after migration — the original dashboard policy had a different name and was not dropped by the migration. Required a manual `DROP POLICY` afterward.
- Trigger functions defined now (not deferred to Phase 3) so feature migrations only need `CREATE TRIGGER` bindings.

---

## Phase 2 — Core Infrastructure (API Guard, Feature System)

> **Milestone:** The architectural backbone is live. `withApiGuard` is implemented and tested. The feature registry exists. You could add any feature safely from here.
> **Learning payoff:** Middleware patterns, centralized auth, feature flags, the "why" behind the architecture.

| #    | Task                                                                                                                | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 2.1  | Implement `resolveApiCaller(req)` in `packages/core/api/auth.ts` — handles both cookie sessions and Bearer API keys | 🔴         | 🔐 🧩    |
| 2.2  | Implement `withApiGuard(handler, opts)` in `packages/core/api/guard.ts` (see §10.2 canonical implementation)        | 🔴         | 🔐 🧩    |
| 2.3  | Wire `withRLS` inside `withApiGuard`                                                                                | 🔴         | 🔐 🗄️    |
| 2.4  | Add basic request logging inside `withApiGuard` (method, path, userId, latency)                                     | 🟡         | 🧩       |
| 2.5  | Add auth failure logging inside `withApiGuard`                                                                      | 🟡         | 🧩       |
| 2.6  | Define `FeatureManifest` type in `packages/features-registry`                                                       | 🟡         | 📦       |
| 2.7  | Implement `ALL_FEATURES` array in `packages/features-registry/index.ts` — start with an empty array                 | 🟡         | 📦       |
| 2.8  | Create `user_feature_entitlements` table in `packages/core` with `userId`, `featureSlug`, RLS policy                | 🔴         | 🗄️ 🔐    |
| 2.9  | Implement `getEnabledFeatures(userId)` in `packages/core` — reads from entitlements table                           | 🟡         | 🗄️       |
| 2.10 | Write a seed script to enable all features for your own user account during development                             | 🟢         | 🗄️       |
| 2.11 | Create a test API route `/api/health` using `withApiGuard` to verify the full guard chain works                     | 🟡         | 🧩 🔐    |
| 2.12 | Verify 401 is returned when unauthenticated; 403 when a feature is disabled                                         | 🟢         |          |

**Phase 2 Exit Criteria:** `withApiGuard` is implemented and the `/api/health` route correctly returns 401/403 in the right conditions. The feature system can enable/disable features per user.

---

## Phase 3 — Graph Store & Metadata Service

> **Milestone:** The cross-feature relationship and metadata layer is live (architecture §5.3). Any entity can be linked to any other entity and tagged — the "power of synergies" substrate every module builds on. This is also the proof-of-architecture vertical: schema → migration → RLS → repository → guarded API.
> **Learning payoff:** Graph modeling in relational databases, recursive CTEs, polymorphic references, designing a core service that stays feature-agnostic.

| #    | Task                                                                                                                                          | Complexity | Learning |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 3.1  | Add `entityType` registration to `FeatureManifest` in `packages/features-registry` — the registry becomes the entity-type ledger              | 🟡         | 📦       |
| 3.2  | Define `edges` schema in `packages/core` — `id`, `userId`, `fromId`, `fromType`, `toId`, `toType`, `relation`, timestamps (syncable)          | 🔴         | 🗄️       |
| 3.3  | Define `tags` and `entity_tags` schemas in `packages/core` (syncable)                                                                         | 🟡         | 🗄️       |
| 3.4  | Migration: RLS (combined user-isolation + soft-delete pattern from Phase 1.1) + trigger bindings on all three tables                          | 🔴         | 🔐 🗄️    |
| 3.5  | Implement `GraphRepository` in `packages/core` — the ONLY access path: `link()`, `unlink()`, `neighbors()`, `tag()`, `untag()`, `byTag()`     | 🔴         | 🗄️       |
| 3.6  | Implement traversal query with a recursive CTE — e.g., `related(entityId, depth)`                                                             | 🔴         | 🗄️       |
| 3.7  | API routes `/api/graph/*` and `/api/tags/*` using `withApiGuard`                                                                              | 🟡         | 🧩 🔐    |
| 3.8  | Validate `fromType`/`toType` against registered entity types at the repository boundary                                                       | 🟡         | 📦       |
| 3.9  | Manually test: create edges/tags via API, verify RLS isolation and soft-delete behavior                                                       | 🟢         |          |

**Phase 3 Exit Criteria:** Entities can be linked and tagged through guarded APIs. `GraphRepository` is the sole access path. Entity types are registered in the feature registry. All graph data is user-isolated and soft-deletable.

> [!note]
> **No graph database.** This is a graph *pattern* on plain Postgres — sufficient at MVP scale. If Sidekick grows to hundreds/thousands of users, `GraphRepository` is the swap boundary for a dedicated graph engine. See architecture §5.3.

---

## Phase 4 — Taxila v1 (Knowledge Management)

> **Milestone:** The first product module, end-to-end: atomic notes and knowledge sources you can create, enrich with metadata, link, and browse — reached through the command-palette shell. Every future module follows this pattern.
> **Learning payoff:** The complete feature loop: PRD → schema → migration → API → repository → UI. Polymorphic content design. Command-palette UX.
> **Prerequisite:** Write the Taxila PRD in `docs/prd/` before starting (new convention).

| #    | Task                                                                                                                                                                                       | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 4.1  | Write Taxila PRD in `docs/prd/` — source types, note anatomy, metadata model, MVP cut                                                                                                      | 🟡         |          |
| 4.2  | Create `packages/feature-taxila` with its own `package.json`, tsconfig, and Drizzle config                                                                                                 | 🟡         | 📦 🗄️    |
| 4.3  | Define `notes` table schema — `id` (client UUID), `userId`, `title`, `content`, `createdAt`, `updatedAt`, `deletedAt`, `embeddingStatus`                                                   | 🔴         | 🗄️       |
| 4.4  | Define `knowledge_sources` table — `sourceType: 'link' \| 'captured' \| 'markdown'`, `url`, `content`, same syncable + `embeddingStatus` columns (a bookmark is a `link` source)           | 🔴         | 🗄️       |
| 4.5  | Migration: RLS combined pattern + trigger bindings on both tables (template established in Phase 3)                                                                                        | 🔴         | 🔐 🗄️    |
| 4.6  | Register `taxila` feature + its entity types (`note`, `knowledge_source`) in `ALL_FEATURES`                                                                                                | 🟢         | 📦       |
| 4.7  | Implement `TaxilaRepository` — `list()`, `getById()`, `create()`, `update()`, `softDelete()` for both entities                                                                             | 🔴         | 🗄️       |
| 4.8  | API routes `/api/taxila/notes` and `/api/taxila/sources` (CRUD, soft-delete only) using `withApiGuard` + `taxila:read`/`taxila:write` scopes                                               | 🔴         | 🧩 🔐    |
| 4.9  | Wire metadata enrichment: tag notes/sources and link related concepts via the Phase 3 graph service                                                                                        | 🟡         | 🗄️ 🧩    |
| 4.10 | Build the **command-palette shell** — a single centered command box (Cmd+P style) for navigation and actions; replaces the placeholder sidebar dashboard as the primary surface            | 🔴         | 🧩 🎨    |
| 4.11 | Build Taxila list + detail/edit pages, reachable via the palette                                                                                                                           | 🟡         | 🧩 🎨    |
| 4.12 | "New note" / "new source" flows with client-generated UUIDs; soft-delete with confirmation                                                                                                 | 🟡         | 🧩 🎨    |
| 4.13 | Enable the `taxila` feature for your own account via seed script                                                                                                                           | 🟢         |          |
| 4.14 | Manually test the full loop via both palette-driven UI and direct API calls (curl/Postman)                                                                                                 | 🟢         |          |

**Phase 4 Exit Criteria:** Notes and knowledge sources can be created, enriched with tags/links, edited, listed, and soft-deleted through the command-palette-driven UI. The API layer enforces auth and feature entitlement. All queries filter `where(isNull(table.deletedAt))`.

**RLS template for all feature tables** (combined pattern from Phase 1.1; bind the shared trigger functions from migration `0003`):

```sql
-- RLS (combined pattern)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
CREATE POLICY "users_own_rows" ON notes FOR ALL
  USING (user_id::text = current_setting('app.current_user_id', true) AND deleted_at IS NULL)
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- Trigger bindings (functions already exist from migration 0003)
CREATE TRIGGER no_hard_delete_notes
  BEFORE DELETE ON notes FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();
CREATE TRIGGER no_update_deleted_notes
  BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();
```

---

## Phase 5 — Zinsser v1 (Writing — Editor First)

> **Milestone:** A proper writing experience with Tiptap. Taxila and Zinsser share the editor component. This is where the app starts feeling real.
> **Learning payoff:** Tiptap configuration, rich text as JSON storage, markdown export, editor extensions.
> **Prerequisite:** Write the Zinsser PRD in `docs/prd/` before starting.
> **Scope note:** This phase is the editor only. Zinsser's AI-coach layer (style profile trained on your writing, point-by-point feedback, repeated-mistake tracking) depends on the AI layer and is sequenced after Phase 6 — see Backlogged item B2.

| #    | Task                                                                                        | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------- | ---------- | -------- |
| 5.1  | Install Tiptap dependencies in `packages/ui`                                                | 🟢         | ✍️       |
| 5.2  | Build a `<RichTextEditor>` component in `packages/ui` using `@mantine/tiptap`               | 🟡         | ✍️ 🎨    |
| 5.3  | Configure extensions: Bold, Italic, Heading, BulletList, OrderedList, Code, Link, Image     | 🟡         | ✍️       |
| 5.4  | Implement JSON storage — editor outputs `editor.getJSON()` for storage                      | 🔴         | ✍️       |
| 5.5  | Implement markdown export — `editor.storage.markdown.getMarkdown()` for embedding pipeline  | 🔴         | ✍️       |
| 5.6  | Make editor mobile-friendly (touch targets, mobile toolbar)                                 | 🟡         | ✍️ 📱    |
| 5.7  | Swap plain textarea in Taxila notes editor for `<RichTextEditor>`                           | 🟢         |          |
| 5.8  | Create `packages/feature-zinsser` with its own schema                                       | 🟡         | 📦 🗄️    |
| 5.9  | Define `documents` table — similar shape to `notes` but with `type` (essay, journal, draft) | 🟡         | 🗄️       |
| 5.10 | Implement full API routes for Zinsser (same pattern as Taxila)                              | 🟡         | 🧩       |
| 5.11 | Register `zinsser` feature + `document` entity type in feature registry                     | 🟢         |          |
| 5.12 | Make Zinsser reachable via the command palette (`/writing`)                                 | 🟡         | 🧩 🎨    |

**Phase 5 Exit Criteria:** The rich text editor is shared, reusable, stores JSON, exports markdown. Taxila and Zinsser both use it.

---

## Phase 6 — Core Drive + AI Layer + Alter Ego

> **Milestone:** Sidekick gets its mind. Core Drive holds your principles, values, and mental models; your content is semantically searchable; and Alter Ego — grounded in Core Drive + Taxila — answers as the version of you who sees clearly.
> **Learning payoff:** pgvector, HNSW indexes, semantic chunking, provider-agnostic AI routing, streaming structured responses, RAG pipeline design.
> **Prerequisites:** Write the Core Drive and Alter Ego PRDs in `docs/prd/`. The Alter Ego PRD must specify the source-attribution contract (internal vs. web source classes, color coding, footnotes — architecture §5.6).

### 6A — Core Drive (context layer)

| #    | Task                                                                                                                                       | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 6A.1 | Create `packages/feature-core-drive`; define entry schema with the anatomy from architecture §5.2.2 — `category` (identity/principle/mental-model/heuristic/tool/preference), `directive` (compact injectable form), `weight`, `kernel` flag, `lastLoadedAt` | 🔴 | 📦 🗄️ |
| 6A.2 | Migration, RLS, trigger bindings, feature registry entry + entity type                                                                     | 🟡         | 🔐 🗄️    |
| 6A.3 | Apply applicability metadata via the global tag service (`#principle`, `#domain:spending`, `#situation:planning`, …)                       | 🟡         | 🗄️       |
| 6A.4 | Repository + API routes + minimal palette-reachable UI for authoring entries (full prose + directive form)                                 | 🟡         | 🧩 🎨    |
| 6A.5 | Seed Core Drive from `docs/core-drive/` content — mark universal principles as `kernel`                                                    | 🟢         |          |

> [!note]
> Core Drive is a separate feature for now and may fold into Taxila later — see architecture §5.2 for the rationale and revisit criteria. Context is loaded via the **tiered model** (§5.2.1): kernel entries injected wholesale under a hard token budget; the rest retrieved by applicability tags. **Domain knowledge belongs in Taxila** — Core Drive entries link to it through the graph service, never store it. Hard boundary: *Core Drive never stores state; War Room/Factory never store values.*

### 6B — Provider-agnostic AI foundation

| #    | Task                                                                                                                                       | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 6B.1 | Implement the static model router in `packages/core/ai` — config map of task types → provider/model via AI SDK `createProviderRegistry()`  | 🔴         | 🤖       |
| 6B.2 | Features request capabilities (`chat`, `classify`, `coach`), never concrete models — enforce via the router's public interface             | 🟡         | 🤖 📦    |
| 6B.2a | Define the AI request contract with `effortLevel` as a first-class parameter — v1: tunes retrieval depth (k); router may later resolve higher effort to more capable models | 🟡 | 🤖 |
| 6B.2b | Implement **Context Assembler v1** in `packages/core/ai` — input `(feature, taskType, effortLevel)`, output context bundle: kernel entries + top-k Tier 1 by applicability tags/similarity, within token budget. The ONLY way features obtain AI context (architecture §5.2.3) | 🔴 | 🤖 📦 |
| 6B.3 | Enable `pgvector` extension in Supabase                                                                                                    | 🟢         | 🤖       |
| 6B.4 | Add `embedding` vector column to `notes`, `knowledge_sources`, `documents`, and Core Drive entries                                         | 🟡         | 🤖 🗄️    |
| 6B.5 | Create HNSW indexes on each embedding column                                                                                               | 🔴         | 🤖 🗄️    |
| 6B.6 | Implement `generateEmbedding(text)` in `packages/core/ai/embed.ts` (default: OpenAI `text-embedding-3-small`, routed like any other model) | 🟡         | 🤖       |
| 6B.7 | Implement semantic chunking strategy — split Tiptap JSON → markdown → chunks with overlap                                                  | 🔴         | 🤖 ✍️    |
| 6B.8 | Implement async background embedding job with retry (2 retries, exponential backoff) using `waitUntil()`                                   | 🔴         | 🤖 🧩    |
| 6B.9 | Wire embedding generation into Taxila/Zinsser create/update routes — non-blocking, sets `embeddingStatus`                                  | 🔴         | 🤖 🔐    |
| 6B.10 | Implement `match_content()` PostgreSQL function for vector similarity search                                                              | 🔴         | 🤖 🗄️    |

### 6C — Alter Ego

| #    | Task                                                                                                                                       | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 6C.1 | Create `packages/feature-alter-ego` with its own schema (`chat_sessions`, `chat_messages`)                                                 | 🟡         | 📦 🗄️    |
| 6C.2 | Migration, RLS, feature registry entry                                                                                                     | 🟡         |          |
| 6C.3 | Design the **structured response contract** — segments carrying source class (internal vs. web) + footnote citations, streamed             | 🔴         | 🤖 🧩    |
| 6C.4 | Implement `POST /api/alter-ego/chat` streaming route — context via the Context Assembler, model via the router                             | 🔴         | 🤖 🧩    |
| 6C.5 | Implement RAG context retrieval — top-k relevant chunks from Taxila (+ tagged Core Drive expansions) before calling the LLM                | 🔴         | 🤖       |
| 6C.6 | Build Alter Ego chat UI — streaming display honoring the response contract (source color coding + footnotes; web retrieval may ship later, but the UI renders the contract now) | 🔴 | 🎨 🧩 |
| 6C.7 | Add `/chat` to the command palette                                                                                                         | 🟢         |          |
| 6C.8 | Implement `embeddingStatus` monitoring — a simple admin view showing failed embeddings                                                     | 🟡         | 🤖       |
| 6C.9 | Add retry trigger API endpoint for failed embeddings                                                                                       | 🟡         | 🤖       |

**Phase 6 Exit Criteria:** You can ask Alter Ego a question; the Context Assembler loads your kernel principles plus applicable Core Drive entries, RAG retrieves relevant knowledge chunks, and the answer streams as a structured, source-attributed response. `effortLevel` is honored end-to-end (contract → assembler → router). Models are resolved via the router config — switching providers is a config change. Failed embeddings are visible and retriable.

---

## Phase 7 — War Room & Factory v1

> **Milestone:** Planning and push-button execution. Tasks exist; one click on a configured button (e.g., "School+Car") creates tomorrow's pickup task without typing a word.
> **Learning payoff:** Workflow/action modeling, form-defaults configuration, composing features through the graph service.
> **Prerequisites:** War Room and Factory PRDs in `docs/prd/`.
> **Context note:** War Room and Factory own **Tier 2 situational state** (current projects, priorities, goals, calendar, daily briefs — architecture §5.2.1). Once their entities exist, wire them into the Context Assembler as structured-query sources (task 7A.5). Boundary rule: they store state, never values — values live in Core Drive.

### 7A — War Room

| #    | Task                                                                                             | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 7A.1 | Create `packages/feature-war-room`; define `tasks` (and optionally `plans`) schema — syncable    | 🟡         | 📦 🗄️    |
| 7A.2 | Migration, RLS, trigger bindings, registry entry + entity types                                  | 🟡         | 🔐 🗄️    |
| 7A.3 | Repository + guarded API routes (CRUD, soft-delete)                                              | 🟡         | 🧩 🔐    |
| 7A.4 | Palette-reachable UI: today view, task create/complete flows                                     | 🟡         | 🧩 🎨    |
| 7A.5 | Wire War Room/Factory state into the Context Assembler as Tier 2 sources (structured queries: open tasks, priorities, goals)              | 🔴         | 🤖 🧩    |

### 7B — Factory v1 (MVP scope only: push-button workflows + input defaults)

| #    | Task                                                                                                                   | Complexity | Learning |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 7B.1 | Create `packages/feature-factory`; define `workflows` schema — name, icon, action definition (typed payload), enabled  | 🔴         | 📦 🗄️    |
| 7B.2 | Migration, RLS, registry entry                                                                                         | 🟡         | 🔐 🗄️    |
| 7B.3 | Implement workflow execution through public APIs only (API-first guarantee) — e.g., "create War Room task with preset payload" | 🔴 | 🧩 🔐 |
| 7B.4 | UI: configure a push-button workflow; surface buttons in the command palette / toolbar                                 | 🟡         | 🧩 🎨    |
| 7B.5 | Implement configurable input defaults — forms open pre-filled with previously typed inputs                             | 🟡         | 🧩       |

**Phase 7 Exit Criteria:** The "School+Car" flow works end-to-end: one configured button creates a task for tomorrow. Input defaults reduce repeat typing. All execution flows through guarded public APIs. (Inbox management, IoT, webhooks, and durable workflow engines remain post-MVP — see Post-MVP section.)

---

## Phase 8 — PWA & iOS Shell

> **Milestone:** The app is installable on your iPhone. It works as a PWA in the browser and as a side-loaded Capacitor app.
> **Learning payoff:** Service workers, PWA manifest, Capacitor, mobile UX constraints.

| #    | Task                                                                     | Complexity | Learning |
| ---- | ------------------------------------------------------------------------ | ---------- | -------- |
| 8.1  | Install and configure `Serwist` for service worker support in `apps/web` | 🟡         | 📱       |
| 8.2  | Create `manifest.json` — app name, icons, display mode, theme color      | 🟢         | 📱       |
| 8.3  | Configure offline asset caching strategy in the service worker           | 🟡         | 📱       |
| 8.4  | Test PWA install flow in Chrome DevTools and on iPhone via Safari        | 🟢         | 📱       |
| 8.5  | Audit mobile UI — touch targets, viewport, safe areas, keyboard behavior | 🟡         | 📱 🎨    |
| 8.6  | Initialize Capacitor in `apps/web`                                       | 🟡         | 📱       |
| 8.7  | Configure Capacitor to point at the hosted Vercel Next.js URL            | 🟡         | 📱       |
| 8.8  | Build and side-load the iOS app onto your iPhone using Xcode             | 🟡         | 📱       |
| 8.9  | Test core flows (login, palette, Taxila, Alter Ego chat) on device       | 🟢         |          |
| 8.10 | Handle iOS safe area insets in the layout                                | 🟡         | 📱       |

**Phase 8 Exit Criteria:** App is installable as a PWA from Safari, side-loadable as an iOS app via Capacitor. Core features work on-device.

---

## Phase 9 — API Keys & CLI

> **Milestone:** You can use your own app from the terminal. API keys are manageable from the UI. The CLI is a real working tool.
> **Learning payoff:** CLI tooling (commander.js or similar), API key security patterns, Bearer auth flows, streaming in a terminal context.

| #    | Task                                                                                             | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------ | ---------- | -------- |
| 9.1  | Create `api_keys` table in `packages/core` (see §8.3 canonical schema)                           | 🟡         | 🗄️ 🔐    |
| 9.2  | Migration + RLS for `api_keys`                                                                   | 🟡         | 🗄️ 🔐    |
| 9.3  | Implement API key generation — secure random bytes → raw key returned once → SHA-256 hash stored | 🔴         | 🔐       |
| 9.4  | Wire Bearer API key lookup into `resolveApiCaller()` in `packages/core`                          | 🔴         | 🔐       |
| 9.5  | Implement `POST /api/api-keys` — create key, return raw key once                                 | 🔴         | 🔐 🧩    |
| 9.6  | Implement `GET /api/api-keys` — list keys (no raw key values, show label/scopes/last-used)       | 🟡         | 🧩       |
| 9.7  | Implement `DELETE /api/api-keys/[id]` — revoke key by setting `revokedAt`                        | 🟡         | 🧩       |
| 9.8  | Update `withApiGuard` to track `lastUsedAt` on successful API key auth                           | 🟡         | 🔐       |
| 9.9  | Build API key management UI — list keys, create key (show raw key once), revoke                  | 🟡         | 🎨       |
| 9.10 | Build `apps/cli` as a Node.js CLI tool — authenticate with API key from env/config file          | 🟡         | 🖥️       |
| 9.11 | Implement `cli taxila list` command                                                              | 🟡         | 🖥️       |
| 9.12 | Implement `cli taxila create` command (from stdin or file)                                       | 🟡         | 🖥️       |
| 9.13 | Implement `cli chat` command with streaming output to terminal                                   | 🔴         | 🖥️ 🤖    |
| 9.14 | Document CLI usage in README                                                                     | 🟢         |          |

**Phase 9 Exit Criteria:** You can generate an API key in the UI, set it as an env var, and run `cli taxila list` and `cli chat` from your terminal.

---

## Phase 10 — Observability & Hardening

> **Milestone:** The app is reliable enough for friends and family. You have visibility into what's failing. Error handling is consistent.
> **Learning payoff:** Structured logging, error boundaries, rate limiting, the operational side of running a web service.

| #    | Task                                                                                     | Complexity | Learning |
| ---- | ---------------------------------------------------------------------------------------- | ---------- | -------- |
| 10.1  | Add structured request logging to `withApiGuard` — method, path, userId, latency, status | 🟡         | 🧩       |
| 10.2  | Add auth failure logging — track 401/403 patterns                                        | 🟡         | 🔐       |
| 10.3  | Add failed embedding logging with enough context to retry                                | 🟡         | 🤖       |
| 10.4  | Add Next.js error boundaries to all main UI sections                                     | 🟡         | 🧩       |
| 10.5  | Add global API error response normalization — consistent `{ error, code }` shape         | 🟡         | 🧩       |
| 10.6  | Review and audit all API routes — confirm every route uses `withApiGuard`                | 🟢         | 🔐       |
| 10.7  | Audit all queries — confirm `where(isNull(table.deletedAt))` on syncable tables          | 🟢         | 🗄️       |
| 10.8  | Add basic rate limiting on auth routes and AI chat endpoint                              | 🟡         | 🔐       |
| 10.9  | Run a manual penetration test of your own app — try to access another user's data        | 🔴         | 🔐       |
| 10.10 | Add input validation (zod) on all API route handlers                                     | 🟡         | 🧩       |

**Phase 10 Exit Criteria:** Logs are structured and useful. All routes are guarded. No RLS gaps. Input validation is consistent across the API.

---

## Phase 11 — Dogfooding (Friends & Family Access) — Optional

> **Milestone:** You can invite others to use the app. They have their own isolated data. You have a basic way to manage who has access.
> **Learning payoff:** Multi-user ops, invite flows, feature management for different users.

| #    | Task                                                                                     | Complexity | Learning |
| ---- | ---------------------------------------------------------------------------------------- | ---------- | -------- |
| 11.1 | Build an invite flow — generate invite link that pre-approves sign-up                    | 🔴         | 🔐 🧩    |
| 11.2 | Build a simple admin page (your user only) to list users and manage feature entitlements | 🟡         | 🎨 🔐    |
| 11.3 | Add `isAdmin` flag to `profiles` table; gate admin pages behind it                       | 🟡         | 🔐       |
| 11.4 | Enable specific features for invited users from the admin panel                          | 🟡         |          |
| 11.5 | Test full sign-up and feature access flow from a fresh incognito session                 | 🟢         |          |
| 11.6 | Collect feedback from dogfood users; create a prioritized bug list                       | 🟢         |          |

**Phase 11 Exit Criteria:** You can invite someone, they can sign up, they have access only to the features you enabled for them, and their data is fully isolated from yours.

---

## Phase 12 — Billing & SaaS Readiness (Optional Path)

> [!note]
> Per the PRD, Sidekick's motivation is "purely personal and utilitarian" — monetization is not a product goal. This phase exists because of the "built for one, designed for many" principle (architecture §2.4): the entitlement plumbing stays product-ready, but this phase runs only if Sidekick pursues the product path.

> **Milestone:** The app can charge for access. Feature entitlement is tied to subscription tier. The foundation for a real business offering.
> **Learning payoff:** Stripe integration, webhook handling, subscription state management, SaaS architecture patterns.

| #    | Task                                                                                                    | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 12.1 | Create Stripe account; configure products and price tiers                                               | 🟢         | 💳       |
| 12.2 | Add `subscriptions` table — `userId`, `stripeCustomerId`, `stripePriceId`, `status`, `currentPeriodEnd` | 🟡         | 🗄️ 💳    |
| 12.3 | Implement Stripe checkout session creation in `POST /api/billing/checkout`                              | 🟡         | 💳 🧩    |
| 12.4 | Implement Stripe webhook handler — sync subscription state into `subscriptions` table                   | 🔴         | 💳 🔐    |
| 12.5 | Update `getEnabledFeatures()` to resolve features from subscription tier as well as manual entitlements | 🔴         | 💳 🗄️    |
| 12.6 | Build billing settings page — current plan, upgrade CTA, portal link                                    | 🟡         | 🎨 💳    |
| 12.7 | Implement Stripe customer portal redirect for managing subscriptions                                    | 🟡         | 💳       |
| 12.8 | Add a landing page or marketing page explaining features per tier                                       | 🟢         | 🎨       |
| 12.9 | End-to-end test: sign up → subscribe → gain feature access → cancel → lose access                       | 🟡         |          |

**Phase 12 Exit Criteria:** A new user who subscribes to a paid plan automatically gains access to paid features. A cancelled user loses access at period end.

---

## Post-MVP — Factory Extensions, Bots & Agents

> **Milestone:** Factory grows beyond push-button workflows: triggered and recurring automations, inbox management, IoT integrations. External agents interact with your data via the public API. Parrot (voice dictation) also lives here.
> **Learning payoff:** Agent interoperability, webhook-driven automation, workflow design patterns.

| #    | Task                                                                                     | Complexity | Learning |
| ---- | ---------------------------------------------------------------------------------------- | ---------- | -------- |
| PM.1 | Extend the Factory `workflows` schema with trigger types (schedule, event) beyond manual buttons | 🔴  | 🗄️       |
| PM.2 | Implement a simple recurring workflow — e.g., weekly digest of knowledge sources emailed to self | 🟡  | 🧩       |
| PM.3 | Add webhook ingest endpoint — external services can push events to the app               | 🔴         | 🔐 🧩    |
| PM.4 | Document the public API surface for agents — OpenAPI spec or equivalent                  | 🟡         | 🖥️       |
| PM.5 | Evaluate Inngest for durable workflows if complexity warrants it                         | 🟡         |          |
| PM.6 | Add agent-friendly scoped API keys for automation use cases                              | 🟡         | 🔐       |
| PM.7 | Inbox management automations (email/message triage) per the Factory PRD                  | 🔴         | 🧩       |
| PM.8 | IoT integrations (blinds, garage door) per the Factory PRD                               | 🔴         | 🧩       |
| PM.9 | **Parrot** — voice dictation with gesture support for punctuation/formatting (own PRD first) | 🔴     | 📱       |

---

## Recommended Learning Order

If you're new to some of the tech in this stack, here's the minimum viable reading before each phase:

| Before Phase | Read / Watch                                                                         |
| ------------ | ------------------------------------------------------------------------------------ |
| Phase 0      | Turborepo docs getting started; pnpm workspaces                                      |
| Phase 1      | Supabase Auth docs; Next.js App Router docs (routing, middleware, server components) |
| Phase 2      | Next.js Route Handlers; how middleware chains work                                   |
| Phase 3      | Recursive CTEs in PostgreSQL; modeling graphs in relational databases                |
| Phase 4      | Drizzle ORM quickstart; PostgreSQL RLS basics; command-palette UX patterns (cmdk)    |
| Phase 5      | Tiptap getting started; `@mantine/tiptap` docs                                       |
| Phase 6      | pgvector README; Vercel AI SDK docs (incl. provider registry); Anthropic API docs    |
| Phase 8      | Serwist docs; Capacitor iOS quickstart                                               |
| Phase 9      | Node.js CLI patterns (commander.js); API key security best practices                 |
| Phase 12     | Stripe docs: Checkout, webhooks, customer portal                                     |

---

## Architectural Invariants to Review After Every Phase

Before moving to the next phase, verify:

- [ ] Every new API route uses `withApiGuard()`
- [ ] No `packages/*` imports from `apps/*`
- [ ] Every new user-owned table has RLS enabled with the canonical combined policy (user isolation + soft-delete in one USING clause)
- [ ] Every new syncable table has `no_hard_delete_[table]` and `no_update_deleted_[table]` triggers applied
- [ ] Every new table with user content uses `withRLS()` via the guard, not inline
- [ ] All mutations go through the repository layer
- [ ] Syncable tables include `createdAt`, `updatedAt`, `deletedAt`
- [ ] Soft deletes only — no hard deletes on user data
- [ ] All queries on syncable tables filter `where(isNull(table.deletedAt))`
- [ ] Content tables in the embedding pipeline have `embeddingStatus`
- [ ] `DATABASE_URL` connects as `app_runtime` (not superuser) — verify if changing connection config

---

## Rough Effort Estimates (Solo, AI-assisted, Learning pace)

| Phase    | Estimated Sessions | Notes                                          |
| -------- | ------------------ | ---------------------------------------------- |
| Phase 0  | 2–3 sessions       | Mostly config, fast with AI help ✅            |
| Phase 1  | 3–5 sessions       | Auth has depth; worth going slow ✅            |
| Phase 2  | 2–4 sessions       | Conceptually dense; revisit often              |
| Phase 3  | 3–5 sessions       | Graph modeling + first full vertical           |
| Phase 4  | 5–7 sessions       | Highest learning payoff; includes the palette  |
| Phase 5  | 2–4 sessions       | Tiptap is well-documented                      |
| Phase 6  | 8–12 sessions      | Most technically complex; three sub-phases     |
| Phase 7  | 3–5 sessions       | Two smaller features on established patterns   |
| Phase 8  | 2–4 sessions       | Mostly config and testing                      |
| Phase 9  | 3–5 sessions       | CLI is fun; API key crypto needs care          |
| Phase 10 | 2–3 sessions       | Audit work; methodical                         |
| Phase 11 | 2–3 sessions       | Optional; satisfying milestone                 |
| Phase 12 | 4–6 sessions       | Optional; Stripe webhooks need careful testing |
| Post-MVP | Open-ended         | Exploratory; do when ready                     |

> Sessions are loosely defined as focused 2–3 hour working blocks. Estimates assume you're reviewing every line and asking questions — that's the point.

---

## Backlogged / Unplanned

These items are known, intentional gaps — deferred, not forgotten.

### B1 — Hard-Delete Erasure Job (GDPR / Account Deletion)

**What:** A scheduled or on-demand job that permanently erases user data rows after soft-delete, to satisfy GDPR right-to-erasure or account deletion requests.

**Why deferred:** No external users yet. Compliance obligation does not apply at MVP scale. Tombstones exist via soft-delete; the erasure step is not yet wired up.

**Why it cannot use conventional channels:**

- `DATABASE_URL` connects as `app_runtime` — hard deletes are blocked by the BEFORE DELETE trigger.
- `DATABASE_DIRECT_URL` is reserved for schema migrations — using it for runtime data operations conflates two distinct concerns.
- `createAdminClient().from(...).delete()` bypasses RLS but not triggers — still rejected.

**What it needs:** A dedicated pathway that opens an explicit transaction, sets `SET LOCAL app.allow_hard_delete = 'true'`, executes targeted DELETEs, and records an audit event.

**Options to evaluate when the time comes:**

- **Supabase `pg_cron`** — a scheduled SQL job running inside the database itself, no external process needed
- **Edge Function with privileged connection** — invoked on-demand via a secure internal endpoint, direct database access
- **Dedicated admin Drizzle client** in `packages/core` scoped exclusively to erasure operations, distinct from the runtime `db` instance

**When to implement:** When onboarding external users, or when a compliance review requires a documented erasure process.

### B2 — Zinsser AI Coach (after Phase 6)

**What:** The AI half of Zinsser: a style profile trained on the user's own drafts, point-by-point feedback, repeated-mistake tracking, and "release-ready" copy that sounds like the user — with the coaching goal of needing fewer corrections over time.

**Why deferred:** Depends on the AI foundation (model router, embeddings, structured responses) from Phase 6. The editor (Phase 5) delivers standalone value first.

**When to implement:** After Phase 6, once Alter Ego has proven the AI patterns. Write the Zinsser coach section of the PRD first.

### B3 — Bookmarks / Recipes / Budget (rejected as standalone features, 2026-07-27)

**What:** Three content features from the original plan, cut during the PRD realignment.

- **Bookmarks** — absorbed into Taxila: a bookmark is a knowledge source of `sourceType: 'link'`. Not coming back as a standalone feature.
- **Recipes / Budget** — candidates for future "minions" (PRD: build-vs-buy consolidation features). Revive only if a PRD is written for them.

### B4 — Parrot (voice dictation)

**What:** Voice dictation with gesture support for punctuation and formatting — accent-friendly, replacing $100+/yr subscription services.

**Why deferred:** Explicitly out of MVP scope per the PRD. Listed in the Post-MVP phase (PM.9).
