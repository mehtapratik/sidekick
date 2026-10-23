import 'server-only';

import { createServerClient } from '../supabase/server';

export interface SessionBasedApiCaller {
  kind: 'session';
  userId: string;
}

export interface KeyBasedApiCaller {
  kind: 'key';
  userId: string;
  keyId: string;
  scopes: readonly string[];
}

export type ApiCaller = SessionBasedApiCaller | KeyBasedApiCaller;

export async function resolveApiCaller(request: Request): Promise<ApiCaller | undefined> {
  const authHeader = request.headers.get('authorization');

  // Resolving auth header first so a limited API key can't borrow the user's session cookie,
  // which the browser attaches automatically
  if (authHeader) {
    // deny all api key/token based access until auth key table is built out in phase 9 / task 9.4
    return undefined;
  }

  const client = await createServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  return user && !error
    ? {
        kind: 'session',
        userId: user.id,
      }
    : undefined;
}
