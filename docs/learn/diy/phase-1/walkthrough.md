# Phase 1 Walkthrough — Supabase Auth, DB Schema, and UI Shell

This guide walks through reproducing Phase 1 step by step. It assumes you have completed Phase 0: the monorepo is set up with Turborepo, pnpm workspaces, TypeScript, ESLint, Prettier, and `apps/web` is a working Next.js 16 app.

Every step explains what you are doing and why. Follow the reasoning, not just the commands.

---

## Task 1.1 — Create the Supabase Project

> **What and why:** Supabase is the backend platform for authentication and the database. You will create a project through Supabase's dashboard, which provisions a Postgres database, an auth service, and API keys. Nothing to code yet — this is cloud infrastructure setup.

1. Go to [supabase.com](https://supabase.com) and create a new organization and project.
2. Choose a region close to your Vercel deployment region (latency matters for database queries).
3. Set a strong database password and save it somewhere secure.

Once the project is provisioned:

4. Go to **Project Settings** → **Data API** and find:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (previously "anon key") → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (previously "service_role") → `SUPABASE_SECRET_KEY`

5. Go to **Project Settings** → **Database** → **Connection string**. Find:
   - **Transaction mode** (port 6543) → `DATABASE_URL`
   - **Session mode** (port 5432) → `DATABASE_DIRECT_URL`

6. Create `.env.local` at the repo root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...
DATABASE_URL=postgresql://postgres.xxx:your-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DATABASE_DIRECT_URL=postgresql://postgres.xxx:your-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **By the way — single env file:** `.env.local` lives at the repo root only. Never create a `.env.local` inside `apps/web` or any package directory. A single source of truth prevents environment variable drift between packages.

> **By the way — DATABASE_URL vs DATABASE_DIRECT_URL:** Port 6543 is the connection pooler (PgBouncer). Port 5432 is a direct connection to Postgres. Runtime queries use the pooler (6543) because serverless functions create many short-lived connections. Migrations use the direct connection (5432) because they need a stable, persistent connection for DDL transactions. See `docs/learn/supabase.md` for a full explanation.

7. Add `.env.local` to `.gitignore` (it should already be there from Next.js scaffolding, but verify):

```
.env.local
```

---

## Task 1.2 — Disable Email Confirmation for Development

> **What and why:** Supabase requires email confirmation by default. In development you don't have a real email server and you don't want to confirm every test account. Disabling this locally lets you test the full auth flow without an email step.

1. In your Supabase dashboard: **Authentication** → **Providers** → **Email**
2. Toggle off **"Confirm email"**

Re-enable this before going to production.

---

## Task 1.3 — Install Packages in `packages/core`

> **What and why:** `packages/core` is the shared infrastructure package — it will contain Supabase clients, the database connection, schema, and RLS helpers. All these packages need to be installed here, not in `apps/web`, so they can be shared with future packages and apps.

```bash
# Supabase SSR package (session-aware clients)
pnpm add @supabase/ssr @supabase/supabase-js --filter @sidekick/core

# Drizzle ORM + postgres driver
pnpm add drizzle-orm postgres --filter @sidekick/core

# Drizzle Kit (CLI for migrations) — dev only
pnpm add -D drizzle-kit --filter @sidekick/core
```

> **`@supabase/ssr` vs `@supabase/supabase-js`:** `supabase-js` is the base client library. `@supabase/ssr` is a wrapper that adds cookie-based session management for server-rendered environments. You need both: `supabase-js` for the admin client (which does not use cookies), `@supabase/ssr` for everything else.

> **`drizzle-orm` vs `drizzle-kit`:** `drizzle-orm` is used in your application code to build and execute queries. `drizzle-kit` is a CLI tool used only during development and CI to generate and apply migrations — it is never imported in your app.

Also install `dotenv-cli` at the workspace root — you will need it for database scripts:

```bash
pnpm add -D -w dotenv-cli
```

> **Why `dotenv-cli` and not `--env-file`?** Node.js 22 added `--env-file`, but it is blocked when passed via `NODE_OPTIONS` — which is how package scripts typically set Node flags. Node.js treats `NODE_OPTIONS` as a security boundary and rejects `--env-file` there. `dotenv-cli` sidesteps this by loading the env file before spawning the child process. See `docs/learn/tooling.md` for the full explanation.

---

## Task 1.4 — Set Up the `exports` Field in `packages/core`

> **What and why:** The `exports` field in `package.json` defines the public API of the package. Each Supabase client gets its own subpath export so consumers can import exactly what they need without accidentally loading the wrong client. Without this, TypeScript and bundlers would not know how to resolve `@sidekick/core/supabase/browser`.

Open `packages/core/package.json` and add:

```json
{
  "name": "@sidekick/core",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./supabase/types": "./src/supabase/types.ts",
    "./supabase/browser": "./src/supabase/browser.ts",
    "./supabase/server": "./src/supabase/server.ts",
    "./supabase/proxy": "./src/supabase/proxy.ts",
    "./supabase/admin": "./src/supabase/admin.ts",
    "./db": "./src/db/index.ts",
    "./db/schema": "./src/db/schema/index.ts",
    "./db/rls": "./src/db/rls.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "db:generate": "dotenv -e ../../.env.local -- drizzle-kit generate",
    "db:migrate": "dotenv -e ../../.env.local -- drizzle-kit migrate"
  }
}
```

> **Why the `../../` path in db scripts?** The scripts run from inside `packages/core/`. The `.env.local` file is two levels up at the repo root. `dotenv-cli` needs the path to the file, not the cwd.

---

## Task 1.5 — Create `createBrowserClient`

> **What and why:** The browser client is used in React components marked `'use client'`. It manages the session using cookies that the browser stores automatically. It uses the publishable key (safe to expose in browser JavaScript).

Create `packages/core/src/supabase/browser.ts`:

```ts
import { createBrowserClient as _createBrowserClient } from '@supabase/ssr'

export function createBrowserClient(): ReturnType<typeof _createBrowserClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for browser client')
  }

  return _createBrowserClient(supabaseUrl, supabaseKey)
}
```

> **Why wrap `_createBrowserClient`?** We add a guard that throws a clear error if env variables are missing, instead of silently producing a broken client. Runtime validation is worth the few lines. TypeScript's `!` non-null assertion satisfies the type checker, but does not check at runtime — hence the explicit guard.

---

## Task 1.6 — Create `createServerClient`

> **What and why:** Server Components and Route Handlers running on Node.js can read request cookies via `next/headers`. The server client uses those cookies to read (and potentially refresh) the user session. It still uses the publishable key — elevated permissions are not needed just to read the session.

Create `packages/core/src/supabase/server.ts`:

```ts
import { cookies } from 'next/headers'
import { createServerClient as _createServerClient } from '@supabase/ssr'

export async function createServerClient(): Promise<ReturnType<typeof _createServerClient>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for server client')
  }

  const cookieStore = await cookies()

  return _createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot set cookies.
          // proxy.ts handles session refresh and cookie writing.
        }
      },
    },
  })
}
```

> **Why `async`?** In Next.js 15+, `cookies()` from `next/headers` is asynchronous — it returns a Promise. You must `await cookies()` before you can read or write cookies.

> **Why the try/catch in `setAll`?** Server Components can read cookies but cannot write them. Writing a cookie requires mutating the HTTP response — Server Components do not have direct access to the response object. The `@supabase/ssr` library calls `setAll` when it wants to refresh the session. In a Server Component, this would throw. The try/catch suppresses the error gracefully: `proxy.ts` handles session refresh and cookie writing before Server Components even run.

> **Why not use this client in `proxy.ts`?** It calls `next/headers`, which is a Node.js API not available in the Edge runtime where `proxy.ts` runs. That is why `createProxyClient` exists.

---

## Task 1.7 — Create `createAdminClient`

> **What and why:** The admin client uses the secret key, which bypasses all Row Level Security. You use it for trusted server-side operations where you need elevated permissions — like creating a user manually or accessing data across all users. It must never appear in browser code.

Create `packages/core/src/supabase/admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient(): ReturnType<typeof createClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SECRET_KEY!

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for admin client')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
```

> **Why `autoRefreshToken: false` and `persistSession: false`?** The admin client is not a logged-in user — it is an elevated service that runs operations on behalf of the system. It should not maintain any session or try to refresh tokens. Each use is a one-off, stateless privileged operation.

> **`@supabase/supabase-js` here, not `@supabase/ssr`:** The SSR package adds cookie-based session management. The admin client does not use sessions or cookies — it authenticates via the secret key. Using the base `supabase-js` package is correct here.

---

## Task 1.8 — Create `createProxyClient`

> **What and why:** This was not in the original plan but became necessary during implementation. `proxy.ts` runs in Next.js's Edge runtime — a lightweight environment that does not have access to Node.js APIs, including `next/headers`. We need a Supabase client that works in the Edge runtime by reading and writing cookies directly from the request/response objects.

Create `packages/core/src/supabase/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase client for use in proxy.ts (Edge runtime) only.
 * Uses request/response cookies directly — never import next/headers here.
 * For Server Components and Route Handlers, use createServerClient() instead.
 */
export function createProxyClient(
  request: NextRequest,
  response: NextResponse,
): ReturnType<typeof createServerClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for proxy client')
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })
}
```

> **Why two cookies calls in `setAll`?** Updating `request.cookies` ensures the current request sees the updated cookie within the same execution context. Updating `response.cookies` writes the cookie to the HTTP response, so the browser stores it for future requests. Both are needed.

> **This client is exclusive to `proxy.ts`.** Never use it in Server Components, Route Handlers, or client components. If you find yourself reaching for `createProxyClient` outside `proxy.ts`, you need one of the other three clients.

---

## Task 1.9 — Create the `profiles` Schema

> **What and why:** The `profiles` table is the application-level user record. Supabase manages `auth.users` internally — we do not own that table. `public.profiles` is our table, with our columns, linked to `auth.users` by the same UUID. All application-level user data (display name, preferences, etc.) goes here, not in `auth.users`.

Create `packages/core/src/db/schema/profiles.ts`:

```ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Create `packages/core/src/db/schema/index.ts`:

```ts
export * from './profiles'
```

> **Why no `autoincrement` or `serial` on the ID?** The profile ID is the same UUID as `auth.users.id` — it is not auto-generated by the profiles table. The trigger will pass the UUID from `auth.users.id` when inserting. Using the same UUID means you never need a join to go from auth identity to application profile.

> **`withTimezone: true` on timestamps:** Always store timestamps with timezone information. Without it, you store a naive datetime that is ambiguous when you have users in multiple timezones. Postgres converts to UTC on storage when `withTimezone: true`.

---

## Task 1.10 — Create the Database Connection

> **What and why:** Drizzle needs a connection to Postgres. This file creates the connection using the pooler URL (`DATABASE_URL`, port 6543) and instantiates the Drizzle instance with the schema. Every query goes through this db instance.

Create `packages/core/src/db/index.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error('Missing DATABASE_URL environment variable')
}

