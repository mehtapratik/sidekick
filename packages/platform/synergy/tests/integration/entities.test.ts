import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { entityIndex, versionLog } from '../../src/db/schema';
import {
   getEntity,
   registerEntity,
   saveEntityContent,
   type Actor,
} from '../../src/repository/entities';

// Proves Synergy's repository, RLS and triggers on entity_index and version_log,
// as app_runtime through withRLS: the path a provider takes. Runs inside
// pnpm test:integration, which builds a fresh database from every package's
// migrations and exports these connection URLs:
// - DATABASE_URL: app_runtime, the role withRLS uses
// - TEST_AUTH_DATABASE_URL: supabase_auth_admin, which creates users the way
//   Supabase Auth does (core's trigger then creates their profiles)

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const userA = randomUUID();
const userB = randomUUID();
const actorA: Actor = { kind: 'human', id: userA };

beforeAll(async () => {
   await testAuthDb`INSERT INTO auth.users
      (id, email)
   VALUES
      (${userA}, 'a@example.com'),
      (${userB}, 'b@example.com')
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

// Drizzle wraps a database error ("Failed query: …"); the trigger's message is
// on its cause.
function databaseError(message: string) {
   return {
      cause: expect.objectContaining({
         message: expect.stringContaining(message),
      }),
   };
}

// Registers a fresh entity for userA and returns its id
async function newEntity(): Promise<string> {
   const id = randomUUID();
   await withRLS(userA, (tx) =>
      registerEntity(tx, {
         id,
         provider: 'sandbox-notes',
         type: 'note',
         displayName: 'A note',
         actor: actorA,
      }),
   );
   return id;
}

describe('registerEntity and saveEntityContent', () => {
   it('registers an entity and saves it twice', async () => {
      const id = await newEntity();

      const first = await withRLS(userA, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'revision',
            displayName: 'A note',
            actor: actorA,
         }),
      );
      const second = await withRLS(userA, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: first.contentSeq,
            bump: 'revision',
            displayName: 'A note, renamed',
            actor: actorA,
         }),
      );

      expect(second).toMatchObject({
         version: 1,
         revision: 2,
         contentSeq: 2,
         displayName: 'A note, renamed',
      });
   });

   it('refuses a save from a stale content_seq with stale_content', async () => {
      const id = await newEntity();
      const save = (baselineContentSeq: number) =>
         withRLS(userA, (tx) =>
            saveEntityContent(tx, {
               id,
               baselineContentSeq,
               bump: 'revision',
               displayName: 'A note',
               actor: actorA,
            }),
         );

      // Two tabs opened the note at content_seq 0; the first one saves
      await save(0);

      await expect(save(0)).rejects.toMatchObject({ code: 'stale_content' });
   });

   it('logs a version save and leaves revision alone', async () => {
      const id = await newEntity();

      const saved = await withRLS(userA, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'version',
            changeNote: 'Reworded the rule',
            displayName: 'A note',
            actor: actorA,
         }),
      );
      const log = await withRLS(userA, (tx) =>
         tx.select().from(versionLog).where(eq(versionLog.entityId, id)),
      );

      expect(saved).toMatchObject({ version: 2, revision: 0, contentSeq: 1 });
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
         version: 2,
         changeNote: 'Reworded the rule',
      });
   });
});

describe('RLS', () => {
   it("hides another user's entity", async () => {
      const id = await newEntity();

      const seenByB = await withRLS(userB, (tx) =>
         getEntity(tx, id, { includeDeleted: true }),
      );
      const savedByB = withRLS(userB, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'revision',
            displayName: 'Taken over',
            actor: { kind: 'human', id: userB },
         }),
      );

      expect(seenByB).toBeUndefined();
      await expect(savedByB).rejects.toMatchObject({ code: 'not_found' });
   });
});

describe('soft delete', () => {
   // The repository has no delete or restore until lesson 11, so these tests
   // write the rows directly, still as app_runtime under RLS.
   async function softDelete(id: string): Promise<void> {
      await withRLS(userA, (tx) =>
         tx
            .update(entityIndex)
            .set({ deletedAt: new Date() })
            .where(eq(entityIndex.id, id)),
      );
   }

   it('refuses a hard delete', async () => {
      const id = await newEntity();

      await expect(
         withRLS(userA, (tx) =>
            tx.delete(entityIndex).where(eq(entityIndex.id, id)),
         ),
      ).rejects.toMatchObject(databaseError('Hard deletes are prohibited'));
   });

   it('keeps a tombstone visible only when asked', async () => {
      const id = await newEntity();
      await softDelete(id);

      const live = await withRLS(userA, (tx) =>
         getEntity(tx, id, { includeDeleted: false }),
      );
      const tombstone = await withRLS(userA, (tx) =>
         getEntity(tx, id, { includeDeleted: true }),
      );

      expect(live).toBeUndefined();
      expect(tombstone?.deletedAt).not.toBeNull();
   });

   it('can restore a deleted row but not otherwise update it', async () => {
      const id = await newEntity();
      await softDelete(id);

      await expect(
         withRLS(userA, (tx) =>
            tx
               .update(entityIndex)
               .set({ title: 'Edited while deleted' })
               .where(eq(entityIndex.id, id)),
         ),
      ).rejects.toMatchObject(
         databaseError('Cannot update a soft-deleted row'),
      );
      await expect(
         withRLS(userA, (tx) =>
            tx
               .update(entityIndex)
               .set({ deletedAt: null, title: 'Edited while restoring' })
               .where(eq(entityIndex.id, id)),
         ),
      ).rejects.toMatchObject(databaseError('may change only deleted_at'));

      await withRLS(userA, (tx) =>
         tx
            .update(entityIndex)
            .set({ deletedAt: null })
            .where(eq(entityIndex.id, id)),
      );
      const restored = await withRLS(userA, (tx) =>
         getEntity(tx, id, { includeDeleted: false }),
      );

      expect(restored?.id).toBe(id);
   });

   it('refuses saving content to a deleted entity with not_found', async () => {
      const id = await newEntity();
      await softDelete(id);

      await expect(
         withRLS(userA, (tx) =>
            saveEntityContent(tx, {
               id,
               baselineContentSeq: 0,
               bump: 'revision',
               displayName: 'A note',
               actor: actorA,
            }),
         ),
      ).rejects.toMatchObject({ code: 'not_found' });
   });
});
describe('version_log is append-only', () => {
   // A version save writes one log row; returns that row's id
   async function newLogRow(): Promise<string> {
      const entityId = await newEntity();
      await withRLS(userA, (tx) =>
         saveEntityContent(tx, {
            id: entityId,
            baselineContentSeq: 0,
            bump: 'version',
            changeNote: 'Reworded the rule',
            displayName: 'A note',
            actor: actorA,
         }),
      );
      const [row] = await withRLS(userA, (tx) =>
         tx
            .select({ id: versionLog.id })
            .from(versionLog)
            .where(eq(versionLog.entityId, entityId)),
      );
      return row.id;
   }

   it('refuses the app updating or deleting a log row', async () => {
      const id = await newLogRow();

      await expect(
         withRLS(userA, (tx) =>
            tx
               .update(versionLog)
               .set({ changeNote: 'Rewritten' })
               .where(eq(versionLog.id, id)),
         ),
      ).rejects.toMatchObject(databaseError('permission denied'));
      await expect(
         withRLS(userA, (tx) =>
            tx.delete(versionLog).where(eq(versionLog.id, id)),
         ),
      ).rejects.toMatchObject(databaseError('permission denied'));
   });

   it('refuses any role updating a log row, and deleting one outside erasure', async () => {
      const id = await newLogRow();

      await expect(
         testAdminDb`UPDATE version_log SET change_note = 'Rewritten' WHERE id = ${id}`,
      ).rejects.toThrow('append-only');
      await expect(
         testAdminDb`DELETE FROM version_log WHERE id = ${id}`,
      ).rejects.toThrow('Hard deletes are prohibited');
   });
});
