---
id: plan.phase-1.task-1-11
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-1
   - task
   - api-guard
   - rls
   - supabase
   - api
   - authentication
   - nextjs
status: completed
---

**What middleware does (and doesn't do):**

- ✅ Refreshes the Supabase session (rotates tokens before they expire)
- ✅ Redirects unauthenticated users from protected routes to `/login`
- ✅ Redirects authenticated users away from `/login` and `/signup` to `/dashboard`
- ❌ Does NOT run business authorization logic — that belongs in `withApiGuard()` (Phase 2)

```typescript
// apps/web/src/middleware.ts
import { createServerClient } from "@sidekick/core/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
   let supabaseResponse = NextResponse.next({ request });

   const supabase = await createServerClient();
   const {
      data: { user },
   } = await supabase.auth.getUser();

   const { pathname } = request.nextUrl;
   const isAuthRoute =
      pathname.startsWith("/login") || pathname.startsWith("/signup");
   const isApiRoute = pathname.startsWith("/api");

   // Don't redirect API routes — they handle their own auth
   if (isApiRoute) return supabaseResponse;

   // Redirect unauthenticated users to login
   if (!user && !isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
   }

   // Redirect authenticated users away from auth pages
   if (user && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
   }

   return supabaseResponse;
}

export const config = {
   matcher: [
      // Run middleware on all routes except static files and Next.js internals
      "/((?!_next/static|_next/image|favicon.ico).*)",
   ],
};
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
