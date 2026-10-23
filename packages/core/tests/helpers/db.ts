import postgres, { type Sql } from 'postgres';

// Connections to the throwaway database tests/with-test-db.sh builds from our migrations.
// Each factory opens a new single-connection client; the test file that creates it ends it
// in afterAll, so every file owns its connections' lifecycle.

/** Reads a connection URL tests/with-test-db.sh exports; fails loudly when run outside it */
export function requireTestEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set; run this test through tests/with-test-db.sh`);
  }

  return value;
}

/** supabase_auth_admin: creates and deletes users the way Supabase Auth does */
export function createTestAuthDb(): Sql {
  return postgres(requireTestEnv('TEST_AUTH_DATABASE_URL'), { max: 1 });
}

/** postgres: the privileged migration/seed role, the only one that writes entitlements */
export function createTestAdminDb(): Sql {
  return postgres(requireTestEnv('TEST_ADMIN_DATABASE_URL'), { max: 1 });
}

/** app_runtime: the role withRLS uses for every user request */
export function createTestRuntimeDb(): Sql {
  return postgres(requireTestEnv('DATABASE_URL'), { max: 1 });
}
