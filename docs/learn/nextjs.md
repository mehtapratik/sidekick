# Next.js — App Router Concepts

This document covers the Next.js App Router patterns that come up repeatedly in Sidekick. It focuses on the "why" behind each concept, not just the "what".

---

## Server Components and Client Components — The Core Mental Model

Next.js App Router introduces a split that does not exist in older React apps: components can render on the server (once, at request time) or on the client (continuously, with state and interactivity). This is not just an optimisation — it changes what APIs are available to a component.

### Server Components (the default)

Every component in the App Router is a Server Component by default unless you add `'use client'` at the top.

Server Components:
- Run on the server, once per request
- Can be `async` — they can `await` database queries, API calls, file reads directly
- Have access to server-only APIs: `cookies()`, `headers()`, environment variables that start without `NEXT_PUBLIC_`
- **Cannot** use React state (`useState`), effects (`useEffect`), or event handlers (`onClick`)
- **Cannot** use React Context (Context is a client-side mechanism)
- **Cannot** use browser APIs (`window`, `document`, `localStorage`)

Server Components produce HTML that is streamed to the browser. They do not ship JavaScript to the client — only the rendered output.

### Client Components (`'use client'`)

Adding `'use client'` at the top of a file marks it and all its transitive imports as client-side code. Client Components:
- Are bundled into JavaScript and sent to the browser
- Can use all React hooks: `useState`, `useEffect`, `useRef`, `useContext`, etc.
- Can attach DOM event handlers: `onClick`, `onChange`, `onSubmit`
- Can use browser APIs
- **Cannot** directly `await` database queries or use server-only APIs
- **Are also** rendered on the server on the first request (for the initial HTML), then hydrated in the browser — this is why hydration mismatches matter

### Choosing between them

Use a **Server Component** when:
- The component fetches data (reads from a database, calls an API)
- The component only renders — no interaction, no state
- The component uses cookies, headers, or environment secrets

