import 'server-only';

import { createServerClient } from '../supabase/server';

/** A caller signed in through a Supabase session cookie */
export interface SessionBasedApiCaller {
   kind: 'session';
   /** The signed-in user's id */
   userId: string;
}

/** A caller using an API key, limited to the key's scopes */
export interface KeyBasedApiCaller {
   kind: 'key';
   /** The id of the user who owns the key */
   userId: string;
   /** The id of the API key the request used */
   keyId: string;
   /** What the key is allowed to do, such as `notes:read` */
   scopes: readonly string[];
}

/** Who is calling an API route: a signed-in session or an API key */
export type ApiCaller = SessionBasedApiCaller | KeyBasedApiCaller;

/** Works out who is calling from the request, or `undefined` when nobody is authenticated */
export async function resolveApiCaller(
   request: Request,
): Promise<ApiCaller | undefined> {
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
