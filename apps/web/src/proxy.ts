import { NextRequest, NextResponse } from 'next/server';

import { createProxyClient } from '@sidekick/core/supabase/proxy';

import { isApiRoute, isAuthRoute } from './utils/route';

export async function proxy(request: NextRequest) {
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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
