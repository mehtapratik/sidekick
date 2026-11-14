import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createProxyClient } from '@sidekick/core/supabase/proxy';

import { isApiRoute, isAuthRoute } from './utils/route';

/** Runs before every matched request: refreshes the Supabase session and redirects pages by sign-in state; API routes pass through to withApiGuard */
export async function proxy(request: NextRequest): Promise<NextResponse> {
   const supabaseResponse = NextResponse.next({ request });

   const supabase = createProxyClient(request, supabaseResponse);

   const {
      data: { user },
   } = await supabase.auth.getUser();

   // Do not authenticate API routes here
   if (isApiRoute(request)) {
      return supabaseResponse;
   }

   // Redirect unauthenticated users to login page
   if (!user && !isAuthRoute(request)) {
      return NextResponse.redirect(new URL('/login', request.url));
   }

   // Redirect authenticated users to dashboard
   if (user && isAuthRoute(request)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
   }

   return supabaseResponse;
}

/** Paths the proxy runs on: everything except Next.js static assets and the favicon */
export const config = {
   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
