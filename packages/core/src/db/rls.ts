import { sql } from 'drizzle-orm'

import { db } from './'

export async function withRLS<T>(
  userId: string,
  fn: (db: typeof import('./index').db) => Promise<T>,
): Promise<T> {
  await db.execute(sql`select set_config('app.current_user_id', ${userId}, true)`)
  return await fn(db)
}
