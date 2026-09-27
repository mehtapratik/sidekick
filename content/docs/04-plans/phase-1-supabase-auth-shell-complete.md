---
id: plan.phase-1-supabase-auth-shell-complete
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - living-plan
   - phase-1
   - api-guard
   - rls
   - supabase
   - drizzle
   - postgresql
   - api
status: completed
---

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
