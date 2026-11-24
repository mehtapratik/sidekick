import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { withRLS } from '@sidekick/core/db';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { listEntityVersions } from '../../src/api/list-versions';
import { versionsPageSchema, type VersionsPage } from '../../src/contracts';
import type { Actor } from '../../src/repository/actor';
import {
   registerEntity,
   saveEntityContent,
} from '../../src/repository/entities';
import { signInAs } from '../helpers';

// Proves GET /api/synergy/entities/:id/versions end to end: the real guard,
// handler and database, with only the Supabase session faked (see signInAs).
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const stranger = randomUUID();

// The same guard options as apps/app's route file: none
const GET = withApiGuard(listEntityVersions);

function list(id: string, cursor?: string) {
   const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
   return GET(
      new Request(
         `http://localhost/api/synergy/entities/${id}/versions${query}`,
      ),
      { params: Promise.resolve({ id }) },
   );
}

async function page(id: string, cursor?: string): Promise<VersionsPage> {
   const response = await list(id, cursor);
   expect(response.status).toBe(200);
   return versionsPageSchema.parse(await response.json());
}

/** A fresh entity with this many version saves after its creation */
async function entityWithVersions(saves: number): Promise<string> {
   const id = randomUUID();
   const actor: Actor = { kind: 'human', id: owner };
   await withRLS(owner, (tx) =>
      registerEntity(tx, {
         id,
         provider: 'sandbox-notes',
         type: 'note',
         displayName: 'A note',
         actor,
      }),
   );
   for (let seq = 0; seq < saves; seq++) {
      await withRLS(owner, (tx) =>
         saveEntityContent(tx, {
            id,
            baselineContentSeq: seq,
            bump: 'version',
            changeNote: `Save ${seq + 1}`,
            displayName: 'A note',
            actor,
         }),
      );
   }
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

describe('GET /api/synergy/entities/:id/versions', () => {
   it('lists a new entity’s version 1, from its creation', async () => {
      signInAs(owner);
      const id = await entityWithVersions(0);

      expect(await page(id)).toEqual({
         versions: [{ version: 1, createdAt: expect.any(String) }],
         nextCursor: null,
      });
   });

   it('pages newest first, with no gap or repeat, until nextCursor is null', async () => {
      signInAs(owner);
      // 25 saves: versions 26 down to 1, so pages of 20 and 6
      const id = await entityWithVersions(25);

      const first = await page(id);
      const second = await page(id, first.nextCursor ?? undefined);
      const all = [...first.versions, ...second.versions].map(
         ({ version }) => version,
      );

      expect(first.versions).toHaveLength(20);
      expect(first.versions[0]).toMatchObject({
         version: 26,
         changeNote: 'Save 25',
      });
      expect(second.versions).toHaveLength(6);
      expect(second.nextCursor).toBeNull();
      expect(all).toEqual(Array.from({ length: 26 }, (_, i) => 26 - i));
   });

   it('answers 400 for a cursor it didn’t make', async () => {
      signInAs(owner);
      const id = await entityWithVersions(0);

      const response = await list(id, 'not-a-cursor');

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'invalid_cursor' });
   });

   it('answers 404 for another user’s entity and a deleted one', async () => {
      signInAs(owner);
      const owned = await entityWithVersions(1);
      const deleted = await entityWithVersions(1);
      await testAdminDb`UPDATE entity_index SET deleted_at = now() WHERE id = ${deleted}`;

      const tombstone = await list(deleted);
      signInAs(stranger);
      const strangers = await list(owned);

      expect([tombstone.status, strangers.status]).toEqual([404, 404]);
   });
});
