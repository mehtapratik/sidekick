# Phase 1 — Supabase & Auth Shell: Implementation Plan

> **Context:** Phase 0 delivered a working monorepo skeleton (pnpm, Turborepo, TypeScript strict mode, ESLint with boundary enforcement). All packages contain placeholder exports only. Phase 1 wires in real authentication, a database schema, and a minimal UI shell — the security and data foundation that every subsequent phase builds on top of.
>
> **Archival copy:** Save this document to `docs/plans/phase-1-supabase-and-auth-shell/` after plan mode exits.

---

## What Phase 1 Delivers

By the end of this phase you can:
- Sign up with email + password
- Log in and land on `/dashboard`
- Log out
- Be redirected to `/login` when accessing `/dashboard` unauthenticated
- Have your user stored in a `profiles` table in Postgres with RLS enforced

---

## Architectural Constraints (from architecture-handover.md)

These must not be violated:
1. `packages/*` must **never** import from `apps/*` (ESLint boundary rule)
2. All database queries that touch user data must go through `withRLS(userId, fn)` — never raw queries against user tables
3. Three Supabase clients, strictly separated: browser, server, admin — never mix them
4. Middleware handles session refresh + redirects **only** — no business logic
5. The admin client (`service_role`) is **server-only** — never expose it to the browser bundle

---

## Critical File Paths

| Role | Path |
|------|------|
| Supabase browser client | `packages/core/src/supabase/browser.ts` |
| Supabase server client | `packages/core/src/supabase/server.ts` |
| Supabase admin client | `packages/core/src/supabase/admin.ts` |
| Core package barrel | `packages/core/src/index.ts` |
| Core package.json | `packages/core/package.json` |
| DB schema | `packages/core/src/db/schema/profiles.ts` |
| DB index | `packages/core/src/db/schema/index.ts` |
| RLS helper | `packages/core/src/db/rls.ts` |
| DB connection | `packages/core/src/db/index.ts` |
| Drizzle config | `packages/core/drizzle.config.ts` |
| Next.js middleware | `apps/web/src/middleware.ts` |
| Root layout | `apps/web/src/app/layout.tsx` |
| Login page | `apps/web/src/app/(auth)/login/page.tsx` |
| Sign-up page | `apps/web/src/app/(auth)/signup/page.tsx` |
| Auth layout | `apps/web/src/app/(auth)/layout.tsx` |
| Dashboard page | `apps/web/src/app/(app)/dashboard/page.tsx` |
| App layout | `apps/web/src/app/(app)/layout.tsx` |
| Root .env.local | `.env.local` (gitignored, not committed) |

---

## Task Breakdown

### Task 1.1 — Create Supabase project (manual, no code)

**Steps:**
1. Go to supabase.com → New Project → name: `sidekick`
2. Set a strong DB password (save it — needed for `DATABASE_URL`)
3. Authentication → Providers → confirm Email is enabled
4. Project Settings → API → collect:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon public` key
   - `SUPABASE_SERVICE_ROLE_KEY` = `service_role` key
5. Project Settings → Database → Connection string → URI → collect `DATABASE_URL` (replace `[YOUR-PASSWORD]`)

**Create `.env.local` at repo root:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ `.env.local` is already gitignored by Next.js. Never commit it.

---

### Task 1.2 — Install Supabase client packages in `packages/core`

**Why `@supabase/ssr` and not `@supabase/auth-helpers-nextjs`:**
`@supabase/ssr` is the current official package for server-rendered apps (Next.js App Router). The older helpers package is deprecated.

**Run from repo root:**
```bash
pnpm add --filter @sidekick/core @supabase/ssr @supabase/supabase-js
```

Also install Drizzle dependencies (needed for tasks 1.6–1.8):
```bash
pnpm add --filter @sidekick/core drizzle-orm postgres
pnpm add --filter @sidekick/core -D drizzle-kit
```

> `--filter @sidekick/core` targets the package by its name in `package.json`, not its folder name.

---

### Task 1.3 — `createBrowserClient()` in `packages/core/src/supabase/browser.ts`

**Why a browser client exists:** Runs in the browser only. Uses the `anon` key. Cannot read server-side cookies — it manages its own in-memory state that is synced to localStorage.

```typescript
// packages/core/src/supabase/browser.ts
import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'

