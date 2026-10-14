import { sql } from 'drizzle-orm';

import { unsafeDb } from './unsafe';

export type RlsTx = Parameters<Parameters<typeof unsafeDb.transaction>[0]>[0];

export async function withRLS<T>(userId: string, fn: (tx: RlsTx) => Promise<T>): Promise<T> {
  return unsafeDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
