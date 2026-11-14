import type { NextRequest } from 'next/server';

/** Whether the request is for the sign-in or sign-up pages */
export function isAuthRoute(request: NextRequest): boolean {
   const { pathname } = request.nextUrl;

   return pathname.startsWith('/login') || pathname.startsWith('/signup');
}

/** Whether the request is for an API route */
export function isApiRoute(request: NextRequest): boolean {
   const { pathname } = request.nextUrl;

   return pathname.startsWith('/api');
}
