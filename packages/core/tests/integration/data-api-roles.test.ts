import { afterAll, describe, expect, it } from 'vitest';

import { createTestAdminDb } from '../helpers/db';

// Proves that Supabase's Data API roles hold no privileges on our tables, now or for
// tables created later. Runs inside tests/with-test-db.sh, whose Supabase stand-ins give
// anon and authenticated the same default privileges as the live project.
// - TEST_ADMIN_DATABASE_URL: postgres, the role that runs migrations and creates tables

const testAdminDb = createTestAdminDb();

const DATA_API_ROLES = ['anon', 'authenticated'];
const TABLE_PRIVILEGES = 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER';

// Every role/table pair in public where the role holds at least one table privilege
async function grantsInPublic() {
  return testAdminDb`
    SELECT r.role, c.relname AS table
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(${DATA_API_ROLES}::text[]) AS r(role)
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND has_table_privilege(r.role, c.oid, ${TABLE_PRIVILEGES})
  `;
}

afterAll(async () => {
  await testAdminDb.end();
});

describe('Data API roles', () => {
  it('hold no privileges on existing tables', async () => {
    expect(await grantsInPublic()).toEqual([]);
  });

  it('cannot execute any function in public', async () => {
    const executable = await testAdminDb`
      SELECT r.role, p.proname AS function
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN unnest(${DATA_API_ROLES}::text[]) AS r(role)
      WHERE n.nspname = 'public' AND has_function_privilege(r.role, p.oid, 'EXECUTE')
    `;
    expect(executable).toEqual([]);
  });

  it('get no privileges on a table postgres creates later', async () => {
    await testAdminDb`CREATE TABLE public.default_privileges_probe (id int)`;
    try {
      const rows = await testAdminDb`
        SELECT has_table_privilege(r.role, 'public.default_privileges_probe', ${TABLE_PRIVILEGES}) AS granted
        FROM unnest(${DATA_API_ROLES}::text[]) AS r(role)
      `;
      expect(rows.map(({ granted }) => granted)).toEqual([false, false]);
    } finally {
      await testAdminDb`DROP TABLE public.default_privileges_probe`;
    }
  });
});
