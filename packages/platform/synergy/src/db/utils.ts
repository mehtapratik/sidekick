import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export function increment(
   column: AnyPgColumn<{ dataType: 'number' }>,
): SQL<unknown> {
   return sql`${column} + 1`;
}
