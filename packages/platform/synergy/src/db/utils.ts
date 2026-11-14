import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/** SQL that adds one to a numeric column, for use in an UPDATE's set */
export function increment(
   column: AnyPgColumn<{ dataType: 'number' }>,
): SQL<unknown> {
   return sql`${column} + 1`;
}
