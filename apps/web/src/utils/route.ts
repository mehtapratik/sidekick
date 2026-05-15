import { NextRequest } from 'next/server';

export function isAuthRoute(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  return pathname.startsWith('/login') || pathname.startsWith('/signup');
}

export function isApiRoute(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;

  return pathname.startsWith('/api');
}
