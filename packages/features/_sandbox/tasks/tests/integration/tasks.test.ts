import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { ENTITY_TYPE, FEATURE_KEY } from '../../src';
import { taskSchema } from '../../src/contracts';
import { createTask, saveTask } from '../../src/server';
import { signInAs } from '../helpers';

// Proves the tasks routes end to end: the real guard, handlers, Synergy and
// database, with only the Supabase session faked (see signInAs). Runs inside
// pnpm test:integration, on a database built from every package's migrations.
vi.mock('@sidekick/core/supabase/server', () => ({
   createServerClient: vi.fn(),
}));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const owner = randomUUID();
const otherEntitled = randomUUID();
const notEntitled = randomUUID();

// The same guard options as apps/app's route files
const POST = withApiGuard(createTask, { feature: FEATURE_KEY, lockUser: true });
const PUT = withApiGuard(saveTask, { feature: FEATURE_KEY, lockUser: true });

function create(id: string, title = 'First task') {
   return POST(
      new Request('http://localhost/api/sandbox/tasks', {
         method: 'POST',
         body: JSON.stringify({ id, title }),
      }),
      undefined,
   );
}

function save(
   id: string,
   title: string,
   done: boolean,
   baselineContentSeq: number,
) {
   return PUT(
      new Request(`http://localhost/api/sandbox/tasks/${id}`, {
         method: 'PUT',
         body: JSON.stringify({
            title,
            done,
            baselineContentSeq,
         }),
      }),
      { params: Promise.resolve({ id }) },
   );
}

// Reads as postgres, which bypasses RLS, so a check doesn't depend on the code under test
async function storedTask(id: string) {
   const [row] = await testAdminDb`
      SELECT 
         tasks.title,
         tasks.done, 
         entity.provider, 
         entity.type, 
         entity.content_seq
      FROM 
         sandbox_tasks tasks JOIN entity_index entity 
      ON
         tasks.id = entity.id
      WHERE
         tasks.id = ${id}
   `;

   return row;
}

beforeAll(async () => {
   await testAuthDb`
      INSERT INTO
         auth.users (id, email)
      VALUES
         (${owner}, 'owner@example.com'),
         (${otherEntitled}, 'entitled@example.com'),
         (${notEntitled}, 'not_entitled@example.com')
   `;

   await testAdminDb`
      INSERT INTO
         user_feature_entitlements
         (user_id, feature_key)
      VALUES
         (${owner}, ${FEATURE_KEY}),
         (${otherEntitled}, ${FEATURE_KEY})
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
});

describe('tasks routes', () => {
   it('creates a task and registers it with Synergy as a sandbox task', async () => {
      signInAs(owner);
      const id = randomUUID();

      const response = await create(id);

      expect(response.status).toBe(201);
      const task = taskSchema.parse(await response.json());
      expect(task).toMatchObject({
         id,
         title: 'First task',
         done: false,
         contentSeq: 0,
      });
      expect(await storedTask(id)).toEqual({
         title: 'First task',
         done: false,
         provider: FEATURE_KEY,
         type: ENTITY_TYPE.TASK,
         content_seq: 0,
      });
   });

   it('saves from the current baseline and moves content_seq', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);

      const response = await save(id, 'Edited', true, 0);

      expect(response.status).toBe(200);
      expect(taskSchema.parse(await response.json()).contentSeq).toBe(1);
      expect(await storedTask(id)).toMatchObject({
         title: 'Edited',
         done: true,
         content_seq: 1,
      });
   });

   it('refuses a stale save with 409 and writes nothing', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);
      await save(id, 'First tab', true, 0);

      // The second tab still started from 0
      const response = await save(id, 'Second tab', true, 0);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ code: 'stale_content' });
      expect(await storedTask(id)).toMatchObject({
         title: 'First tab',
         content_seq: 1,
      });
   });

   it('refuses a user without the feature with 403 and writes nothing', async () => {
      signInAs(notEntitled);
      const id = randomUUID();

      const response = await create(id);

      expect(response.status).toBe(403);
      expect(await storedTask(id)).toBeUndefined();
   });

   it('answers 404 for another user’s task, the same as a missing one', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);

      signInAs(otherEntitled);
      const response = await save(id, 'Not mine', true, 0);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 'not_found' });
      expect(await storedTask(id)).toMatchObject({ title: 'First task' });
   });

   it('answers 400 for invalid input and writes nothing', async () => {
      signInAs(owner);
      const id = randomUUID();

      const response = await create(id, '   ');

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
         code: 'validation_failed',
         issues: [{ path: ['title'] }],
      });
      expect(await storedTask(id)).toBeUndefined();
   });
});
