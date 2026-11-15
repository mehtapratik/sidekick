import { sql } from 'drizzle-orm';

import { getUnsafeDb } from './unsafe';

type UnsafeDbTx = Parameters<
   Parameters<ReturnType<typeof getUnsafeDb>['transaction']>[0]
>[0];

/** A database transaction scoped to one user, so RLS policies apply to every query in it */
export interface RlsTx extends UnsafeDbTx {}

/** Work to run inside withRLS's transaction */
export type RlsTxHandler<T> = (tx: RlsTx) => Promise<T>;

/** Work that takes the RLS transaction first, then its own arguments */
export type RlsTxWork<Args extends unknown[], Result> = (
   tx: RlsTx,
   ...args: Args
) => Promise<Result>;

/** Extra work withRLS does before it runs fn */
export interface RlsOptions {
   /** Take the user's lock before fn runs. Every write route sets it. */
   lockUser?: boolean;
}

/**
 * Wraps work so it takes the current user's lock before anything else. The lock
 * is held until the transaction ends, so one user's locked work runs one at a time.
 */
export function withUserLock<Args extends unknown[], Result>(
   work: RlsTxWork<Args, Result>,
): RlsTxWork<Args, Result> {
   return async function lockedWork(tx, ...args) {
      // The key is the user withRLS set, so the lock can't name another user.
      // Without withRLS, current_setting raises an error instead of locking nothing.
      await tx.execute(
         sql`select pg_advisory_xact_lock(hashtextextended(current_setting('app.current_user_id'), 0))`,
      );
      return work(tx, ...args);
   };
}

// Not exported: withRLS stays the only public way into user data.
function withUserOnlyData<T>(
   fn: RlsTxHandler<T>,
): (userId: string) => Promise<T> {
   return async function userOnlyData(userId) {
      return getUnsafeDb().transaction(async (tx) => {
         await tx.execute(
            sql`select set_config('app.current_user_id', ${userId}, true)`,
         );
         return fn(tx);
      });
   };
}

/** Opens a transaction as the given user, so RLS filters every query to that user's rows, and runs fn in it */
export async function withRLS<T>(
   userId: string,
   fn: RlsTxHandler<T>,
   options: RlsOptions = {},
): Promise<T> {
   // The lock wraps fn, so it runs right after the user is set and before fn
   // touches a row: two of the user's requests can't take locks in opposite
   // orders and deadlock.
   const work = options.lockUser ? withUserLock(fn) : fn;
   return withUserOnlyData(work)(userId);
}
