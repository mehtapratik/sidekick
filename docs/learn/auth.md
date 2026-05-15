# Authentication — Concepts and How Sidekick Uses It

This document explains authentication from first principles, then shows how Supabase implements it and how Sidekick's architecture builds on top of it.

---

## Authentication vs Authorization

These two words are often used interchangeably, but they mean different things:

**Authentication** (AuthN): "Who are you?" — verifying that the person or system is who they claim to be. Logging in with an email and password is authentication.

**Authorization** (AuthZ): "Are you allowed to do this?" — checking whether the authenticated identity has permission to perform a specific action. Row Level Security is authorization. Feature flags are authorization. Checking whether a user owns a note before letting them edit it is authorization.

Authentication must come first. You cannot authorize an unknown identity.

---

## How Auth Works on the Web

### The statelessness problem

HTTP is stateless — each request is independent and carries no memory of previous requests. If you log in on request 1, request 2 has no idea who you are. Some mechanism must carry identity across requests.

### Cookie-based sessions

The traditional approach: after you log in, the server creates a record in a database ("you are now session ABC123, logged in as user@example.com") and sends a cookie to the browser containing the session ID. On every subsequent request, the browser automatically sends that cookie. The server looks up the session ID and finds the associated user.

**Pros:** Easy to invalidate (delete the session record to log the user out). The session data lives on the server — you can store anything in it.

**Cons:** Every request requires a database lookup to validate the session. This is a bottleneck at scale.

### JWTs — JSON Web Tokens

A JWT is a self-contained token that encodes claims about the user (user ID, email, expiry time, scopes) and is cryptographically signed by the server. The browser stores the JWT (in a cookie or localStorage) and sends it with requests. The server validates the signature without a database lookup — the token is the proof.

**Pros:** Stateless — no database lookup per request. Scales horizontally (any server with the signing key can validate the token).

**Cons:** Cannot be truly invalidated before expiry. If a JWT is stolen and the server signs 1-hour tokens, the attacker has 1 hour of access regardless. Mitigation: short-lived access tokens + longer-lived refresh tokens (swap the refresh token for a new access token when the access token expires).

### How Supabase uses JWTs with cookies

Supabase uses JWTs internally for session representation, but stores them in cookies rather than localStorage. This gives you the best of both:
- The stateless validation of JWTs (no session database lookup)
- The automatic browser handling of cookies (sent with every request)
- HttpOnly cookies mean JavaScript cannot access the token directly (XSS protection)

The session is a pair of tokens: a short-lived **access token** (JWT, used to authenticate requests to Supabase) and a longer-lived **refresh token** (used to get a new access token when the current one expires). Supabase's client libraries handle token refresh automatically.

---

## What is OAuth?

OAuth is not an alternative to JWTs — it is a protocol that sits on top of the authentication system to allow third-party providers (Google, GitHub, etc.) to authenticate your users.

The flow looks like this:

1. User clicks "Sign in with Google"
2. Your app redirects the user to Google's auth page
3. Google authenticates the user (their problem, not yours)
4. Google redirects back to your app with a code
5. Your app exchanges that code with Google for proof of identity (who this user is)
6. Your app creates or finds the local user record and issues its own session

The key insight: OAuth does not give you the user's Google password. Google never tells you the password. Google just confirms that this person is who they say they are, and tells you their email and profile information. You then create your own session for that user.

Supabase handles steps 2–5 for you. When a user signs in with Google through Supabase, Supabase creates an entry in `auth.users` and manages the session token — your app only needs to handle the resulting session.

---

## How Supabase Auth Works in Sidekick

### The full flow from signup to protected page

```
1. User submits the signup form
   ↓
2. Browser client calls supabase.auth.signUp({ email, password })
   ↓
3. Supabase creates a row in auth.users
   ↓
4. Postgres trigger fires: public.create_profile_for_new_user()
   inserts a row in public.profiles
   ↓
5. Supabase issues an access token + refresh token
   and stores them in a session cookie
   ↓
6. useNavigation().push('/dashboard') navigates to the dashboard
   ↓
7. proxy.ts intercepts the request
   createProxyClient reads the session cookie
   supabase.auth.getUser() validates the token with Supabase
   User is authenticated → allow the request through
   ↓
8. (secure)/layout.tsx renders on the server
   createServerClient reads the session cookie via next/headers
   supabase.auth.getUser() confirms the user
   Passes the user to AppShell
   ↓
9. Dashboard renders with user data
```

### Why the session cookie is central

The session cookie is the thread that connects all of this. The browser automatically sends it on every request. `proxy.ts` reads it (via `createProxyClient`). Server Components read it (via `createServerClient`). Client Components read it (via `createBrowserClient`). The cookie is the user's identity document, passed around the application automatically.

### The proxy's role in session refresh

