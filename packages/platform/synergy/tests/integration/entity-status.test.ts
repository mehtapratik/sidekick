import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { changeEntityStatus } from '../../src/api/change-entity-status';
import { readEntity } from '../../src/api/read-entity';
import { entitySchema } from '../../src/contracts';
import { registerEntity } from '../../src/repository/entities';
import { signInAs } from '../helpers';

// Proves PATCH /api/synergy/entities/:id/status end to end: the real guard,
// handler and database, with only the Supabase session faked (see signInAs).
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const stranger = randomUUID();

// The same guard options as apps/app's route files
const PATCH = withApiGuard(changeEntityStatus, { lockUser: true });
const GET = withApiGuard(readEntity);

function setStatus(id: string, status: string) {
   return PATCH(
      new Request(`http://localhost/api/synergy/entities/${id}/status`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ status }),
      }),
      { params: Promise.resolve({ id }) },
   );
}

function read(id: string, ifNoneMatch?: string) {
   return GET(
      new Request(`http://localhost/api/synergy/entities/${id}`, {
         headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {},
      }),
      { params: Promise.resolve({ id }) },
   );
}

async function newEntity(): Promise<string> {
   const id = randomUUID();
   await withRLS(owner, (tx) =>
      registerEntity(tx, {
         id,
         provider: 'sandbox-notes',
         type: 'note',
         displayName: 'A note',
         actor: { kind: 'human', id: owner },
      }),
   );
   return id;
}

beforeAll(async () => {
   await testAuthDb`
      INSERT INTO auth.users (id, email)
      VALUES
         (${owner}, 'owner@example.com'),
         (${stranger}, 'stranger@example.com')
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

describe('PATCH /api/synergy/entities/:id/status', () => {
   it('deprecates and reactivates, moving no counter', async () => {
      signInAs(owner);
      const id = await newEntity();

      const deprecated = await setStatus(id, 'deprecated');
      const reactivated = await setStatus(id, 'active');

      expect(deprecated.status).toBe(200);
      expect(entitySchema.parse(await deprecated.json())).toMatchObject({
         status: 'deprecated',
         version: 1,
         revision: 0,
         contentSeq: 0,
      });
      expect(reactivated.status).toBe(200);
      expect(entitySchema.parse(await reactivated.json())).toMatchObject({
         status: 'active',
         version: 1,
         revision: 0,
         contentSeq: 0,
      });
   });

   it('gives a cached copy a new ETag once the status changes (D271)', async () => {
      signInAs(owner);
      const id = await newEntity();
      const etag = (await read(id)).headers.get('ETag') ?? '';

      const patched = await setStatus(id, 'deprecated');
      const response = await read(id, etag);

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: 'deprecated' });
      // The PATCH answer carries the same new ETag a GET gives
      expect(patched.headers.get('ETag')).toBe(response.headers.get('ETag'));
      expect(response.headers.get('ETag')).not.toBe(etag);
   });

   it('refuses superseded, which only a supersede sets', async () => {
      signInAs(owner);
      const id = await newEntity();

      const response = await setStatus(id, 'superseded');

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
         code: 'validation_failed',
      });
   });

   it('answers 404 for another user’s entity, a deleted one and a non-uuid id', async () => {
      signInAs(owner);
      const deleted = await newEntity();
      await testAdminDb`UPDATE entity_index SET deleted_at = now() WHERE id = ${deleted}`;
      const owned = await newEntity();

      signInAs(stranger);
      const strangers = await setStatus(owned, 'deprecated');
      signInAs(owner);
      const tombstone = await setStatus(deleted, 'deprecated');
      const notAnId = await setStatus('not-a-uuid', 'deprecated');

      expect([strangers.status, tombstone.status, notAnId.status]).toEqual([
         404, 404, 404,
      ]);
      // The stranger's request changed nothing
      expect(await (await read(owned)).json()).toMatchObject({
         status: 'active',
      });
   });
});