export function createBrowserClient() {
  return _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

> The `!` non-null assertion is safe here because these values are build-time constants — they are baked in by Next.js at build time and will always be present when this code runs.

---

### Task 1.4 — `createServerClient()` in `packages/core/src/supabase/server.ts`

**Why a separate server client exists:** Server Components and Route Handlers run on the server where there is no browser context (no `document`, no `localStorage`). Auth state lives in HTTP cookies. This client reads and writes those cookies.

**Why `cookies()` from `next/headers`:** Next.js App Router provides a `cookies()` utility for accessing the request's cookie jar from server code. The `@supabase/ssr` server client needs callbacks to read and write cookies — this is how session tokens are persisted across requests.

```typescript
// packages/core/src/supabase/server.ts
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot set cookies — middleware handles the refresh
          }
        },
      },
    }
  )
}
```

> The `try/catch` in `setAll` is intentional — Server Components (not Route Handlers) can't write cookies. The middleware (task 1.11) handles the actual refresh. The `try/catch` silences the expected error in that context.

**Important:** This file imports `next/headers` which is a Next.js-specific module. This means `packages/core` will depend on Next.js. That's acceptable here because `packages/core` is exclusively used by `apps/web`. If you ever need a truly framework-agnostic package, create a separate package.

Add `next` as a peer dependency in `packages/core/package.json`:
```json
"peerDependencies": {
  "next": ">=16"
}
```

---

### Task 1.5 — Admin client in `packages/core/src/supabase/admin.ts`

**Why the admin client exists:** The `service_role` key bypasses RLS entirely. It's used for server-side operations that need elevated access (e.g., creating the `profiles` row after signup, where RLS hasn't yet been applied to the new user). This client **must never be imported by any browser-side code**.

```typescript
// packages/core/src/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

// This client uses the service_role key which bypasses RLS.
// It is server-only — never import this in a browser context.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

> `autoRefreshToken: false` and `persistSession: false` because this is a short-lived server-side client — not a session-based user client.

---

### Task 1.6 — `profiles` schema with Drizzle

**Why Drizzle over Prisma:** Drizzle is SQL-first — you write TypeScript that maps directly to SQL. There's no magic schema sync or shadow database. The SQL you write is the SQL that runs. It's also significantly lighter weight, which matters for a monorepo with many feature packages each having their own schema.

Create the file structure:
```
packages/core/src/db/
├── schema/
│   ├── profiles.ts    ← define the profiles table
│   └── index.ts       ← re-export all schemas
├── index.ts           ← create and export db connection
└── rls.ts             ← withRLS helper (task 1.10)
```

**`packages/core/src/db/schema/profiles.ts`:**
```typescript
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),          // matches auth.users.id from Supabase
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
```

> `id` is a UUID that matches `auth.users.id` — Supabase creates the auth user first, then we create the matching profile row with the same ID. This is the standard pattern.

**`packages/core/src/db/schema/index.ts`:**
```typescript
export * from './profiles'
```

---

### Task 1.7 — Drizzle config in `packages/core/drizzle.config.ts`

```typescript
// packages/core/drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

**Add a `db:generate` script to `packages/core/package.json`:**
```json
"scripts": {
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate"
}
```

> `db:generate` creates SQL migration files from your schema. `db:migrate` applies them to the database. You always run generate first, review the SQL, then migrate.

**`packages/core/src/db/index.ts`** (the database connection):
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

const client = postgres(process.env.DATABASE_URL!)

export const db = drizzle(client, { schema })
```

---

### Task 1.8 — Root `db:migrate` script

Add to root `package.json` scripts:
```json
"db:migrate": "turbo run db:migrate"
```

And add `db:migrate` task to `turbo.json`:
```json
"db:migrate": {
  "cache": false
}
```

> `cache: false` because migrations are side effects — the result is a database state change, not an output file. Turborepo should never skip them.

**Running migrations:**
```bash
# From repo root, generates SQL from schema:
pnpm --filter @sidekick/core db:generate

# Review the generated SQL in packages/core/src/db/migrations/
# Then apply:
pnpm --filter @sidekick/core db:migrate
```

---

### Task 1.9 — Enable RLS on `profiles` + canonical policy

This is done via SQL in the Supabase dashboard (SQL Editor). After running the Drizzle migration to create the `profiles` table:

```sql
-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Canonical user-owns-rows policy:
-- Users can only SELECT, INSERT, UPDATE their own row
CREATE POLICY "Users can manage their own profile"
  ON profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

