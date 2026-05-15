# Supabase — Concepts and How We Use It

This document explains the key Supabase and database concepts introduced in Phase 1, with enough context that you understand not just what to do but why each piece exists.

---

## Persistent vs Pooler Connections

When your application connects to a PostgreSQL database, it opens a TCP connection. That connection has some startup cost — authentication handshake, memory allocation on the server, etc.

**Persistent connection (direct):** Your app opens one connection and keeps it open for the duration of its lifetime. Queries go directly to Postgres on port 5432. No middleman. The connection is stable and long-lived.

**Pooler connection:** A middleware process (PgBouncer, in Supabase's case) sits between your app and Postgres. Your app connects to the pooler, the pooler maintains a pool of connections to Postgres, and it routes queries from many app connections through a smaller number of database connections. Each query may be handled by a different underlying Postgres connection.

### Why does this matter?

Serverless environments (like Next.js Route Handlers on Vercel) spin up and tear down hundreds of short-lived function instances. If each instance opened a direct Postgres connection, you'd quickly exceed Postgres's maximum connection limit. The pooler handles this: many serverless instances share a small pool of underlying connections.

**Stateful operations** — like Drizzle's migration runner — need a persistent, direct connection because they run sequences of SQL statements that must execute on the same connection (DDL transactions, advisory locks, etc.). The pooler's connection-switching behavior would break these.

### In Sidekick

| Variable | Port | Type | Used For |
|---|---|---|---|
| `DATABASE_URL` | 6543 | Pooler | Runtime queries (all application code) |
| `DATABASE_DIRECT_URL` | 5432 | Direct | Drizzle migrations only |

`packages/core/src/db/index.ts` connects using `DATABASE_URL` (port 6543). This is correct for production.

`drizzle.config.ts` uses `DATABASE_DIRECT_URL` (port 5432). This is only invoked when you run `pnpm db:migrate` — never during the application's request lifecycle.

---

## Secret vs Publishable Keys — and Why They Are Not the Same Thing as Connection Type

This is a common source of confusion. There are two independent dimensions here:

1. **Authorization level** — what the key lets you do
2. **Connection type** — how you connect (pooler vs direct)

They are completely separate concerns.

### The two Supabase key types

**Publishable key** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`):
- Safe to expose in browser JavaScript
- Used by browser clients, server clients, and the proxy client
- Gives the user anonymous access — can only do what Supabase's Row Level Security policies permit for the current user
- Previously called the "anon key" in older Supabase documentation

**Secret key** (`SUPABASE_SECRET_KEY`):
- Must never be exposed to the browser — it bypasses RLS entirely
- Used only by `createAdminClient()` for trusted server-side operations (e.g. managing users, accessing data regardless of who owns it)
- Previously called the "service role key"

### Clearing up the confusion

You might think: "migrations are admin-level operations, so they need the secret key." That is not correct.

Migrations are not run by a Supabase client at all. Drizzle Kit connects directly to Postgres using the `DATABASE_DIRECT_URL` connection string. That connection string includes the database credentials (username and password) in the URL itself — it has nothing to do with Supabase's JWT-based key system.

Similarly, the direct URL connection type does not require or imply the secret key. You can use the direct URL with the pooler credentials if you wanted — the URL and the key are independent.

| | Uses Publishable Key | Uses Secret Key |
|---|---|---|
| Browser client | Yes | No |
| Server client | Yes | No |
| Proxy client | Yes | No |
| Admin client | No | Yes |
| Drizzle migrations | Neither — uses DB credentials in the URL | — |

---

## The Four Supabase Clients

Supabase is not just a database — it also manages authentication and sessions. That session state lives in a cookie. Reading and writing that cookie requires different approaches depending on where your code runs.

### `createBrowserClient()` — `packages/core/src/supabase/browser.ts`

**What it does:** Creates a Supabase client that manages the session in the browser. It automatically reads the session from localStorage (or a cookie) and handles token refresh in the background.

**When to use it:** In any `'use client'` component that needs to interact with Supabase — calling `supabase.auth.signInWithPassword()`, `supabase.auth.signOut()`, or reading the current user on the client side.

**Key point:** It uses the publishable key. It never has elevated permissions.

### `createServerClient()` — `packages/core/src/supabase/server.ts`

**What it does:** Creates a Supabase client that reads and writes session cookies via `next/headers` — Next.js's API for accessing cookies in Server Components and Route Handlers.

**When to use it:** In Server Components, server actions, or API Route Handlers that need to read the current user's session. For example, a protected layout that checks whether the user is logged in before rendering.

**Why the try/catch in `setAll`:** Server Components can read cookies but cannot write them — cookie mutation requires an HTTP response, and Server Components don't directly control the response headers. If a Server Component calls `setAll` (e.g. because the session token was refreshed), it would throw. The try/catch silently swallows this — the proxy handles session refresh for real, so the Server Component does not need to.

**Why it's async:** `cookies()` from `next/headers` in Next.js 15+ returns a Promise. The function must await it before constructing the client.

### `createProxyClient(request, response)` — `packages/core/src/supabase/proxy.ts`

**What it does:** A specialized Supabase client for use exclusively in `apps/web/src/proxy.ts`.

**The Edge runtime distinction:** Next.js middleware (and its successor `proxy.ts` in Next.js 16) runs in the Edge runtime — a lightweight JavaScript environment similar to a browser's Service Worker, not a full Node.js environment. The Edge runtime does not have access to Node.js APIs, including `next/headers`.

`createServerClient()` calls `cookies()` from `next/headers` — this would crash in the Edge runtime. `createProxyClient` instead accepts the incoming `NextRequest` and outgoing `NextResponse` objects directly, reads cookies from `request.cookies`, and writes updated cookies back to `response.cookies`. No `next/headers` needed.

**Never use this client outside `proxy.ts`** — it requires access to the raw request/response cycle, which only exists there.

### `createAdminClient()` — `packages/core/src/supabase/admin.ts`

**What it does:** Creates a Supabase client using the secret key. This client bypasses all Row Level Security policies — it can read and modify any user's data regardless of who is logged in.

**When to use it:** Trusted server-side operations where you need elevated permissions — creating or deleting users programmatically, accessing data across multiple users, administrative scripts.

**Never use it in browser code.** If the secret key leaks to the browser, anyone can bypass your RLS policies and access all user data. The admin client has `autoRefreshToken: false` and `persistSession: false` because it should not maintain any session — it is a one-off privileged client, not a logged-in user.

---

## The npm Packages

### `@supabase/supabase-js`

The core Supabase client library. Provides `createClient()` — the low-level constructor that all other clients are built on. Use this directly only for `createAdminClient()`. For browser and server clients, use `@supabase/ssr` instead.

### `@supabase/ssr`

Supabase's SSR-aware wrapper. Provides `createBrowserClient` and `createServerClient` (note: these are the `@supabase/ssr` functions, which our own functions of the same name wrap). The SSR package handles the session cookie management that `supabase-js` alone cannot — it knows how to read cookies in different environments. Without this package, sessions would not persist across page loads in a server-rendered app.

### `drizzle-orm`

The query builder used to construct and execute SQL queries from TypeScript. It provides:
- Schema definition with full TypeScript types
- A fluent query API (`db.select().from(profiles).where(...)`)
- SQL template literals for raw SQL when needed

Drizzle is not an ORM in the traditional sense (it does not manage object identity or lazy-load relationships). It is better described as a type-safe SQL builder. You write SQL-like queries in TypeScript and get typed results back.

### `postgres`

The PostgreSQL driver that Drizzle uses to actually send queries to the database over TCP. `drizzle-orm/postgres-js` is the Drizzle adapter for this driver. You create a `postgres(url)` connection and pass it to `drizzle()`.

Think of the layers: `postgres` opens the connection → Drizzle builds the SQL and sends it through `postgres` → results come back typed.

### `drizzle-kit`

The CLI companion to Drizzle ORM. You use it for:
- `drizzle-kit generate` — reads your schema files and generates `.sql` migration files describing the changes
- `drizzle-kit migrate` — applies those migration files to the database

`drizzle-kit` is a `devDependency` because it only runs on developer machines and in CI — never in the running application.

---

## Row Level Security (RLS) — What It Is and Why It Matters

### The problem it solves

Imagine you have a `notes` table. Every note has a `user_id` column. A normal SQL query — `SELECT * FROM notes` — returns every note from every user. You have to remember to add `WHERE user_id = $1` to every query, every time. If you forget once, you have a data leak.

Row Level Security moves that filter into the database itself. You define a policy once: "a user can only see rows where `user_id` matches the current user." After that, the database enforces it automatically on every query. You cannot accidentally forget it.

### How it works in Supabase

Supabase enables RLS on tables you create. You define policies in SQL. A policy looks like this:

```sql
CREATE POLICY "users can only access their own profiles"
ON public.profiles
USING (id::text = current_setting('app.current_user_id', true));
```

This policy says: "when querying `profiles`, only return rows where the `id` column (cast to text) matches the current setting `app.current_user_id`."

`current_setting('app.current_user_id', true)` is a PostgreSQL session variable — a value you set at the start of a query session. This is how Drizzle (which connects as the Postgres superuser, bypassing Supabase auth) can still enforce user-level access: before every query, we set this variable to the current user's ID, and the RLS policy reads it.

### What "canonical RLS policy" means

In the Supabase community, a "canonical policy" refers to the standard, well-established pattern for writing user-owns-rows policies. The canonical form is:

```sql
USING (user_id = auth.uid())
```

In Sidekick's case we use a session variable instead of `auth.uid()` because Drizzle connects directly to Postgres and does not go through Supabase's auth layer. Our "canonical" form is:

```sql
USING (id::text = current_setting('app.current_user_id', true))
```

"Canonical" just means: this is the agreed-upon, reusable pattern we apply consistently to every user-owned table. Not creative. Not one-off. The same shape every time.

### The `withRLS` helper

```ts
await withRLS(userId, async (db) => {
  return db.select().from(profiles)
})
```

`withRLS` sets the `app.current_user_id` session variable before running your query function. The `true` in `set_config('app.current_user_id', ${userId}, true)` means the setting is local to the current transaction — it is automatically cleared when the transaction ends. This prevents the user ID from leaking between requests in the connection pool.

Never set `app.current_user_id` manually inline. Always use `withRLS`.

### The `public.` prefix in trigger functions

Trigger functions execute in the schema context of the table that fired the trigger. Our profile creation trigger fires on `auth.users` — so the trigger function's schema context is `auth`. Inside the function, writing `INSERT INTO profiles` would look for `auth.profiles`, not `public.profiles`. Since `auth.profiles` does not exist, the insert would fail.

Always write `public.profiles` (fully qualified) in trigger functions that reference tables in other schemas. This is a subtle Postgres behavior that produces confusing errors if you miss it.

---

## Email Confirmation in Development

Supabase requires email confirmation by default. When testing locally, you do not want to confirm every email — this would slow development to a crawl.

To disable email confirmation:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Toggle off **"Confirm email"**

This is a development-only change. For production, re-enable email confirmation to prevent fake accounts.

---

## Hydration Mismatch with Mantine's Color Scheme

### What is a hydration mismatch?

Next.js renders pages on the server first (producing HTML), then sends that HTML to the browser and "hydrates" it — attaching React's event handlers and making it interactive. Hydration works by React rendering the component tree in the browser and comparing it to the server-rendered HTML. If they differ, React throws a hydration mismatch error.

### Why Mantine's color scheme causes it

Mantine supports light/dark/auto color schemes. In "auto" mode, Mantine reads the user's OS preference to decide which scheme to apply. The problem: this OS preference is only available in the browser, not on the server. The server renders in one color scheme; the browser may render in another. The HTML doesn't match → hydration mismatch.

### The fix: `ColorSchemeScript` + `suppressHydrationWarning`

Mantine provides `ColorSchemeScript` — a small script tag that runs before React hydrates, sets the correct color scheme in the DOM, and ensures the server and browser agree.

```tsx
// apps/web/src/app/layout.tsx
<html lang="en" suppressHydrationWarning>
  <head>
    <ColorSchemeScript defaultColorScheme="auto" />
  </head>
  <body>
    <Providers>{children}</Providers>
  </body>
</html>
```

```tsx
// apps/web/src/app/providers.tsx
<MantineProvider defaultColorScheme="auto">
```

Three things must align:
1. `ColorSchemeScript` must be in `<head>` — it injects a script that runs before React
2. `defaultColorScheme="auto"` on both `ColorSchemeScript` and `MantineProvider` — they must match
3. `suppressHydrationWarning` on the `<html>` element — tells React that the `class` attribute on `<html>` will differ between server and client (because the color scheme script modifies it), and to not treat that specific difference as an error

Without `suppressHydrationWarning`, React would see the color scheme class added by the script and error. With it, React accepts that the `<html>` element's attributes may legitimately differ.

### Other causes of hydration mismatches

Before reaching for Mantine-specific fixes, check:

- Browser extensions that modify the DOM (ad blockers, password managers) — test in an incognito window without extensions
- Dates and times rendered differently on server vs client
- Components that read `window` or `localStorage` before checking if they're in a browser context
