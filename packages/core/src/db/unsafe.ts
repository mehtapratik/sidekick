import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('Missing DATABASE_URL environment variable');
}

// DATABASE_URL points at Supavisor in transaction mode (port 6543), which does
// not keep you on one Postgres connection between transactions, so named
// prepared statements must be off (Supabase requirement).
// Do NOT set max_pipeline: 0 — postgres.js then never reserves a connection
// for a transaction, and every transaction (including withRLS) fails with
// UNSAFE_TRANSACTION. Caught by tests/integration/rls.test.ts.
const client = postgres(url, { prepare: false });

// UNSAFE: queries on this client run without a user context. As app_runtime
// they fail closed (RLS returns zero rows), but nothing ties them to a caller.
// Only for building safe wrappers such as withRLS — ESLint enforces this, and
// the package `exports` map deliberately does not expose this file.
export const unsafeDb = drizzle(client, { schema });
