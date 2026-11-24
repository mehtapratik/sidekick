import { sql, type SQL } from 'drizzle-orm';
import { pgPolicy, type AnyPgColumn, type PgPolicy } from 'drizzle-orm/pg-core';

/**
 * True when the row belongs to the user withRLS set. Compares only user_id,
 * never deleted_at: tombstones stay visible to the repository, which filters
 * deleted rows itself (D66).
 */
export function ownRow(self: { userId: AnyPgColumn }): SQL {
   // nullif: once a withRLS transaction ends, its pooled connection reads the
   // setting back as '' (not NULL), and ''::uuid would throw.
   return sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid`;
}

/** Synergy's row-level security: a user reads and writes only their own rows */
export function ownRowsPolicy(
   tableName: string,
   self: { userId: AnyPgColumn },
): PgPolicy {
   return pgPolicy(`${tableName}_own_rows`, {
      for: 'all',
      using: ownRow(self),
      withCheck: ownRow(self),
   });
}