**What RLS does:** Without this, any authenticated user could query `SELECT * FROM profiles` and see every user's data. With RLS enabled and this policy, Postgres automatically appends a `WHERE id = auth.uid()` filter to every query — at the database level, regardless of what the application sends.

**Why this still isn't enough by itself:** When using the service-role client or Drizzle with the `DATABASE_URL` connection (which bypasses Supabase auth), RLS doesn't kick in automatically. That's what `withRLS` (task 1.10) solves.

---

### Task 1.10 — `withRLS(userId, fn)` in `packages/core/src/db/rls.ts`

**The problem:** Drizzle connects to Postgres via `DATABASE_URL` as the `postgres` superuser — it bypasses Supabase's auth layer entirely. RLS policies use `auth.uid()`, which is a Supabase function that reads the current session. When Drizzle runs a query, there's no Supabase session — `auth.uid()` returns null and RLS blocks everything.

**The solution:** Before running any query, set a Postgres session variable `app.current_user_id` that your RLS policies read instead of `auth.uid()`.

```typescript
// packages/core/src/db/rls.ts
import { db } from './index'
import { sql } from 'drizzle-orm'

export async function withRLS<T>(
  userId: string,
  fn: (db: typeof import('./index').db) => Promise<T>
): Promise<T> {
  // Set the session variable that RLS policies will read
  await db.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`)
  return fn(db)
}
```

**Update the RLS policy** to use this session variable (update the SQL from task 1.9):
```sql
-- Drop the previous policy
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;

-- New policy using session variable instead of auth.uid()
CREATE POLICY "Users can manage their own profile"
  ON profiles
  FOR ALL
  USING (id::text = current_setting('app.current_user_id', true))
  WITH CHECK (id::text = current_setting('app.current_user_id', true));
```

> `true` as the second argument to `current_setting` means "return null if not set" rather than throwing an error — this prevents crashes on unauthenticated queries.

---

### Task 1.11 — Next.js middleware in `apps/web/src/middleware.ts`

**What middleware does (and doesn't do):**
- ✅ Refreshes the Supabase session (rotates tokens before they expire)
- ✅ Redirects unauthenticated users from protected routes to `/login`
- ✅ Redirects authenticated users away from `/login` and `/signup` to `/dashboard`
- ❌ Does NOT run business authorization logic — that belongs in `withApiGuard()` (Phase 2)

```typescript
// apps/web/src/middleware.ts
import { createServerClient } from '@sidekick/core/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isApiRoute = pathname.startsWith('/api')

  // Don't redirect API routes — they handle their own auth
  if (isApiRoute) return supabaseResponse

  // Redirect unauthenticated users to login
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run middleware on all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

**Package exports setup — required for subpath imports:**

For `@sidekick/core/supabase/browser` style imports to work, `packages/core/package.json` needs an `exports` field that maps subpaths. Without this, TypeScript and the bundler won't know where to find these modules.

Add to `packages/core/package.json`:
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./supabase/browser": "./src/supabase/browser.ts",
    "./supabase/server": "./src/supabase/server.ts",
    "./supabase/admin": "./src/supabase/admin.ts",
    "./db": "./src/db/index.ts",
    "./db/schema": "./src/db/schema/index.ts",
    "./db/rls": "./src/db/rls.ts"
  }
}
```

> Pointing directly to `.ts` source files (not `.js` dist files) works here because Next.js's bundler (SWC/Turbopack) processes the workspace packages' TypeScript directly — it does not need the pre-compiled `dist/`. This is the standard pnpm monorepo pattern with Next.js.

Also add `@sidekick/core` as a dependency in `apps/web/package.json`:
```json
"dependencies": {
  "@sidekick/core": "workspace:*",
  ...
}
```

---

### Task 1.14 — Add Mantine provider, Notifications, PostCSS

**Why Mantine:** Pre-built accessible component library with a form library (`@mantine/form`) and notification system. Significantly faster to build good-looking UIs than writing everything from scratch.

**Install in `apps/web`:**
```bash
pnpm add --filter web @mantine/core @mantine/hooks @mantine/form @mantine/notifications
pnpm add --filter web postcss postcss-preset-mantine postcss-simple-vars
```

**Create `apps/web/postcss.config.cjs`:**
```js
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
}
```

**Update `apps/web/src/app/layout.tsx`** to wrap with Mantine's `ColorSchemeScript` and `MantineProvider`. This must be a Server Component that imports a `Providers` Client Component (because `MantineProvider` needs the React context which requires `'use client'`):

Create `apps/web/src/app/providers.tsx`:
```tsx
'use client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <Notifications />
      {children}
    </MantineProvider>
  )
}
```

Update `apps/web/src/app/layout.tsx`:
```tsx
import { ColorSchemeScript } from '@mantine/core'
import { Providers } from './providers'

