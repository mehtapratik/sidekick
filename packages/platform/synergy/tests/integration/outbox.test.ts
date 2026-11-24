import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { outbox } from '../../src/db/schema';
import type { Actor } from '../../src/repository/actor';
import {
   registerEntity,
   saveEntityContent,
   setEntityStatus,
} from '../../src/repository/entities';

// Proves the outbox: every Synergy write leaves exactly its events, in the
// order they happened, in the same transaction as the write. Reads the outbox
// as postgres, because app_runtime may not (the last test proves it).

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const user = randomUUID();
const actor: Actor = { kind: 'human', id: user };

beforeAll(async () => {
   await testAuthDb`INSERT INTO auth.users (id, email) VALUES (${user}, 'outbox@example.com')`;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

/** One event as the tests compare it */
interface StoredEvent {
   kind: string;
   payload: unknown;
   xactId: string;
   actorKind: string;
   actorId: string | null;
}

/** The entity's events in the order a reader would process them */
async function eventsOf(subjectId: string): Promise<StoredEvent[]> {
   return testAdminDb<StoredEvent[]>`
      SELECT kind, payload, xact_id::text AS "xactId",
         actor_kind AS "actorKind", actor_id AS "actorId"
      FROM outbox
      WHERE subject_id = ${subjectId}
      ORDER BY xact_id, id`;
}

async function newEntity(): Promise<string> {
   const id = randomUUID();
   await withRLS(user, (tx) =>
      registerEntity(tx, {
         id,
         provider: 'sandbox-notes',
         type: 'note',
         displayName: 'A note',
         actor,
      }),
   );
   return id;
}

describe('the outbox', () => {
   it('records entity.created when an entity is registered', async () => {
      const id = await newEntity();

      expect(await eventsOf(id)).toEqual([
         expect.objectContaining({
            kind: 'entity.created',
            payload: { provider: 'sandbox-notes', type: 'note' },
            actorKind: 'human',
            actorId: user,
         }),
      ]);
   });

   it('records a version save as two events in one transaction, in order', async () => {
      const id = await newEntity();
      await withRLS(user, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'version',
            displayName: 'Edited',
            actor,
         }),
      );

      const [created, saved, bumped] = await eventsOf(id);

      expect([created.kind, saved.kind, bumped.kind]).toEqual([
         'entity.created',
         'entity.content_saved',
         'entity.version_bumped',
      ]);
      expect(saved.payload).toEqual({ contentSeq: 1 });
      expect(bumped.payload).toEqual({ version: 2 });
      // One save, one transaction; the registration was another
      expect(saved.xactId).toBe(bumped.xactId);
      expect(BigInt(created.xactId)).toBeLessThan(BigInt(saved.xactId));
   });

   it('records only content_saved for a revision save', async () => {
      const id = await newEntity();
      await withRLS(user, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'revision',
            displayName: 'Edited',
            actor,
         }),
      );

      expect((await eventsOf(id)).map(({ kind }) => kind)).toEqual([
         'entity.created',
         'entity.content_saved',
      ]);
   });

   it('records a status change, and nothing when the status is already set', async () => {
      const id = await newEntity();
      const deprecate = () =>
         withRLS(user, (tx) =>
            setEntityStatus(tx, { id, status: 'deprecated', actor }),
         );
      await deprecate();
      await deprecate();

      const events = await eventsOf(id);

      expect(events.map(({ kind }) => kind)).toEqual([
         'entity.created',
         'entity.status_changed',
      ]);
      expect(events[1].payload).toEqual({ from: 'active', to: 'deprecated' });
   });

   it('records nothing for a stale save', async () => {
      const id = await newEntity();

      await expect(
         withRLS(user, (tx) =>
            saveEntityContent(tx, {
               id,
               baselineContentSeq: 7,
               bump: 'revision',
               displayName: 'Stale',
               actor,
            }),
         ),
      ).rejects.toMatchObject({ code: 'stale_content' });
      expect((await eventsOf(id)).map(({ kind }) => kind)).toEqual([
         'entity.created',
      ]);
   });

   it('loses its events with the write when the transaction fails', async () => {
      const id = randomUUID();

      await expect(
         withRLS(user, async (tx) => {
            await registerEntity(tx, {
               id,
               provider: 'sandbox-notes',
               type: 'note',
               displayName: 'Never saved',
               actor,
            });
            throw new Error('the provider failed after Synergy wrote');
         }),
      ).rejects.toThrow('the provider failed');
      expect(await eventsOf(id)).toEqual([]);
   });

   it('is closed to app_runtime: it can write events but not read them', async () => {
      await expect(
         withRLS(user, (tx) => tx.select().from(outbox)),
      ).rejects.toMatchObject({
         cause: expect.objectContaining({
            message: 'permission denied for table outbox',
         }),
      });
   });
});
