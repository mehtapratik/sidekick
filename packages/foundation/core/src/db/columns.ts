import { timestamp } from 'drizzle-orm/pg-core';

// Column conventions every package's tables share. Spread them into each
// pgTable: Drizzle builds a fresh column per table.

/** A timestamp column stored with its time zone */
export function utcTimestamp(name: string): ReturnType<typeof timestamp> {
   return timestamp(name, { withTimezone: true });
}

/** created_at and updated_at, both set to now() on insert */
export const timestamps = {
   createdAt: utcTimestamp('created_at').notNull().defaultNow(),
   updatedAt: utcTimestamp('updated_at').notNull().defaultNow(),
};

/** deleted_at: NULL while the row is live. A soft-deleted row (a tombstone) keeps its data. */
export const tombstone = {
   deletedAt: utcTimestamp('deleted_at'),
};
