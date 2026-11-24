import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { withRLS } from '@sidekick/core/db';
import { createTestAuthDb } from '@sidekick/test-utils/db';

import { listRelationTypesHandler } from '../../src/api/list-relation-types';
import { relationTypeSchema, type RelationType } from '../../src/contracts';
import { relationTypes } from '../../src/db/schema';
import { signInAs } from '../helpers';

// Proves GET /api/synergy/relation-types end to end: the real guard, handler
// and database, with only the Supabase session faked (see signInAs).
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();

const user = randomUUID();

// The same guard options as apps/app's route file: none
const GET = withApiGuard(listRelationTypesHandler);

async function list(): Promise<RelationType[]> {
   const response = await GET(
      new Request('http://localhost/api/synergy/relation-types'),
      undefined as never,
   );
   expect(response.status).toBe(200);
   return relationTypeSchema.array().parse(await response.json());
}

beforeAll(async () => {
   await testAuthDb`
      INSERT INTO auth.users (id, email)
      VALUES (${user}, 'user@example.com')
   `;
});

afterAll(async () => {
   await testAuthDb.end();
});

describe('GET /api/synergy/relation-types', () => {
   it('returns the 13 seeded types with their kinds, sorted by source key', async () => {
      signInAs(user);
      const types = await list();

      expect(types).toHaveLength(13);
      expect(types.map(({ sourceKey }) => sourceKey)).toEqual(
         types.map(({ sourceKey }) => sourceKey).sort(),
      );
      expect(types.filter(({ kind }) => kind === 'reference')).toHaveLength(7);
      expect(types.filter(({ kind }) => kind === 'association')).toHaveLength(
         6,
      );
      expect(types.find(({ sourceKey }) => sourceKey === 'violates')).toEqual({
         sourceKey: 'violates',
         targetKey: 'violated-by',
         kind: 'association',
         status: 'active',
         isSystem: false,
      });
   });

   it('marks untyped and superseded-by as the only system rows', async () => {
      signInAs(user);
      const system = (await list())
         .filter(({ isSystem }) => isSystem)
         .map(({ sourceKey }) => sourceKey);

      expect(system.sort()).toEqual(['superseded-by', 'untyped']);
   });
});

describe('relation_types as app_runtime', () => {
   it.each([
      [
         'insert',
         (tx: Parameters<Parameters<typeof withRLS>[1]>[0]) =>
            tx.insert(relationTypes).values({
               sourceKey: 'made-up',
               targetKey: 'made-up-by',
               kind: 'reference',
            }),
      ],
      [
         'update',
         (tx: Parameters<Parameters<typeof withRLS>[1]>[0]) =>
            tx.update(relationTypes).set({ status: 'deprecated' }),
      ],
      [
         'delete',
         (tx: Parameters<Parameters<typeof withRLS>[1]>[0]) =>
            tx.delete(relationTypes),
      ],
   ])('cannot %s a row', async (_operation, write) => {
      await expect(withRLS(user, write)).rejects.toMatchObject({
         cause: expect.objectContaining({
            message: 'permission denied for table relation_types',
         }),
      });
   });
});