const client = postgres(url)

export const db = drizzle(client, { schema })
```

> **Why `DATABASE_URL` (port 6543) here and not `DATABASE_DIRECT_URL`?** This module is used in the running application — in Route Handlers and Server Components. Serverless functions create many short-lived instances. The pooler handles connection management and prevents exhausting Postgres's connection limit. The direct URL is used only in `drizzle.config.ts` for migrations.

---

## Task 1.11 — Configure Drizzle Kit

> **What and why:** Drizzle Kit is the CLI that generates and applies migrations. It needs to know where the schema is, where to put migration files, and how to connect to the database. It uses `DATABASE_DIRECT_URL` (port 5432, direct connection) because migration operations need a stable, persistent connection — not the pooler.

Create `packages/core/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

const directUrl = process.env.DATABASE_DIRECT_URL

if (!directUrl) {
  throw new Error('Missing DATABASE_DIRECT_URL environment variable')
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: directUrl,
  },
})
```

---

## Task 1.12 — Wire Up Turbo for Database Scripts

> **What and why:** Database scripts need to run with the env file loaded. We already set up the scripts in `package.json`. Now tell Turbo how to run them — specifically, `db:migrate` must never be cached, because it is a side-effecting operation that modifies an external database.

In `turbo.json`, add:

```json
{
  "tasks": {
    "db:migrate": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    }
  }
}
```

> **Why `cache: false` on `db:migrate`?** Turbo caches tasks by hashing source files. If migrations haven't changed, a cached run would skip the command entirely. But you might need to re-apply migrations to a reset database, or run them against a different database environment. `cache: false` ensures `db:migrate` always executes. It also produces no cache artifacts — databases are external state, not files in your repo.

> **Why no `dependsOn: ["^build"]` on `db:migrate`?** Migrations are run from your terminal against a database directly. They do not need the application packages to be compiled. Adding a build dependency would force a full monorepo compile before every migration — unnecessary overhead.

Now generate and apply the first migration:

```bash
pnpm db:generate   # generates 0000_mixed_leper_queen.sql (or similar name)
pnpm db:migrate    # applies it to the database
```

Verify the `profiles` table exists in your Supabase dashboard under **Table Editor**.

---

## Task 1.13 — Enable RLS and Create the Canonical Policy

> **What and why:** Row Level Security is a Postgres feature that enforces access rules at the database level. Without it, any query can read any row. With RLS enabled and a policy in place, the database automatically filters rows based on who is querying.

Run these SQL commands in the Supabase SQL editor (**SQL Editor** → **New query**):

```sql
-- Enable RLS on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Canonical policy: a user can only access their own profile row
CREATE POLICY "users can only access their own profiles"
ON public.profiles
USING (id::text = current_setting('app.current_user_id', true));
```

> **Why `id::text`?** The `id` column is a UUID. `current_setting()` returns a text value. PostgreSQL needs the types to match for the comparison. Casting UUID to text is the simplest approach.

> **Why `true` as the second argument to `current_setting`?** The `true` flag means "return an empty string if the setting is not set, instead of throwing an error." This prevents the policy from crashing on unauthenticated requests — the empty string simply won't match any UUID.

> **What is `app.current_user_id`?** It is a PostgreSQL session variable. Before every query, the application sets this to the current user's ID. The RLS policy reads it and uses it as the filter. This is how Drizzle (which connects as the Postgres superuser and bypasses Supabase auth) can still enforce user-level access.

---

## Task 1.14 — Create the Profile Trigger

> **What and why:** Instead of calling an API route to create the profile after sign-up, a Postgres trigger does it automatically. The trigger fires on every insert into `auth.users` — regardless of which auth provider was used — and inserts a corresponding row into `public.profiles`.

In the Supabase SQL editor:

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

> **Why `public.profiles` and not just `profiles`?** This function runs in the context of the `auth` schema — because the trigger is on `auth.users`. Inside the function, an unqualified table name resolves to `auth.profiles`, which does not exist. Always qualify with `public.` when referencing tables outside the triggering schema.

> **Why `SECURITY DEFINER`?** The trigger fires with the privileges of the function's owner (the postgres superuser), not the user who caused the insert. This is necessary because regular users do not have permission to insert into `public.profiles` directly — RLS blocks it. `SECURITY DEFINER` allows the trigger to bypass RLS and write the profile row as a privileged operation.

---

## Task 1.15 — Create the `withRLS` Helper

> **What and why:** Drizzle connects as the Postgres superuser, which bypasses Supabase's auth layer. To enforce RLS, you must set the `app.current_user_id` session variable before every user-data query. The `withRLS` helper does this in a single, consistent, easy-to-use wrapper.

Create `packages/core/src/db/rls.ts`:

```ts
import { sql } from 'drizzle-orm'
import { db } from './'