Supabase access tokens expire (typically after 1 hour). When they expire, the client needs to exchange the refresh token for a new access token. In a client-only app, the browser client handles this automatically. In a server-rendered app, the token might expire between requests.

`proxy.ts` (which runs on every non-static request) calls `supabase.auth.getUser()` via `createProxyClient`. This call implicitly refreshes the session if the access token is expired — and because `createProxyClient` writes the new tokens back to the response cookies, the refreshed session propagates to the browser. The user stays logged in transparently.

### Why two auth checks?

You might notice that `proxy.ts` checks authentication, and `(secure)/layout.tsx` checks it again. This is intentional.

The proxy check handles redirects — it sends unauthenticated users to `/login` before they reach any protected route. The layout check is a defense-in-depth measure: if the proxy's `config.matcher` is ever misconfigured and a route accidentally bypasses the proxy, the layout catches it. Security-critical boundaries should have redundant checks.

---

## Why We Dropped the Profile API Route

The original plan included a `POST /api/auth/profile` route that would be called after signup to create the user's profile. We dropped this in favor of a Postgres trigger.

### The problem with an API route approach

An API route would need to be:
1. Called explicitly in the client after `supabase.auth.signUp()` resolves
2. Wired up separately for every auth provider (email/password, Google OAuth, magic link)

If you add a new auth provider later and forget to wire up the profile creation call, users can authenticate but have no profile. The bug is silent — auth succeeds, but profile-dependent features break.

Additionally, if the API call fails after auth succeeds (network error, bug, deployment issue), the user exists in `auth.users` but has no profile. Partial state is harder to reason about than atomic state.

### The trigger approach

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

This trigger fires automatically on every insert into `auth.users` — regardless of how the user was created (email, OAuth, magic link, admin API). It runs in the same database transaction as the `auth.users` insert: if profile creation fails, the whole operation fails. You cannot have a user without a profile.

No API route. No per-provider code. No forgetting.

### The `public.` prefix requirement

The trigger fires on `auth.users`, so the trigger function's schema context is `auth`. Inside the function, writing `INSERT INTO profiles` would look for `auth.profiles` — which does not exist. The table must be explicitly qualified as `public.profiles`.

This is a subtle PostgreSQL behavior. Always fully qualify table names in trigger functions when those tables are in a different schema than the trigger's table.

---

## Auth Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                  │
│                                                                 │
│   ┌──────────────┐    signInWithPassword()   ┌─────────────┐   │
│   │  Login Page  │ ─────────────────────────▶│  Supabase   │   │
│   │  (use client)│ ◀─────────────────────── │  Auth API   │   │
│   └──────────────┘    session cookie set      └─────────────┘   │
│          │                                                       │
│          │  push('/dashboard')                                   │
│          ▼                                                       │
└─────────────────────────────────────────────────────────────────┘
           │
           │  HTTP GET /dashboard
           │  Cookie: sb-access-token=<jwt>; sb-refresh-token=<token>
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EDGE RUNTIME                                │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  proxy.ts                                            │      │
│   │                                                      │      │
│   │  createProxyClient(request, response)                │      │
│   │  supabase.auth.getUser()  ─────────────────────────▶ │ ──▶ Supabase
│   │                           ◀──────────────────────── │      │
│   │  if !user → redirect /login                          │      │
│   │  if user → NextResponse.next()                       │      │
│   │           (refreshed cookie written to response)     │      │
│   └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           │
           │  Request passes through
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NODE.JS RUNTIME                             │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  (secure)/layout.tsx  [Server Component]             │      │
│   │                                                      │      │
│   │  createServerClient()  (reads cookie via next/headers│      │
│   │  supabase.auth.getUser()                             │      │
│   │  if !user → redirect('/login')  [defense in depth]  │      │
│   │  if user → render <AppShell user={user}>             │      │
│   └──────────────────────────────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  dashboard/page.tsx  [Server Component]              │      │
│   │  Renders protected content                           │      │
│   └──────────────────────────────────────────────────────┘      │
│                         │                                        │
│                         ▼                                        │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  app-shell.tsx  [Client Component]                   │      │
│   │  createBrowserClient() for sign-out                  │      │
│   │  useNavigation() for post-signout redirect           │      │
│   └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           │
           │  HTML response
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                  │
│   React hydrates the server-rendered HTML                       │
│   Client components become interactive                          │
└─────────────────────────────────────────────────────────────────┘
```

### What happens on sign-out

1. `app-shell.tsx` (client component) calls `supabase.auth.signOut()` via `createBrowserClient()`
2. Supabase clears the session cookies in the browser
3. `useNavigation().push('/login')` navigates to the login page and calls `router.refresh()` to re-fetch all server components
4. `proxy.ts` intercepts the next request — no session cookie → redirect to `/login`