export const metadata = { title: 'Sidekick' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

---

### Task 1.12 & 1.13 — Login and Sign-up pages

**Next.js Route Groups:** Use `(auth)` route group to keep auth pages visually grouped without affecting the URL. `(auth)` does not appear in the URL — `/login` not `/(auth)/login`.

**Create `apps/web/src/app/(auth)/layout.tsx`:**
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </main>
  )
}
```

**`apps/web/src/app/(auth)/login/page.tsx`** — This is a Client Component (needs form interactivity):
```tsx
'use client'
import { useForm } from '@mantine/form'
import { TextInput, PasswordInput, Button, Paper, Title, Text, Anchor, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { createBrowserClient } from '@sidekick/core/supabase/browser'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 6 ? null : 'Password too short'),
    },
  })

  async function handleSubmit(values: typeof form.values) {
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      notifications.show({ color: 'red', message: error.message })
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Paper withBorder shadow="md" p={30} w={420}>
      <Title order={2} mb="md">Sign in</Title>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput label="Email" placeholder="you@example.com" {...form.getInputProps('email')} />
          <PasswordInput label="Password" {...form.getInputProps('password')} />
          <Button type="submit" fullWidth>Sign in</Button>
          <Text ta="center" size="sm">
            No account? <Anchor href="/signup">Sign up</Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  )
}
```

**`apps/web/src/app/(auth)/signup/page.tsx`** — Same pattern, uses `supabase.auth.signUp()`:
```tsx
'use client'
// ... same imports as login

export default function SignupPage() {
  const router = useRouter()
  const supabase = createBrowserClient()

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Invalid email'),
      password: (v) => (v.length >= 8 ? null : 'Password must be 8+ characters'),
    },
  })

  async function handleSubmit(values: typeof form.values) {
    const { error } = await supabase.auth.signUp(values)
    if (error) {
      notifications.show({ color: 'red', message: error.message })
      return
    }
    // After signup, also create the profile row
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // This will fail silently if profile already exists — that's fine
      await fetch('/api/auth/profile', { method: 'POST' })
    }
    router.push('/dashboard')
    router.refresh()
  }

  // ... same JSX as login but with sign-up copy
}
```

**`apps/web/src/app/api/auth/profile/route.ts`** — Server Route Handler that creates the `profiles` row after signup using the admin client:
```typescript
import { createServerClient } from '@sidekick/core/supabase/server'
import { createAdminClient } from '@sidekick/core/supabase/admin'
import { db } from '@sidekick/core/db'
import { profiles } from '@sidekick/core/db/schema'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use withRLS to insert the profile row
  // (Or use admin client here since the user is newly created and has no profile yet)
  await db.insert(profiles).values({
    id: user.id,
    email: user.email!,
  }).onConflictDoNothing()  // idempotent — safe to call multiple times

  return NextResponse.json({ ok: true })
}
```

> Note: `onConflictDoNothing()` makes this idempotent — if the profile already exists (e.g., double submit), it silently succeeds. This is important for reliability.

---

### Task 1.15 & 1.16 — Dashboard shell with sign-out

**`apps/web/src/app/(app)/layout.tsx`** — Protected layout. In Next.js App Router, you can validate the session in a layout's server component:
```tsx
import { createServerClient } from '@sidekick/core/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from './app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')  // Belt-and-suspenders — middleware handles this too

  return <AppShell user={user}>{children}</AppShell>
}
```

**`apps/web/src/app/(app)/app-shell.tsx`** — Client Component for interactive sidebar/header:
```tsx
'use client'
import { AppShell as MantineAppShell, NavLink, Group, Text, Button } from '@mantine/core'
import { createBrowserClient } from '@sidekick/core/supabase/browser'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export function AppShell({ user, children }: { user: User, children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createBrowserClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm' }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>Sidekick</Text>
          <Button variant="subtle" size="sm" onClick={handleSignOut}>Sign out</Button>
        </Group>
      </MantineAppShell.Header>
      <MantineAppShell.Navbar p="md">
        <NavLink label="Dashboard" href="/dashboard" />
        {/* More nav items added in future phases */}
      </MantineAppShell.Navbar>
      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  )
}
```

**`apps/web/src/app/(app)/dashboard/page.tsx`:**
```tsx
import { createServerClient } from '@sidekick/core/supabase/server'
import { Text, Title } from '@mantine/core'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <Title order={2}>Dashboard</Title>
      <Text mt="sm" c="dimmed">Welcome, {user?.email}</Text>
    </>
  )
}
```

---

### Task 1.17 — Sign-out (already included in AppShell above)

Sign-out is handled in the `AppShell` component via `supabase.auth.signOut()` followed by a push to `/login` and `router.refresh()` to clear the server-side cache.

---

### Task 1.18 — Verification checklist

Before declaring Phase 1 complete:

- [ ] `pnpm turbo build` succeeds without errors
- [ ] `pnpm turbo typecheck` passes across all packages
- [ ] `pnpm turbo lint` passes (no boundary violations)
- [ ] Navigate to `http://localhost:3000/dashboard` while logged out → redirected to `/login`
- [ ] Sign up with a new email → lands on `/dashboard`
- [ ] Check Supabase dashboard → user appears in **Authentication → Users**
- [ ] Check Supabase dashboard → row appears in **Table Editor → profiles**
- [ ] Reload `/dashboard` → session persists (not redirected to login)
- [ ] Click Sign Out → redirected to `/login`
- [ ] Navigate to `/dashboard` after sign-out → redirected to `/login`

