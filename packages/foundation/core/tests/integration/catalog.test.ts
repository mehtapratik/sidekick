import { afterAll, describe, expect, it } from 'vitest';

import { createTestAdminDb } from '@sidekick/test-utils/db';

// Reads Postgres's own catalog to check that every table carries the RLS and
// triggers its delete model needs (D264). Every package migrates into this
// one test database, so it sees every table, whichever package owns it. It
// catches what a review would miss: a forgotten FORCE, trigger or policy
// term on a new table. Runs inside pnpm test:integration.

/** The four delete models in Delete Models (D264) */
type DeleteModel =
   'hard delete' | 'tombstones hidden' | 'tombstones visible' | 'append-only';

/**
 * Every table in the database and its delete model, mirroring the table list
 * in Delete Models. A new table fails the inventory test until it's added here
 * (and there).
 */
const TABLES: Readonly<Record<string, DeleteModel>> = {
   profiles: 'hard delete',
   user_feature_entitlements: 'hard delete',
   entity_index: 'tombstones visible',
   version_log: 'append-only',
   outbox: 'hard delete',
   relation_types: 'hard delete',
   sandbox_notes: 'tombstones hidden',
   sandbox_tasks: 'tombstones hidden',
};

const testAdminDb = createTestAdminDb();

afterAll(async () => {
   await testAdminDb.end();
});

/**
 * Every table in the public schema, except the throwaway `*_probe` tables
 * other packages' tests create and drop while this one runs in parallel
 */
async function publicTables(): Promise<string[]> {
   const rows = await testAdminDb<{ name: string }[]>`
      SELECT relname AS name
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
         AND relkind = 'r'
         AND relname NOT LIKE '%\_probe'
      ORDER BY relname`;
   return rows.map(({ name }) => name);
}

/** A table's RLS flags, the functions its triggers call and its policies' USING terms */
async function security(table: string) {
   const [flags] = await testAdminDb<{ enabled: boolean; forced: boolean }[]>`
      SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class
      WHERE oid = ${`public.${table}`}::regclass`;
   const triggers = await testAdminDb<{ fn: string }[]>`
      SELECT p.proname AS fn
      FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE t.tgrelid = ${`public.${table}`}::regclass AND NOT t.tgisinternal`;
   const policies = await testAdminDb<{ using: string }[]>`
      SELECT qual AS using
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ${table}
      -- An INSERT-only policy has no USING term (the outbox's)
      AND qual IS NOT NULL`;
   const [privileges] = await testAdminDb<
      { canUpdate: boolean; canDelete: boolean }[]
   >`
      SELECT
         has_table_privilege('app_runtime', ${`public.${table}`}, 'UPDATE') AS "canUpdate",
         has_table_privilege('app_runtime', ${`public.${table}`}, 'DELETE') AS "canDelete"`;

   return {
      ...flags,
      triggerFunctions: triggers.map(({ fn }) => fn),
      policyUsing: policies.map(({ using }) => using),
      ...privileges,
   };
}

describe('the database catalog', () => {
   it('lists every table with its delete model', async () => {
      expect(await publicTables()).toEqual(Object.keys(TABLES).sort());
   });

   describe.each(Object.entries(TABLES))('%s (%s)', (table, model) => {
      it('has row-level security enabled and forced', async () => {
         const { enabled, forced } = await security(table);

         expect(enabled).toBe(true);
         expect(forced).toBe(true);
      });

      it('has the triggers and policy its delete model needs', async () => {
         const { triggerFunctions, policyUsing, canUpdate, canDelete } =
            await security(table);
         const hidesTombstones = policyUsing.some((using) =>
            using.includes('deleted_at IS NULL'),
         );

         switch (model) {
            case 'hard delete':
               expect(triggerFunctions).not.toContain('enforce_soft_delete');
               break;
            case 'tombstones hidden':
               expect(triggerFunctions).toContain('enforce_soft_delete');
               expect(triggerFunctions).toContain('block_update_on_deleted');
               expect(hidesTombstones).toBe(true);
               break;
            case 'tombstones visible':
               expect(triggerFunctions).toContain('enforce_soft_delete');
               // A restore-aware update trigger, never core's, which refuses restores
               expect(triggerFunctions).not.toContain(
                  'block_update_on_deleted',
               );
               expect(hidesTombstones).toBe(false);
               break;
            case 'append-only':
               expect(triggerFunctions).toContain('enforce_soft_delete');
               expect(canUpdate).toBe(false);
               expect(canDelete).toBe(false);
               break;
         }
      });
   });
});
