import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '@sidekick/core/db/schema';

export type PrivilegedDb = PostgresJsDatabase<typeof schema>;

export type PrivilegedDbHandler<T> = (db: PrivilegedDb) => Promise<T>;

// Runs fn on a connection as the privileged role (DATABASE_DIRECT_URL: postgres,
// bypasses RLS), then closes it. Only ops scripts use this role; the app never does.
export async function withPrivilegedDb<T>(
   fn: PrivilegedDbHandler<T>,
): Promise<T> {
   const url = process.env.DATABASE_DIRECT_URL;

   if (!url) {
      throw new Error(
         'Missing DATABASE_DIRECT_URL. Set it in the root .env.local (see .env.example).',
      );
   }

   // Supavisor session mode (port 5432) keeps one Postgres connection per client,
   // so prepared statements work and a script needs only one connection.
   const client = postgres(url, { max: 1 });

   try {
      return await fn(drizzle(client, { schema }));
   } finally {
      await client.end();
   }
}
