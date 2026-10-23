import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withRLS } from '../../src/db';
import { userFeatureEntitlements } from '../../src/db/schema';
import { getEnabledFeatures } from '../../src/features/entitlements';
import { createTestAuthDb, createTestAdminDb, createTestRuntimeDb } from '../helpers/db';

// Proves the entitlements lockdown on a database built from our migrations.
// Runs inside tests/with-test-db.sh, which exports:
// - DATABASE_URL: app_runtime, the role withRLS uses for every user request
// - TEST_AUTH_DATABASE_URL: supabase_auth_admin, which creates and deletes users
// - TEST_ADMIN_DATABASE_URL: postgres, the privileged role that writes entitlements

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();
const testRuntimeDb = createTestRuntimeDb();

const userA = randomUUID();
const userB = randomUUID();
const userToDelete = randomUUID();

beforeAll(async () => {
  // The 0005 trigger creates each user's profile, which entitlements reference
  await testAuthDb`INSERT INTO auth.users ${testAuthDb(
    [
      { id: userA, email: 'a@example.com' },
      { id: userB, email: 'b@example.com' },
      { id: userToDelete, email: 'c@example.com' },
    ],
    'id',
    'email',
  )}`;

  await testAdminDb`INSERT INTO user_feature_entitlements ${testAdminDb(
    [
      { user_id: userA, feature_key: 'core-drive' },
      { user_id: userA, feature_key: 'taxila' },
      { user_id: userB, feature_key: 'alter-ego' },
      { user_id: userToDelete, feature_key: 'taxila' },
    ],
    'user_id',
    'feature_key',
  )}`;
});

afterAll(async () => {
  await testAuthDb.end();
  await testAdminDb.end();
  await testRuntimeDb.end();
});

// Both the REVOKE and RLS reject with SQLSTATE 42501, so match the message:
// "permission denied" comes only from the REVOKE.
const permissionDenied = {
  cause: expect.objectContaining({
    message: 'permission denied for table user_feature_entitlements',
  }),
};

describe('reading entitlements', () => {
  it.each([
    ['userA', userA, ['core-drive', 'taxila']],
    ['userB', userB, ['alter-ego']],
  ])('returns only %s’s feature keys', async (_name, userId, expected) => {
    const keys = await withRLS(userId, getEnabledFeatures);
    // No ORDER BY, so compare without depending on row order
    expect([...keys].sort()).toEqual(expected);
  });

  it('returns zero rows without a user context when run as app_runtime', async () => {
    const rows = await testRuntimeDb`SELECT 1 FROM user_feature_entitlements`;
    expect(rows).toHaveLength(0);
  });
});

describe('writing entitlements as app_runtime', () => {
  it('cannot insert, even for the caller’s own user', async () => {
    const insert = withRLS(userA, (tx) =>
      tx.insert(userFeatureEntitlements).values({ userId: userA, featureKey: 'war-room' }),
    );
    await expect(insert).rejects.toMatchObject(permissionDenied);
  });

  it('cannot delete, even the caller’s own rows', async () => {
    const remove = withRLS(userA, (tx) => tx.delete(userFeatureEntitlements));
    await expect(remove).rejects.toMatchObject(permissionDenied);
  });
});

describe('deleting a user', () => {
  it('cascades through profiles to their entitlements', async () => {
    await testAuthDb`DELETE FROM auth.users WHERE id = ${userToDelete}`;

    // testAdminDb bypasses RLS, so zero rows means the rows are gone, not hidden
    const rows = await testAdminDb`
      SELECT 1 FROM user_feature_entitlements WHERE user_id = ${userToDelete}
    `;
    expect(rows).toHaveLength(0);
  });
});
