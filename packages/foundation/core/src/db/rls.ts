import { sql } from 'drizzle-orm';

import { getUnsafeDb } from './unsafe';

type UnsafeDbTx = Parameters<
   Parameters<ReturnType<typeof getUnsafeDb>['transaction']>[0]
>[0];
export interface RlsTx extends UnsafeDbTx {}

export type RlsTxHandler<T> = (tx: RlsTx) => Promise<T>;

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
