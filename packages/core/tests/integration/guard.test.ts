import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { withApiGuard } from '../../src/api';
import { resolveApiCaller } from '../../src/api/auth';
import { profiles } from '../../src/db/schema';
import { createTestAdminDb, createTestAuthDb } from '../helpers/db';
import { createMockHttpRequest } from '../helpers/http';

// Proves the guard end to end on a database built from our migrations. Only the caller
// is mocked (there is no Supabase Auth here); withRLS, the RLS policies, entitlements,
// commit and rollback all run for real. Runs inside tests/with-test-db.sh.
vi.mock('../../src/api/auth', () => ({ resolveApiCaller: vi.fn() }));

const testAuthDb = createTestAuthDb();
const testAdminDb = createTestAdminDb();

const entitledUserId = randomUUID();
const otherUserId = randomUUID();

function mockSignedInAs(userId: string) {
  vi.mocked(resolveApiCaller).mockResolvedValue({ kind: 'session', userId });
}

// Reads as postgres, which bypasses RLS, so the check doesn't depend on the code under test
async function getProfileEmail(userId: string) {
  const [row] = await testAdminDb`SELECT email FROM profiles WHERE id = ${userId}`;
  return row.email;
}

beforeAll(async () => {
  // The 0005 trigger creates each user's profile
  await testAuthDb`INSERT INTO auth.users ${testAuthDb(
    [
      { id: entitledUserId, email: 'entitled@example.com' },
      { id: otherUserId, email: 'other@example.com' },
    ],
    'id',
    'email',
  )}`;

  await testAdminDb`INSERT INTO user_feature_entitlements (user_id, feature_key)
    VALUES (${entitledUserId}, 'core-drive')`;
});

afterAll(async () => {
  await testAuthDb.end();
  await testAdminDb.end();
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('withApiGuard on a real database', () => {
  it('lets an entitled user reach a feature route', async () => {
    mockSignedInAs(entitledUserId);
    const guarded = withApiGuard(async () => Response.json({ ok: true }), {
      feature: 'core-drive',
    });

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(response.status).toBe(200);
  });

  it('responds 403 to a user who is not entitled to the feature', async () => {
    mockSignedInAs(otherUserId);
    const mockHandler = vi.fn(async () => Response.json({ ok: true }));
    const guarded = withApiGuard(mockHandler, { feature: 'core-drive' });

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Feature disabled', code: 'FEATURE_DISABLED' });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('gives the handler a transaction that sees only the caller’s profile', async () => {
    mockSignedInAs(entitledUserId);
    const guarded = withApiGuard(async ({ tx }) =>
      Response.json(await tx.select({ id: profiles.id }).from(profiles)),
    );

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(await response.json()).toEqual([{ id: entitledUserId }]);
  });

  it('rolls back the handler’s write when it throws', async () => {
    mockSignedInAs(entitledUserId);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const guarded = withApiGuard(async ({ tx, caller }) => {
      await tx
        .update(profiles)
        .set({ email: 'changed@example.com' })
        .where(eq(profiles.id, caller.userId));
      throw new Error('failed after the write');
    });

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(response.status).toBe(500);
    expect(await getProfileEmail(entitledUserId)).toBe('entitled@example.com');
  });

  it('keeps the handler’s write when it returns an error response instead of throwing', async () => {
    mockSignedInAs(otherUserId);
    const guarded = withApiGuard(async ({ tx, caller }) => {
      await tx
        .update(profiles)
        .set({ email: 'kept@example.com' })
        .where(eq(profiles.id, caller.userId));
      return Response.json({ error: 'Invalid input', code: 'VALIDATION_ERROR' }, { status: 400 });
    });

    const response = await guarded(createMockHttpRequest(), undefined);
    expect(response.status).toBe(400);
    // Only a throw rolls back: handlers must validate before they write
    expect(await getProfileEmail(otherUserId)).toBe('kept@example.com');
  });
});