export async function withRLS<T>(
  userId: string,
  fn: (db: typeof import('./index').db) => Promise<T>,
): Promise<T> {
  await db.execute(sql`select set_config('app.current_user_id', ${userId}, true)`)
  return await fn(db)
}
```

> **Why `true` as the third argument to `set_config`?** The `true` flag makes the setting local to the current transaction — it is automatically cleared when the transaction ends. This prevents the user ID from leaking between requests in the connection pool. Without this, a pooled connection that handled user A's request might still have `app.current_user_id` set to user A's ID when it serves user B's next request.

Usage pattern:

```ts
import { withRLS } from '@sidekick/core/db/rls'

const profile = await withRLS(userId, async (db) => {
  return db.select().from(profiles).where(eq(profiles.id, userId))
})
```

Never set `app.current_user_id` manually. Always use `withRLS`.

---

## Task 1.16 — Create `proxy.ts` (Next.js 16 Middleware)

> **What and why:** In Next.js 16, the middleware file was renamed from `middleware.ts` to `proxy.ts`, and the exported function was renamed from `middleware` to `proxy`. `proxy.ts` runs on every request (except static assets). Its job: refresh the session and redirect unauthenticated users to login. No business logic lives here.

Create `apps/web/src/proxy.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createProxyClient } from '@sidekick/core/supabase/proxy'
import { isApiRoute, isAuthRoute } from './utils/route'

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createProxyClient(request, supabaseResponse)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // API routes handle their own auth via withApiGuard — skip redirect logic
  if (isApiRoute(request)) {
    return supabaseResponse
  }

  // Redirect unauthenticated users to login
  if (!user && !isAuthRoute(request)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute(request)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

> **Why pass `{ request }` to `NextResponse.next()`?** This creates the response object that the Supabase client will write refreshed session cookies to. Passing the request in ensures the response is correlated with the incoming request — required for session cookie propagation.

> **Why exclude API routes?** API routes handle their own authentication via `withApiGuard()` (Phase 2). If the proxy redirected unauthenticated requests to API routes, those routes would get a redirect response instead of a 401 JSON error — breaking any API client. API routes need to manage their own auth response format.

> **Why use `createProxyClient` here and not `createServerClient`?** `createServerClient` calls `next/headers`, which is a Node.js API unavailable in the Edge runtime. `proxy.ts` runs in the Edge runtime. `createProxyClient` reads cookies directly from the request/response objects, which work in Edge.

Create `apps/web/src/utils/route.ts`:

```ts
import { NextRequest } from 'next/server'

const AUTH_ROUTES = ['/login', '/signup']

export function isAuthRoute(request: NextRequest): boolean {
  return AUTH_ROUTES.some((route) => request.nextUrl.pathname.startsWith(route))
}

export function isApiRoute(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith('/api')
}
```

---

## Task 1.17 — Set Up `packages/copy`

> **What and why:** No string literals in source code. All user-visible text lives in `@sidekick/copy`. This keeps copy consistent across `apps/web` and `apps/cli`, and makes copy changes a single-file operation — no deployment needed for rewording a label.

> **By the way — no hardcoded strings:** This was an intentional project standard. TypeScript's `as const` makes copy objects type-safe and enables autocomplete. Referencing a key that doesn't exist is a compile-time error.

Create `packages/copy/package.json`:

```json
{
  "name": "@sidekick/copy",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    "./auth": "./src/auth.ts",
    "./app": "./src/app.ts",
    "./errors": "./src/errors.ts",
    "./form": "./src/form.ts"
  }
}
```

Create `packages/copy/src/auth.ts`:

```ts
export const signInCopies = {
  pageTitle: 'Sign in',
  noAccount: 'No account?',
  signUpLink: 'Sign up',
  error: 'Invalid email or password',
} as const

export const signUpCopies = {
  pageTitle: 'Create an account',
  hasAccount: 'Already have an account?',
  signInLink: 'Sign in',
} as const
```

Create the other copy files similarly (`app.ts`, `errors.ts`, `form.ts`) with the text your app needs.

Add `@sidekick/copy` to `apps/web` dependencies:

```bash
pnpm add @sidekick/copy --filter @sidekick/web
```

In `apps/web/package.json`:
```json
"dependencies": {
  "@sidekick/copy": "workspace:*"
}
```

---

## Task 1.18 — Set Up the Custom ESLint Plugin

> **What and why:** The project has a styling convention: CSS modules only, no Mantine style props, no inline styles, no barrel file exports in package public APIs, and no default exports (except Next.js special files). Rather than relying on team memory, an ESLint plugin enforces these at lint time.

> **By the way — CSS modules decision:** You might wonder why not Mantine's built-in style props (e.g., `<Button h={40} px={16}>`). The decision: style props apply styles as inline styles that bypass the CSS cascade and cannot be overridden by CSS modules. CSS modules keep styles explicit, co-located, and overridable. The `no-mantine-style-props` rule makes this convention automatic.

### Create the plugin

Create `packages/eslint-plugin-sidekick/package.json`:

```json
{
  "name": "@sidekick/eslint-plugin-sidekick",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --out-dir dist"
  },
  "devDependencies": {
    "@types/estree": "^1.0.9",
    "@types/estree-jsx": "^1.0.5",
    "eslint": "^9.39.4",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3"
  }
}
```

> **Why `tsup` and not `tsc`?** ESLint loads plugins via Node.js — it cannot process `.ts` files directly. The plugin must be compiled to JavaScript first. `tsup` bundles everything into a single self-contained file that Node.js can load. Using `tsc` with the project's `moduleResolution: bundler` settings produces output that Node.js might not load correctly without additional configuration. `tsup` is simpler and produces the right output format in one step.

Create `packages/eslint-plugin-sidekick/src/index.ts` with the rules:

```ts
import { noMantineStyleProps } from './rules/no-mantine-style-props'
// ... other rules

export default {
  rules: {
    'no-mantine-style-props': noMantineStyleProps,
    // ...
  },
}
```

Build the plugin:

```bash
pnpm --filter @sidekick/eslint-plugin-sidekick build
```

### Wire up Turbo to build the plugin before lint

In `turbo.json`, the `lint` task must depend on the plugin being built first:

```json
"lint": {
  "dependsOn": ["@sidekick/eslint-plugin-sidekick#build", "^lint"]
}
```

> **Why `@sidekick/eslint-plugin-sidekick#build` syntax?** This is Turbo's "Package#task" syntax — it names a specific task in a specific package that must complete before `lint` runs in any package. Without this, ESLint would fail to load the plugin because the compiled `dist/index.js` would not exist yet.

### Register the plugin in the root ESLint config

In `eslint.config.js` at the repo root:

```js
import sidekickPlugin from '@sidekick/eslint-plugin-sidekick'

export default [
  // ... other config
  {
    plugins: {
      '@sidekick': sidekickPlugin,
    },
    rules: {
      '@sidekick/no-mantine-style-props': 'error',
    },
  },
]
```

Add `@sidekick/eslint-plugin-sidekick` as a root devDependency:

```bash
pnpm add -D -w @sidekick/eslint-plugin-sidekick
```

In root `package.json`:
```json
"devDependencies": {
  "@sidekick/eslint-plugin-sidekick": "workspace:*"
}
```

---

## Task 1.19 — Set Up Mantine

> **What and why:** Mantine is the component library. It handles interactive UI elements (forms, buttons, modals, notifications) with good accessibility defaults and a consistent design language. Styling is via CSS modules, not Mantine's style props.

Install Mantine packages in `apps/web`:

```bash
pnpm add @mantine/core @mantine/hooks @mantine/form @mantine/notifications --filter @sidekick/web
```

Create `apps/web/src/app/providers.tsx`:

```tsx
'use client'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'

export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider defaultColorScheme="auto">
      <Notifications />
      {children}
    </MantineProvider>
  )
}
```

> **Why `'use client'`?** `MantineProvider` uses React Context internally — it creates a context that child components read to access the theme. React Context is a client-side primitive. If you rendered `MantineProvider` as a Server Component, the context would not be available to any client component below it. `'use client'` marks this component and all its children as client components, enabling context.

Update `apps/web/src/app/layout.tsx` to include `ColorSchemeScript` and `suppressHydrationWarning`:

```tsx
import { ColorSchemeScript } from '@mantine/core'
import { Providers } from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

> **Why `ColorSchemeScript` and `suppressHydrationWarning`?** Mantine's color scheme (light/dark/auto) is determined by the user's OS preference — which is only available in the browser, not during server-side rendering. The server renders in one color scheme; the browser may render in another; React notices the mismatch and logs a hydration error.
>
> `ColorSchemeScript` injects a small `<script>` tag that runs before React hydrates, setting the correct color scheme in the DOM. `suppressHydrationWarning` tells React that the `class` attribute on `<html>` may legitimately differ between server render and client hydration (because the script modifies it) — do not treat this as an error. Both `ColorSchemeScript` and `MantineProvider` must have `defaultColorScheme="auto"` so they agree on the default.

---

## Task 1.20 — Create the `useNavigation` Hook

> **What and why:** After auth actions (login, logout, sign-up), you need to navigate the user and also invalidate stale server-rendered data. `router.push()` navigates. `router.refresh()` tells Next.js to re-fetch all server components on the new page. You need both — forgetting `router.refresh()` means the layout may still show stale state (e.g., "Sign In" button still visible after login). The hook encapsulates both calls so you can never forget one.

Create `apps/web/src/hooks/useNavigation.ts`:

```ts
'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

export function useNavigation(): { push: (path: string) => void } {
  const router = useRouter()

  const push = useCallback(
    (path: string) => {
      router.push(path)
      router.refresh()
    },
    [router],
  )

  return { push }
}
```

Use it everywhere you navigate after a mutation:

```ts
const { push } = useNavigation()

// After sign in:
push('/dashboard')

// After sign out:
push('/login')
```

---

## Task 1.21 — Create Route Groups and Auth Pages

> **What and why:** Route groups (`(auth)` and `(secure)`) let you apply different layouts to different parts of the app without affecting the URL. The `(auth)` group wraps login and signup with a centered layout. The `(secure)` group wraps dashboard and other protected pages with the app shell + auth check. The parentheses in the folder name tell Next.js this is a route group — the word `auth` or `secure` does not appear in the URL.

Create `apps/web/src/app/(auth)/layout.tsx`:

```tsx
import { ReactNode } from 'react'
import styles from './layout.module.css'

export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: ReactNode }): React.ReactElement {
  return <main className={styles.root}>{children}</main>
}
```

> **Why `export const dynamic = 'force-dynamic'`?** Next.js tries to statically pre-render layouts at build time. This layout does not call Supabase directly — but its children (login and signup pages) might. More importantly, any layout that has Supabase context in its subtree should be `force-dynamic` to prevent build-time failures when Supabase clients try to read cookies that don't exist at build time. This ensures per-request rendering.

Create `apps/web/src/app/(auth)/login/page.tsx`:

```tsx
'use client'

