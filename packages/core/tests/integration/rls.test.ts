import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withRLS } from '../../src/db';
import { profiles } from '../../src/db/schema';
import { createTestAuthDb, createTestRuntimeDb } from '../helpers/db';

// Proves row-level security on the runtime connection. Runs inside
// tests/with-test-db.sh, which builds a fresh database from our
// migrations and exports these connection URLs:
// - DATABASE_URL: app_runtime, the role the app and withRLS use
// - TEST_AUTH_DATABASE_URL: supabase_auth_admin, which creates users the way
//   Supabase Auth does

const testAuthDb = createTestAuthDb();
const testRuntimeDb = createTestRuntimeDb();

const userA = randomUUID();
const userB = randomUUID();

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
   await testRuntimeDb.end();
});

describe('RLS on profiles', () => {
   it.each([
      ['userA', userA],
      ['userB', userB],
   ])('shows %s only their own profile', async (userKey, userId) => {
      const rows = await withRLS(userId, (tx) => tx.select().from(profiles));
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(userId);
   });

   it('returns zero rows without a user context when run as app_runtime', async () => {
      const userProfilesVisibleToUserA = await withRLS(userA, (tx) =>
         tx.select().from(profiles),
      );
      expect(userProfilesVisibleToUserA).toHaveLength(1);

      const rows = await testRuntimeDb`SELECT 1 FROM profiles`;
      expect(rows).toHaveLength(0);
   });
});
