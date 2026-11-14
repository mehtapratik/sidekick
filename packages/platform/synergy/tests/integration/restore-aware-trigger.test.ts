import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestAdminDb } from '@sidekick/test-utils/db';

// Proves Synergy's migrations ran (after core's) on the shared test database, and that
// synergy_block_update_on_deleted lets a restore through while refusing every other
// update to a soft-deleted row. Lesson 3 binds it to Synergy's real tables.
// - TEST_ADMIN_DATABASE_URL: postgres, the role that runs migrations and creates tables

const testAdminDb = createTestAdminDb();

afterAll(async () => {
   await testAdminDb.end();
});

describe('synergy_block_update_on_deleted', () => {
   it('exists once the migrations have run', async () => {
      const functions = await testAdminDb`
         SELECT p.proname
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'synergy_block_update_on_deleted'
      `;
      expect(functions).toHaveLength(1);
   });

   // A throwaway table with the trigger bound, the way lesson 3 binds it
   describe('on a probe table', () => {
      beforeAll(async () => {
         await testAdminDb`
            CREATE TABLE public.synergy_trigger_probe (
               id int PRIMARY KEY,
               title text NOT NULL,
               deleted_at timestamptz
            )
         `;
         await testAdminDb`
            CREATE TRIGGER no_update_deleted_synergy_trigger_probe
               BEFORE UPDATE ON public.synergy_trigger_probe
               FOR EACH ROW EXECUTE FUNCTION synergy_block_update_on_deleted()
         `;
         await testAdminDb`
            INSERT INTO public.synergy_trigger_probe (id, title, deleted_at)
            VALUES (1, 'live', NULL), (2, 'deleted', now()), (3, 'deleted', now())
         `;
      });

      afterAll(async () => {
         await testAdminDb`DROP TABLE public.synergy_trigger_probe`;
      });

      it('allows updating a live row', async () => {
         await testAdminDb`UPDATE public.synergy_trigger_probe SET title = 'edited' WHERE id = 1`;
      });

      it('refuses updating a deleted row that stays deleted', async () => {
         await expect(
            testAdminDb`UPDATE public.synergy_trigger_probe SET title = 'edited' WHERE id = 2`,
         ).rejects.toThrow('Cannot update a soft-deleted row');
      });

      it('allows restoring a deleted row', async () => {
         await testAdminDb`UPDATE public.synergy_trigger_probe SET deleted_at = NULL WHERE id = 2`;
      });

      it('refuses a restore that also changes other columns', async () => {
         await expect(
            testAdminDb`UPDATE public.synergy_trigger_probe SET deleted_at = NULL, title = 'edited' WHERE id = 3`,
         ).rejects.toThrow('may change only deleted_at');
      });
   });
});