import { useNavigation } from '@/hooks/useNavigation'
import { Button, Paper, PasswordInput, Stack, Text, TextInput, Title, Anchor } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { signInCopies } from '@sidekick/copy/auth'
import { buttonCopies, labelCopies, placeholderCopies, validationCopies } from '@sidekick/copy/form'
import { createBrowserClient } from '@sidekick/core/supabase/browser'

import styles from '../auth.module.css'

export default function LoginPage(): React.ReactElement {
  const supabase = createBrowserClient()
  const { push } = useNavigation()
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) =>
        isValidEmail(value)
          ? null
          : validationCopies.invalidInput(labelCopies.email.toLocaleLowerCase()),
      password: (value) => (isValidPassword(value) ? null : validationCopies.tooSmallPassword),
    },
  })

  const handleSubmit = async (values: typeof form.values) => {
    const { error } = await supabase.auth.signInWithPassword(values)

    if (error) {
      notifications.show({ color: 'red', message: signInCopies.error })
      return
    }

    push('/dashboard')
  }

  return (
    <Paper withBorder shadow="md" className={styles.container}>
      <Title order={2} className={styles.title}>{signInCopies.pageTitle}</Title>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label={labelCopies.email}
            placeholder={placeholderCopies.email}
            {...form.getInputProps('email')}
          />
          <PasswordInput label={labelCopies.password} {...form.getInputProps('password')} />
          <Button type="submit" className={styles.submitButton}>{buttonCopies.signIn}</Button>
          <Text className={styles.switchText}>
            {signInCopies.noAccount} <Anchor href="/signup">{signInCopies.signUpLink}</Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  )
}
```

> **By the way — `withBorder` and `shadow` are allowed; `h`, `px`, `fw` are not:** Mantine components have two kinds of props. Behavioral props configure the component's structure (e.g., `withBorder` tells `Paper` to render a border, `shadow="md"` sets a shadow level). Style props like `h={400}` and `px={16}` apply inline styles that bypass the CSS cascade. The `no-mantine-style-props` ESLint rule bans the latter. Use CSS modules for visual styling.

> **By the way — `default` export here:** Login and signup pages use `export default` because Next.js requires default exports for page files. The ESLint rule allows this exception. All other components and utilities in the project use named exports.

Create `apps/web/src/app/(auth)/signup/page.tsx` following the same pattern with `supabase.auth.signUp(values)`.

---

## Task 1.22 — Create the Secure Route Group and App Shell

> **What and why:** The `(secure)` route group wraps all authenticated pages. Its layout does the second authentication check (defense in depth after `proxy.ts`) and renders the app shell around the page content.

Create `apps/web/src/app/(secure)/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { createServerClient } from '@sidekick/core/supabase/server'
import { AppShell } from './app-shell'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: ReactNode
}): Promise<React.ReactElement> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defense in depth: proxy.ts handles this first.
  // This catches misconfigured matchers or accidentally excluded routes.
  if (!user) {
    redirect('/login')
  }

  return <AppShell user={user}>{children}</AppShell>
}
```

> **Why `redirect` here (not `useRouter().push`):** `redirect` is a Next.js server-side function that sends an HTTP redirect response. It is used in Server Components and Route Handlers. `useRouter()` is a client-side hook — it cannot be used in a Server Component. The distinction: `redirect()` terminates server rendering and sends a redirect; `router.push()` navigates the browser without a full page reload.

Create `apps/web/src/app/(secure)/app-shell.tsx`:

```tsx
'use client'

