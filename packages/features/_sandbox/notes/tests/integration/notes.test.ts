import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '@sidekick/core/api';
import { createTestAdminDb, createTestAuthDb } from '@sidekick/test-utils/db';

import { ENTITY_TYPE, FEATURE_KEY } from '../../src';
import { noteSchema } from '../../src/contracts';
import { createNote, saveNote } from '../../src/server';
import { signInAs } from '../helpers';

// Proves the notes routes end to end: the real guard, handlers, Synergy and
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
const POST = withApiGuard(createNote, { feature: FEATURE_KEY, lockUser: true });
const PUT = withApiGuard(saveNote, { feature: FEATURE_KEY, lockUser: true });

const NOTE_BODY = { type: 'doc', content: [{ type: 'paragraph' }] };

function create(id: string, title = 'First note') {
   return POST(
      new Request('http://localhost/api/sandbox/notes', {
         method: 'POST',
         body: JSON.stringify({ id, title, body: NOTE_BODY }),
      }),
      undefined,
   );
}

function save(id: string, title: string, baselineContentSeq: number) {
   return PUT(
      new Request(`http://localhost/api/sandbox/notes/${id}`, {
         method: 'PUT',
         body: JSON.stringify({
            title,
            body: NOTE_BODY,
            baselineContentSeq,
         }),
      }),
      { params: Promise.resolve({ id }) },
   );
}

// Reads as postgres, which bypasses RLS, so a check doesn't depend on the code under test
async function storedNote(id: string) {
   const [row] = await testAdminDb`
      SELECT 
         notes.title, 
         entity.provider, 
         entity.type, 
         entity.content_seq,
         entity.display_name,
         entity.title AS entity_title,
         entity.actor_kind,
         entity.actor_id
      FROM 
         sandbox_notes notes JOIN entity_index entity 
      ON
         notes.id = entity.id
      WHERE
         notes.id = ${id}
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

describe('notes routes', () => {
   it('creates a note and registers it with Synergy as a sandbox note', async () => {
      signInAs(owner);
      const id = randomUUID();

      const response = await create(id);

      expect(response.status).toBe(201);
      const note = noteSchema.parse(await response.json());
      expect(note).toMatchObject({ id, title: 'First note', contentSeq: 0 });
      expect(await storedNote(id)).toEqual({
         title: 'First note',
         provider: FEATURE_KEY,
         type: ENTITY_TYPE.NOTE,
         content_seq: 0,
         // Synergy shows the provider's title, and records who created it
         display_name: 'First note',
         entity_title: 'First note',
         actor_kind: 'human',
         actor_id: owner,
      });
   });

   it('saves from the current baseline and moves content_seq', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);

      const response = await save(id, 'Edited', 0);

      expect(response.status).toBe(200);
      expect(noteSchema.parse(await response.json()).contentSeq).toBe(1);
      expect(await storedNote(id)).toMatchObject({
         title: 'Edited',
         display_name: 'Edited',
         content_seq: 1,
      });
   });

   it('refuses a stale save with 409 and writes nothing', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);
      await save(id, 'First tab', 0);

      // The second tab still started from 0
      const response = await save(id, 'Second tab', 0);

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ code: 'stale_content' });
      expect(await storedNote(id)).toMatchObject({
         title: 'First tab',
         content_seq: 1,
      });
   });

   it('refuses a user without the feature with 403 and writes nothing', async () => {
      signInAs(notEntitled);
      const id = randomUUID();

      const response = await create(id);

      expect(response.status).toBe(403);
      expect(await storedNote(id)).toBeUndefined();
   });

   it('answers 404 for another user’s note, the same as a missing one', async () => {
      signInAs(owner);
      const id = randomUUID();
      await create(id);

      signInAs(otherEntitled);
      const response = await save(id, 'Not mine', 0);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ code: 'not_found' });
      expect(await storedNote(id)).toMatchObject({ title: 'First note' });
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
      expect(await storedNote(id)).toBeUndefined();
   });
});
