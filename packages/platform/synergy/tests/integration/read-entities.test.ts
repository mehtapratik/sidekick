import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { readEntity } from '../../src/api/read-entity';
import { entitySchema } from '../../src/contracts';
import {
   registerEntity,
   saveEntityContent,
} from '../../src/repository/entities';
import { signInAs } from '../helpers';

// Proves GET /api/synergy/entities/:id end to end: the real guard, handler
// and database, with only the Supabase session faked (see signInAs).
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const stranger = randomUUID();

// The same guard options as apps/app's route file: none
const GET = withApiGuard(readEntity);

function read(id: string, ifNoneMatch?: string) {
   return GET(
      new Request(`http://localhost/api/synergy/entities/${id}`, {
         headers: ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {},
      }),
      { params: Promise.resolve({ id }) },
   );
}

// Registers a fresh entity for the owner, straight through the repository
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

describe('GET /api/synergy/entities/:id', () => {
   it('returns the entity with its content_seq as the ETag', async () => {
      signInAs(owner);
      const id = await newEntity();

      const response = await read(id);

      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).toBe('"0"');
      expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
      // The response keeps its own contract
      expect(entitySchema.parse(await response.json())).toMatchObject({
         id,
         provider: 'sandbox-notes',
         type: 'note',
         contentSeq: 0,
      });
   });

   it('answers 304 with no body while the ETag still matches', async () => {
      signInAs(owner);
      const id = await newEntity();

      const response = await read(id, '"0"');

      expect(response.status).toBe(304);
      expect(response.headers.get('ETag')).toBe('"0"');
      expect(await response.text()).toBe('');
   });

   it('answers 200 with the new ETag once someone has saved', async () => {
      signInAs(owner);
      const id = await newEntity();
      await withRLS(owner, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: 0,
            bump: 'revision',
            displayName: 'Edited',
            actor: { kind: 'human', id: owner },
         }),
      );

      const response = await read(id, '"0"');

      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).toBe('"1"');
      expect(await response.json()).toMatchObject({ displayName: 'Edited' });
   });

   it('answers 404 for another user’s entity, the same as a missing one', async () => {
      signInAs(owner);
      const id = await newEntity();

      signInAs(stranger);
      const response = await read(id);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 'not_found' });
   });

   it('answers 404 for a deleted entity', async () => {
      signInAs(owner);
      const id = await newEntity();
      // As postgres: deleting isn't a route yet (lesson 11)
      await testAdminDb`UPDATE entity_index SET deleted_at = now() WHERE id = ${id}`;

      const response = await read(id);

      expect(response.status).toBe(404);
   });

   it('answers 404, never 500, for an id that isn’t a uuid', async () => {
      signInAs(owner);

      const response = await read('not-a-uuid');

      expect(response.status).toBe(404);
   });
});