import { useNavigation } from '@/hooks/useNavigation'
import { AppShell as MantineAppShell, NavLink, Text, Anchor } from '@mantine/core'
import { createBrowserClient } from '@sidekick/core/supabase/browser'
import type { User } from '@sidekick/core/supabase/types'

import styles from './app-shell.module.css'

export function AppShell({
  user,
  children,
}: {
  user: User
  children: React.ReactNode
}): React.ReactElement {
  const supabase = createBrowserClient()
  const { push } = useNavigation()

  async function handleSignout() {
    await supabase.auth.signOut()
    push('/login')
  }

  return (
    <MantineAppShell navbar={{ width: 240, breakpoint: 'sm' }} className={styles.shell}>
      <MantineAppShell.Header className={styles.header}>
        <Text className={styles.brandName}>Sidekick</Text>
        <Text className={styles.userEmail}>{user.email}</Text>
        <Anchor component="button" className={styles.signoutButton} onClick={handleSignout}>
          Sign out
        </Anchor>
      </MantineAppShell.Header>
      <MantineAppShell.Navbar className={styles.navbar}>
        <NavLink label="Dashboard" href="/dashboard" />
      </MantineAppShell.Navbar>
      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  )
}
```

> **Why is `AppShell` a client component when the layout is a server component?** The layout reads the user from Supabase (server-only) and passes it down to `AppShell`. `AppShell` needs `'use client'` because it handles a click event (`handleSignout`) and uses the `useNavigation` hook — both require client-side JavaScript.
>
> Props passed from a Server Component to a Client Component must be serializable — plain objects, strings, numbers, booleans. The `User` object from Supabase is a plain object, so it crosses this boundary correctly. You cannot pass functions or class instances from server to client.

> **Why `navbar={{ width: 240, breakpoint: 'sm' }}` on `MantineAppShell` instead of a CSS class?** This is a behavioral prop — it configures Mantine's layout engine for the sidebar, not an inline style. Mantine's AppShell component needs to know the sidebar width to calculate the main content offset. This is allowed.

Create `apps/web/src/app/(secure)/dashboard/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

