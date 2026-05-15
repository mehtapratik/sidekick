# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
pnpm dev              # start apps/web at localhost:3000
pnpm build            # full monorepo build (Turborepo)
pnpm lint             # ESLint across all packages
pnpm typecheck        # tsc --noEmit across all packages
pnpm format           # Prettier write
pnpm prettier:check   # Prettier check (CI)

# Database (run from repo root or target package)
pnpm db:generate      # generate Drizzle migration files from schema
pnpm db:migrate       # apply migrations to database

# Target a single package
pnpm --filter @sidekick/core db:generate
pnpm --filter @sidekick/core lint
```

> `db:generate` and `db:migrate` require `.env.local` at repo root. They are prefixed with `dotenv -e ../../.env.local --` inside each package's scripts. Do not use Node's `--env-file` via `NODE_OPTIONS` — it is blocked by Node.js as a security measure.

---

## Architecture

### Monorepo

```
apps/web          → Next.js 16 App Router (main product)
apps/cli          → CLI tool (uses same public API as agents)
packages/core     → Supabase clients, Drizzle db, RLS helper, withApiGuard
packages/ui       → Shared Mantine-based components
packages/features-registry  → ALL_FEATURES manifest (feature metadata)
packages/feature-*/         → Isolated feature packages (schema, repo, API)
```

**Hard dependency rule — enforced by ESLint (`eslint-plugin-boundaries`):**
```
apps/*  →  packages/features/*  →  packages/core
```
`packages/*` must never import from `apps/*`. Violations fail lint immediately.

### Supabase Client Separation

Three clients in `packages/core/src/supabase/` — never mix them:

| Client | File | Key | Used In |
|---|---|---|---|
| `createBrowserClient()` | `browser.ts` | publishable key | Client Components (`'use client'`) |
| `createServerClient()` | `server.ts` | publishable key + cookies | Server Components, Route Handlers (Node.js runtime) |
| `createProxyClient(req, res)` | `proxy.ts` | publishable key + request cookies | `proxy.ts` only (Edge runtime) |
| `createAdminClient()` | `admin.ts` | secret key (bypasses RLS) | Server-only, trusted operations |

Import via subpath: `@sidekick/core/supabase/browser`, `@sidekick/core/supabase/server`, etc.

### Row-Level Security (RLS)

Drizzle connects via `DATABASE_URL` as the postgres superuser — it bypasses Supabase auth. Before every user-data query, set the session variable that RLS policies read:

```ts
import { withRLS } from '@sidekick/core/db/rls'

await withRLS(userId, async (db) => {
  return db.select().from(profiles)
})
```

Never set `app.current_user_id` inline. Always use `withRLS`.

RLS policies on user tables use:
```sql
USING (id::text = current_setting('app.current_user_id', true))
```

### API Guard

All `/api/*` route handlers must use `withApiGuard()` (implemented in Phase 2):

```ts
export const GET = withApiGuard(
  async ({ tx, userId }) => { ... },
  { feature: 'notes', requireScope: 'notes:read' }
)
```

`withApiGuard` handles auth → feature entitlement → RLS context → scope validation → handler. Direct route handlers without it are prohibited.

### CSS Modules Convention

All styling uses CSS modules. No inline styles, no Mantine style props. Mantine behavioral props (e.g. `withBorder`, `shadow`, `navbar={{ width, breakpoint }}`) are allowed. Pure style props (`h`, `px`, `fw`, `c`, `mt`, `size`, `color`, `justify`, `gap`) are banned.

`packages/eslint-plugin-sidekick` with the `no-mantine-style-props` rule enforces this. The plugin is compiled with `tsup` (not raw `tsc`) because ESLint plugins must run as CommonJS and cannot load `.ts` files directly.

### `packages/copy` — Centralized String Copy

All user-visible strings live in `packages/copy`. Never hardcode strings in source files.

```ts
import { copy } from '@sidekick/copy'
```

This ensures consistent copy across `apps/web` and `apps/cli`, and makes copy changes a one-place operation. TypeScript `as const` makes copy type-safe.

### `useNavigation` Hook

Always use `useNavigation()` instead of `router.push()` alone. The hook calls `router.push()` + `router.refresh()` together. Forgetting `router.refresh()` after auth actions leaves the UI in stale server-rendered state.

### `force-dynamic` on Supabase-Touching Route Groups

```ts
export const dynamic = 'force-dynamic'
```

Required on the layout of every route group that touches Supabase (e.g. `(app)/layout.tsx`, `(auth)/layout.tsx`). Without it, Next.js may attempt to pre-render these layouts at build time, which fails because cookie reads are request-time operations.

### Profile Creation

User profiles are created via a PostgreSQL trigger on `auth.users` (not an API route). The trigger function must use `public.profiles` (fully qualified) because triggers run in the `auth` schema context. This handles all auth providers (email, OAuth, magic link) uniformly without app-level code per provider.

### Deferred Decisions

- **GraphQL + Relay** — deferred to post-MVP. REST is sufficient. Relay + App Router friction is unresolved. `withApiGuard` maps cleanly to REST.
- **API versioning (/api/v1/)** — deferred to post-MVP. Current routes are at `/api/`. One client, no need for versioning yet.

### Next.js Proxy (formerly Middleware)

`apps/web/src/proxy.ts` handles session refresh and redirects only. No business logic. API routes (`/api/*`) are excluded from redirect behavior — they handle their own auth via `withApiGuard`.

Next.js 16 renamed the file convention: `middleware.ts` → `proxy.ts`, and the exported function: `export function middleware` → `export function proxy`. The `config` export is unchanged.

### Offline-Ready Constraints

These apply from day one to avoid blocking future sync support:
- **Client-generated UUIDs** — clients generate IDs, never wait for the server
- **Soft deletes mandatory** — all syncable tables use `deletedAt: timestamp`. Hard deletes are prohibited on syncable tables. All queries must `where(isNull(table.deletedAt))`
- **Idempotent APIs** — same ID + same payload = same result
- **Repository layer mandatory** — UI → Repository → API → DB. Never bypass

### Embedding Pipeline

Content tables in the embedding pipeline must include:
```ts
embeddingStatus: text('embedding_status').notNull().default('pending')
// values: 'pending' | 'complete' | 'failed'
```
Failed jobs must remain queryable and retryable. Never silently drop failures.

---

## Environment Variables

`.env.local` at repo root (gitignored, never commit):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DATABASE_URL=          # port 6543, pooler — runtime queries
DATABASE_DIRECT_URL=   # port 5432, direct — Drizzle migrations only
NEXT_PUBLIC_APP_URL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Note: Supabase renamed keys in 2025. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` replaces the old `anon` key. `SUPABASE_SECRET_KEY` replaces `service_role`.

---

## Key Invariants

1. All `/api/*` routes use `withApiGuard()` — no exceptions
2. All user-data queries use `withRLS(userId, fn)` — never raw queries
3. `packages/*` never imports from `apps/*`
4. `createAdminClient()` is server-only — never in browser bundles
5. Soft deletes on all syncable entities — never hard delete
6. Repository layer is never bypassed for mutations
7. Drizzle never runs in browser/client components

---

## Adding a Feature Package

1. `packages/feature-yourname/` with `package.json` name `@sidekick/feature-yourname`
2. `tsconfig.json` extending `../../tsconfig.base.json`
3. Define schema in `schema.ts`, Drizzle config in `drizzle.config.ts`
4. Register in `packages/features-registry` (`ALL_FEATURES`)
5. API routes at `apps/web/src/app/api/yourname/` using `withApiGuard()`
