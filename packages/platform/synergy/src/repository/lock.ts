import { sql } from 'drizzle-orm';

import type { RlsTx } from '@sidekick/core/db';

// Every Synergy write calls this first, before it reads anything (D202).
// It takes the current user's lock, held until the transaction ends, so one
// user's Synergy writes run one at a time. Reads never wait for it.
async function lockCurrentUser(tx: RlsTx): Promise<void> {
   // The key is the user withRLS set, so the lock can't name another user.
   // Without withRLS, current_setting raises an error instead of locking nothing.
   await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(current_setting('app.current_user_id'), 0))`,
   );
}

export type SynergyMutation<Args extends unknown[], Result> = (
   tx: RlsTx,
   ...args: Args
) => Promise<Result>;

// Wraps a Synergy mutation so it takes the user's lock before anything else.
export function withUserLock<Args extends unknown[], Result>(
   mutation: SynergyMutation<Args, Result>,
): SynergyMutation<Args, Result> {
   return async function openUserLock(tx, ...args) {
      await lockCurrentUser(tx);
      return mutation(tx, ...args);
   };
}