---

## Packages to Install (Summary)

| Package | Target | Purpose |
|---------|--------|---------|
| `@supabase/ssr` | `@sidekick/core` | Supabase client for Next.js App Router |
| `@supabase/supabase-js` | `@sidekick/core` | Supabase base client |
| `drizzle-orm` | `@sidekick/core` | TypeScript ORM for schema + queries |
| `postgres` | `@sidekick/core` | PostgreSQL driver for Drizzle |
| `drizzle-kit` (dev) | `@sidekick/core` | CLI for generating/running migrations |
| `@mantine/core` | `web` | Component library |
| `@mantine/hooks` | `web` | Mantine React hooks |
| `@mantine/form` | `web` | Form state management |
| `@mantine/notifications` | `web` | Toast notifications |
| `postcss` | `web` | CSS processing (required by Mantine) |
| `postcss-preset-mantine` | `web` | Mantine PostCSS plugin |
| `postcss-simple-vars` | `web` | CSS variables for breakpoints |
| `@sidekick/core` | `web` | Workspace dep — access Supabase clients |

---

## Key Concepts Introduced in Phase 1 (Learning Reference)

| Concept | Where | Why |
|---------|-------|-----|
| Browser vs. server Supabase clients | `packages/core/src/supabase/` | Different environments need different auth strategies |
| Cookie-based sessions | `middleware.ts` + server client | Server-rendered pages need cookies, not localStorage |
| Drizzle schema = TypeScript types | `packages/core/src/db/schema/` | Write once, type-safe everywhere |
| Row Level Security | Supabase SQL Editor | Database-enforced data isolation |
| `withRLS` session variable | `packages/core/src/db/rls.ts` | Bridge between Drizzle's postgres connection and RLS policies |
| Route groups | `(auth)/`, `(app)/` | Organize pages without affecting URLs |
| Server vs. Client Components | Throughout `apps/web` | Server = data fetching; Client = interactivity |
| Next.js middleware | `apps/web/src/middleware.ts` | Runs before every request for session refresh + redirects |

---

## What's Out of Scope for Phase 1

- `withApiGuard()` — Phase 2
- Feature entitlements — Phase 2
- Email verification flows — deliberate skip for now; can be enabled in Supabase dashboard settings later
- Forgot password / password reset — Phase 2 or later
- OAuth providers (Google, GitHub) — can be added later without rework

---

## Archival Note

Save this document to:
`docs/plans/phase-1-supabase-and-auth-shell/sidekick-phase1_plan.md`

This is the first implementation step after plan mode exits.
