import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { createTestRuntimeDb } from '@sidekick/test-utils/db';

import { withRLS, type RlsTx } from '../../src/db';

// Proves withRLS's lockUser option against a real database: the lock is taken,
// and it makes one user's locked transactions run one at a time. Runs inside
// pnpm test:integration (DATABASE_URL is app_runtime, the role withRLS uses).

const testRuntimeDb = createTestRuntimeDb();

const userA = randomUUID();
const userB = randomUUID();

afterAll(async () => {
   await testRuntimeDb.end();
});

/** How many advisory locks this transaction's own connection holds */
async function advisoryLocksHeld(tx: RlsTx): Promise<number> {
   const [row] = await tx.execute<{ held: number }>(
      sql`select count(*)::int as held from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()`,
   );
   return row.held;
}

/** How many advisory locks any connection is waiting for */
async function advisoryLocksAwaited(): Promise<number> {
   const [row] = await testRuntimeDb<{ awaited: number }[]>`
      select count(*)::int as awaited from pg_locks
      where locktype = 'advisory' and not granted`;
   return row.awaited;
}

describe('withRLS lockUser', () => {
   it('takes no lock by default', async () => {
      expect(await withRLS(userA, advisoryLocksHeld)).toBe(0);
   });

   it('holds the user lock before fn runs when lockUser is set', async () => {
      expect(await withRLS(userA, advisoryLocksHeld, { lockUser: true })).toBe(
         1,
      );
   });

   it('makes a second locked transaction for the same user wait, but not another user’s', async () => {
      const order: string[] = [];
      let lock = () => {
         /* no-ops */
      };
      let unlock = () => {
         /* no-ops */
      };
      const waitForLock = new Promise<void>((resolve) => (lock = resolve));
      const waitForUnlock = new Promise<void>((resolve) => (unlock = resolve));

      // The first transaction takes userA's lock and holds it until released
      const first = withRLS(
         userA,
         async () => {
            // resolves `waitForLock` promise to allow move to execution on next line after it
            lock();
            // waits here until promise is resolved, i.e. `unlock` is invoked.
            await waitForUnlock;
            order.push('first done');
         },
         { lockUser: true },
      );
      // waits here until promise is resolved, i.e. `lock` is invoked.
      await waitForLock;

      // A second one for userA starts, and Postgres makes it wait for the lock
      const second = withRLS(
         userA,
         async () => {
            order.push('second ran');
         },
         { lockUser: true },
      );
      await vi.waitFor(async () => {
         // since `unlock` is not called, i.e. `waitForUnlock` is not resolved,
         // first transaction lock must still be in place for `userA`
         expect(await advisoryLocksAwaited()).toBe(1);
      });

      // The third transaction for userB's lock has a different key,
      // so userB doesn't wait for userA
      await withRLS(
         userB,
         async () => {
            order.push('userB ran');
         },
         { lockUser: true },
      );

      // Releasing the first lock on `userA` lets the second transaction
      // on the same user run, never before. This is done by resolving
      // `waitForUnlock` promise to allow move to execution on next line after it
      unlock();
      await Promise.all([first, second]);
      expect(order).toEqual(['userB ran', 'first done', 'second ran']);
   });
});
