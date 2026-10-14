import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('Missing DATABASE_URL environment variable');
}

// DATABASE_URL points at Supavisor in transaction mode (port 6543), which
// does not keep you on one Postgres connection between transactions:
// - prepare: false  → no named prepared statements tied to one backend
// - max_pipeline: 0 → never queue queries on a busy connection
// max_pipeline is a real runtime option but missing from postgres.js types,
// so the options object is typed explicitly instead of passed inline.
type PoolerOptions = postgres.Options<Record<string, postgres.PostgresType>> & {
  max_pipeline: number;
};

const poolerOptions: PoolerOptions = {
  max_pipeline: 0,
  prepare: false,
};

const client = postgres(url, poolerOptions);

export const db = drizzle(client, { schema });
