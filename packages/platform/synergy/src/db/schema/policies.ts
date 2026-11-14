import { sql } from 'drizzle-orm';
import { pgPolicy, type AnyPgColumn, type PgPolicy } from 'drizzle-orm/pg-core';

// Synergy's row-level security: a user reads and writes only their own rows.
// It compares only user_id, never deleted_at: tombstones stay visible to the
// repository, which filters deleted rows itself (D66).
export function ownRowsPolicy(
   tableName: string,
   self: { userId: AnyPgColumn },
): PgPolicy {
   // nullif: once a withRLS transaction ends, its pooled connection reads the
   // setting back as '' (not NULL), and ''::uuid would throw.
   const ownRow = sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid`;

   return pgPolicy(`${tableName}_own_rows`, {
      for: 'all',
      using: ownRow,
      withCheck: ownRow,
   });
}
