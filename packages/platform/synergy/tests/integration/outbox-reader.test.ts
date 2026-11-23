import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
   createTestAdminDb,
   createTestAuthDb,
   createTestOutboxReaderDb,
} from '@sidekick/test-utils/db';

// Proves the outbox's read-only role: it reads every user's events and can
// change nothing. Nothing uses the role yet; the first reader will.

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();
const readerDb = createTestOutboxReaderDb();

const userA = randomUUID();
const userB = randomUUID();
const subjectA = randomUUID();
const subjectB = randomUUID();

beforeAll(async () => {
   await testAuthDb`INSERT INTO auth.users
      (id, email)
   VALUES
      (${userA}, 'a@example.com'),
      (${userB}, 'b@example.com')
   `;
   // postgres bypasses RLS, so it can seed both users' events at once
   await testAdminDb`INSERT INTO outbox
      (user_id, kind, subject_id, actor_kind, actor_id)
   VALUES
      (${userA}, 'entity.created', ${subjectA}, 'human', ${userA}),
      (${userB}, 'entity.created', ${subjectB}, 'human', ${userB})
   `;
});

afterAll(async () => {
   await testAuthDb.end();
   await testAdminDb.end();
   await readerDb.end();
});

describe('outbox_reader', () => {
   it("reads every user's events", async () => {
      const rows = await readerDb<{ subjectId: string }[]>`
         SELECT subject_id AS "subjectId" FROM outbox
         WHERE subject_id IN (${subjectA}, ${subjectB})`;

      expect(rows.map(({ subjectId }) => subjectId).sort()).toEqual(
         [subjectA, subjectB].sort(),
      );
   });

   it('cannot insert, update or delete events', async () => {
      await expect(readerDb`INSERT INTO outbox
         (user_id, kind, subject_id, actor_kind, actor_id)
      VALUES
         (${userA}, 'entity.created', ${randomUUID()}, 'human', ${userA})
      `).rejects.toThrow('permission denied for table outbox');
      await expect(
         readerDb`UPDATE outbox SET payload = '{}' WHERE subject_id = ${subjectA}`,
      ).rejects.toThrow('permission denied for table outbox');
      await expect(
         readerDb`DELETE FROM outbox WHERE subject_id = ${subjectA}`,
      ).rejects.toThrow('permission denied for table outbox');
   });

   it('cannot read any other table', async () => {
      await expect(
         readerDb`SELECT id FROM entity_index LIMIT 1`,
      ).rejects.toThrow('permission denied for table entity_index');
   });
});