export default function DashboardPage(): React.ReactElement {
  return <div>Dashboard</div>
}
```

---

## Task 1.23 — Set Up the AI Context Docs and Symlinks

> **What and why:** Different AI coding assistants expect their context file at different paths: Claude reads `CLAUDE.md`, Gemini reads `GEMINI.md`, OpenAI Codex reads `AGENTS.md`. Rather than maintaining three separate files that can drift, we keep one canonical source at `docs/ai/context.md` and symlink the vendor-specific names to it. When you update the context, all assistants see the update automatically.

```bash
# Create the canonical source
mkdir -p docs/ai
# Write docs/ai/context.md with your architecture documentation

# Create symlinks at the repo root
ln -s docs/ai/context.md CLAUDE.md
ln -s docs/ai/context.md AGENTS.md
ln -s docs/ai/context.md GEMINI.md
```

> **By the way — avoid vendor lock-in on AI tooling:** Symlinking prevents you from being locked into one AI assistant's conventions. If you switch from Claude to Cursor or Gemini, you already have the right file name — no migration needed. The context is written once and works everywhere.

> **Splitting context files in the future:** As the project grows, one monolithic `context.md` becomes hard to maintain. Plan to split it: `docs/ai/architecture.md`, `docs/ai/conventions.md`, `docs/ai/commands.md`, each focused on a specific topic. The symlinked entry points stay the same; the content is organized into focused files.

---

## Task 1.24 — Verify the Full Flow

> **What and why:** Phase 1 is complete when a user can sign up, see their profile in the database, navigate to the dashboard, and sign out. Test this end to end before declaring the phase done.

### Local verification

1. Start the dev server:
   ```bash
   pnpm dev
   ```

2. Navigate to `http://localhost:3000/signup`
3. Create an account with any email and password
4. You should be redirected to `/dashboard`
5. Check your Supabase dashboard → **Table Editor** → `profiles` — there should be a row
6. Click Sign out — you should land on `/login`
7. Sign in with the same credentials — dashboard appears again
8. Navigate to `http://localhost:3000/login` while logged in — should redirect to `/dashboard`

### Vercel deployment

1. Connect your GitHub repo to Vercel
2. Set Root Directory: `apps/web`
3. Add all environment variables from `.env.local` in Vercel's project settings
4. Note: use the **stable project URL** (e.g. `sidekick-six-bay.vercel.app`) for `NEXT_PUBLIC_APP_URL`, not a per-deployment URL
5. Add Supabase redirect URLs: In Supabase → **Authentication** → **URL Configuration**, add your Vercel domain to **Redirect URLs**
6. Deploy and verify the full flow on the deployed URL

> **Vercel's console.* monitoring:** Vercel captures all `console.log`, `console.error`, etc. output in its Functions log. This gives you basic observability — error messages, debug output, request traces — without setting up a dedicated monitoring tool. It is sufficient for MVP. Post-MVP, consider Sentry or a dedicated logging service.

> **Why declare env vars in `turbo.json`?** Turbo caches builds by hashing source files. Without declaring environment variables in `turbo.json`'s `env` array, a change to `NEXT_PUBLIC_APP_URL` would not invalidate the cache — Turbo sees no source file changes. You'd get a stale cached build that ignores your new variable. Declaring variables in `turbo.json` includes their values in the cache hash: if a value changes, the cache is invalidated and the build reruns.
