import { sql } from 'drizzle-orm';

import { getUnsafeDb } from './unsafe';

type UnsafeDbTx = Parameters<
   Parameters<ReturnType<typeof getUnsafeDb>['transaction']>[0]
>[0];

/** A database transaction scoped to one user, so RLS policies apply to every query in it */
export interface RlsTx extends UnsafeDbTx {}

/** Work to run inside withRLS's transaction */
export type RlsTxHandler<T> = (tx: RlsTx) => Promise<T>;

/** Opens a transaction as the given user, so RLS filters every query to that user's rows, and runs fn in it */
export async function withRLS<T>(
   userId: string,
   fn: RlsTxHandler<T>,
): Promise<T> {
   return getUnsafeDb().transaction(async (tx) => {
      await tx.execute(
         sql`select set_config('app.current_user_id', ${userId}, true)`,
      );
      return fn(tx);
   });
}