Use a **Client Component** when:
- The component uses `useState` or `useEffect`
- The component handles user input (`onChange`, `onClick`, `onSubmit`)
- The component uses React Context
- The component uses a third-party library that requires browser APIs (Mantine's `MantineProvider`, for example)
- The component uses custom hooks that wrap any of the above

The rule of thumb: **push `'use client'` as far down the component tree as possible.** The more of your tree that stays as Server Components, the less JavaScript you ship to the browser, and the more data-fetching you can do without an API layer.

### Things that do not work in Server Components

| Feature | Available in Server Components? | Notes |
|---|---|---|
| `useState` | ❌ | Use server state (props from layout/page) |
| `useEffect` | ❌ | Run side effects in API routes or server actions |
| `useContext` / `createContext` | ❌ | Context is client-only |
| `useRef` | ❌ | No DOM in server render |
| `onClick`, `onChange` | ❌ | No browser events |
| `window`, `document` | ❌ | No browser globals |
| `localStorage`, `sessionStorage` | ❌ | Browser storage only |
| `async/await` at the component level | ✅ | Server Components can be async |
| `cookies()`, `headers()` | ✅ | Server-only APIs |
| Direct database queries via Drizzle | ✅ | Server-only |
| `fetch()` | ✅ (but different behaviour) | Server fetch is deduped and cached by Next.js |

---

## Why `MantineProvider` Needs `'use client'`

`MantineProvider` uses React Context internally to share theme data across all Mantine components. React Context is a client-side mechanism — it lives in the browser's JavaScript runtime, not in the server's render.

If you import `MantineProvider` in a Server Component, Next.js would try to render it on the server, hit the `createContext()` call, and error — because context doesn't exist in the server render environment.

The solution is `apps/web/src/app/providers.tsx`:

```tsx
'use client'
import { MantineProvider } from '@mantine/core'
// ...

export function Providers({ children }: { children: React.ReactNode }) {
  return <MantineProvider defaultColorScheme="auto">...</MantineProvider>
}
```

This file is a Client Component. The root layout (`layout.tsx`) — a Server Component — imports and renders `<Providers>`. This is the standard pattern: a thin Client Component wrapper at the root that provides context to everything below it.

**Important:** the `children` passed to `Providers` can still be Server Components. React allows Server Components to be children of Client Components as long as they are passed as props (not imported directly inside the Client Component). The composition flows downward; the server/client boundary is at the import level, not the render level.

---

## `'use client'` and the Supabase Clients

The correct Supabase client depends on where the component runs:

| Where | Client to use | Why |
|---|---|---|
| `'use client'` component | `createBrowserClient()` | Runs in browser; manages session via cookies/storage |
| Server Component or Route Handler | `createServerClient()` | Runs on server; reads session from `next/headers` cookies |
| `proxy.ts` (Edge runtime) | `createProxyClient(req, res)` | Edge doesn't have `next/headers`; reads from raw request |
| Trusted server operation | `createAdminClient()` | Bypasses RLS; server-only |

Using the wrong client causes failures:
- `createServerClient()` in a Client Component → crashes because `next/headers` is Node.js-only
- `createBrowserClient()` in a Server Component → doesn't read session cookies correctly

---

## Route Groups — `(auth)` and `(app)`

Folders wrapped in parentheses — like `(auth)` and `(app)` — are **route groups**. They let you group related routes and apply a shared layout without the folder name appearing in the URL.

```
app/
  (auth)/
    login/
      page.tsx      → URL: /login
    signup/
      page.tsx      → URL: /signup
    layout.tsx      → Shared layout for /login and /signup
  (app)/
    dashboard/
      page.tsx      → URL: /dashboard
    layout.tsx      → Shared layout for /dashboard (and future app routes)
```

The `(auth)` and `(app)` folder names have **no special meaning to Next.js**. They are purely organisational. Next.js only uses them to determine which `layout.tsx` to apply. The parentheses just signal "this is a grouping, not a URL segment."

You could name them `(public)` and `(private)`, or `(unauthenticated)` and `(authenticated)` — Next.js does not care. The convention of `(auth)` and `(app)` is human-readable shorthand.

### Why use route groups at all?

Without route groups, you'd have to put all pages under the same root `layout.tsx`. With route groups, you can give `/login` and `/signup` a centred, minimal layout (no sidebar, no header) while `/dashboard` gets the full app shell (header, navigation sidebar).

---

## `redirect()` vs `router.push()`

Both navigate the user to a different URL, but they work differently and live in different contexts.

### `redirect()` — server-side, from `next/navigation`

```ts
import { redirect } from 'next/navigation'

// In a Server Component or Route Handler:
if (!user) redirect('/login')
```

- Runs on the **server** during the render or handler execution
- Throws a Next.js-internal exception that Next.js catches and converts into an HTTP redirect response (301/302)
- The browser never receives the protected page's HTML — the redirect happens before any content is sent
- Cannot be called from Client Components

### `router.push()` — client-side, from `useRouter`

```ts
import { useRouter } from 'next/navigation'

// In a Client Component:
const router = useRouter()
router.push('/dashboard')
```

- Runs in the **browser**
- Performs a client-side navigation — updates the URL and renders the new page without a full browser reload
- Must be paired with `router.refresh()` after auth actions to flush the server-rendered cache

### `useNavigation()` — Sidekick's wrapper

```ts
const { push } = useNavigation()
push('/dashboard')
```

Always use `useNavigation()` instead of `router.push()` directly in Sidekick. The hook calls `router.push()` + `router.refresh()` together. Forgetting `router.refresh()` after a sign-in or sign-out leaves the UI in stale server-rendered state — the header might still show "Sign in" even though you just signed up.

### When to use which

| Scenario | Use |
|---|---|
| Redirecting unauthenticated users in a Server Component | `redirect()` |
| Navigating after a form submission in a Client Component | `useNavigation()` |
| Redirecting in a Route Handler | `redirect()` or `NextResponse.redirect()` |
| Proxy/middleware redirects | `NextResponse.redirect()` |

---

## The Double Auth Check — Why Two Places?

Authentication is checked in two places in Sidekick:

1. **`proxy.ts`** — redirects unauthenticated users before any page renders
2. **`(app)/layout.tsx`** — reads the user again and redirects if somehow not authenticated

This feels redundant. Here is why both exist:

### The middleware check is fast but not guaranteed

`proxy.ts` runs in the Edge runtime on every request. If the user is not authenticated, they get redirected to `/login` before any page code runs. This is efficient — you save the cost of rendering the page entirely.

However, middleware can be bypassed. A misconfigured `matcher` pattern, a future route that slips through, or a direct function-level access (from a server action, a cron job, a webhook handler) could reach the layout without going through the middleware.

### The layout check is the real security boundary

The `(app)/layout.tsx` check runs inside Next.js's rendering pipeline — not at the edge. It has access to the full Supabase server client and can verify the JWT with Supabase's servers. This is the authoritative check.

```ts
// (app)/layout.tsx
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
```

### The pattern: defense in depth

The proxy is an optimisation (save a round-trip render for clearly unauthenticated users). The layout is the actual enforcement. If the proxy disappears tomorrow, the layout still protects the page. If the layout is accidentally removed, the proxy still turns away unauthenticated requests.

This is the defense-in-depth principle: do not rely on a single checkpoint. Each layer is independently correct.

---

## How Next.js Handles a Mixed Server/Client Component Tree

When you request a page, Next.js does the following:

1. **Server render pass:** Starting from the root layout, Next.js renders the component tree on the server. Server Components render to React Server Component (RSC) payload — a serialised description of the UI. Client Components are rendered to their initial HTML on the server too (for the first load), but their code is also bundled for the browser.

2. **HTML response:** The server sends the initial HTML to the browser. The user sees content immediately (no JavaScript needed for the first paint).

3. **Hydration:** The browser downloads the Client Component JavaScript bundles. React "hydrates" the Client Components — attaches event listeners and makes them interactive — without re-rendering the Server Component parts.

4. **Subsequent navigations:** After the initial load, Next.js performs client-side navigations. It fetches the new route's RSC payload from the server (a lightweight JSON-like format, not full HTML) and merges it into the current page. Server Components re-render on the server; Client Components update in the browser.

### The serialisation boundary

When a Server Component passes data to a Client Component via props, that data crosses the serialisation boundary. It is serialised on the server and deserialised in the browser. This means:

- ✅ Plain objects, strings, numbers, booleans — safe to pass
- ✅ Arrays of the above — safe to pass
- ✅ `null` and `undefined` — safe to pass
- ❌ Functions — cannot be serialised (use server actions for callbacks)
- ❌ Class instances — cannot be serialised
- ❌ `Date` objects — serialise to strings; use timestamps or ISO strings
- ❌ `Map`, `Set` — not serialisable; convert to arrays/objects

The `User` object from Supabase is a plain object (it comes from JSON deserialization) — it crosses the boundary fine.

### You cannot import a Server Component inside a Client Component

```tsx
// ❌ Wrong — MyServerComponent is a Server Component
'use client'
import MyServerComponent from './MyServerComponent'

export function MyClientComponent() {
  return <MyServerComponent />  // This breaks — Next.js cannot render a Server Component inside a Client Component at import time
}
```

```tsx
// ✅ Correct — pass Server Components as children
'use client'
export function MyClientComponent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

// In the parent Server Component:
<MyClientComponent>
  <MyServerComponent />
</MyClientComponent>
```

The distinction: importing a Server Component into a Client Component pulls it into the client bundle, which Next.js prevents. Passing it as `children` keeps the Server Component in the server's render pass — it is rendered on the server and its output is passed to the Client Component as already-rendered content.

### Server Components do not share in-memory state

Each request triggers a fresh server render. There are no singletons, no shared variables between requests, no in-memory cache that persists between users. If you set a variable in a Server Component, it exists only for that render and is gone when the response is sent.

This is different from traditional server frameworks where you might accidentally share state across requests. In Next.js App Router, the model is explicit: server state lives in a database or cache (Redis, etc.), not in memory.

---

## `export const dynamic = 'force-dynamic'`

Next.js tries to statically pre-render pages at build time wherever possible. Static pages are fast — they are generated once and served from the CDN without invoking a serverless function.

However, some pages **cannot** be pre-rendered statically because their content depends on the current user's session or request-time data. Next.js needs a hint that these pages must always be rendered dynamically (per request).

```ts
export const dynamic = 'force-dynamic'
```

This export, placed in a `page.tsx` or `layout.tsx`, tells Next.js: "this route must always be rendered at request time, never statically pre-rendered."

### When it is required

Any page or layout that:
- Calls `cookies()` from `next/headers`
- Calls `headers()` from `next/headers`
- Uses `createServerClient()` (which calls `cookies()` internally)
- Reads authentication state from the session

If you forget `force-dynamic` on a Supabase-touching layout, Next.js will try to pre-render it at build time. The build will fail with an error like: "Dynamic server usage: cookies were read in a component that opted out of dynamic rendering."

### Which pages can be purely static

A page is safe to be statically pre-rendered if it:
- Does not read cookies or headers
- Does not call `createServerClient()` or any other session-aware function
- Shows the same content to every user (marketing pages, blog posts, legal pages)

Examples in Sidekick that would be static (if they existed):
- A `/pricing` page with hardcoded plans
- A `/about` page with company information
- A `/blog/[slug]` page that reads from a CMS (as long as it doesn't personalise content per user)

For these pages, omit `force-dynamic` and let Next.js pre-render them at build time. They will be served from the CDN edge, with zero serverless function invocations.

### The `(app)` and `(auth)` layouts

Both route group layouts touch Supabase:
- `(auth)/layout.tsx` — even though it doesn't check auth itself, it wraps pages that create a browser Supabase client, and the `force-dynamic` ensures Next.js doesn't attempt a broken static render
- `(app)/layout.tsx` — calls `createServerClient()` to check the user session

Both need `export const dynamic = 'force-dynamic'`. Setting it on the layout propagates to all child pages in that route group — the child pages inherit the layout's dynamic behaviour and do not need the export themselves (though adding it explicitly is not wrong).
