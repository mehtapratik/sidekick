import { sql, type SQL } from 'drizzle-orm';
import {
   check,
   text,
   timestamp,
   uuid,
   type AnyPgColumn,
   type CheckBuilder,
} from 'drizzle-orm/pg-core';

// Columns every Synergy table carries (Synergy overview, "Every table").
// Spread them into each pgTable: Drizzle builds a fresh column per table.

/** A timestamp column stored with its time zone */
export function utcTimestamp(name: string): ReturnType<typeof timestamp> {
   return timestamp(name, { withTimezone: true });
}

/**
 * Renders our own constants as a SQL list: 'a', 'b'. sql.raw pastes text
 * unescaped, so never pass it anything a user typed.
 */
export function sqlList(values: readonly string[]): SQL {
   return sql.raw(values.map((value) => `'${value}'`).join(', '));
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

/** The kinds of actor that can write a row. Keys only (D201). */
export const ACTOR_KINDS = ['human', 'system', 'agent', 'api_key'] as const;

/** Who made the row's last write (actor_kind, actor_id), and why (reason) */
export const provenance = {
   actorKind: text('actor_kind', { enum: ACTOR_KINDS }).notNull(),
   actorId: uuid('actor_id'),
   reason: text('reason'),
};

/**
 * The database's half of the provenance contract. Call it in each table's
 * third pgTable argument: ...provenanceChecks('entity_index', self)
 */
export function provenanceChecks(
   table: string,
   self: { actorKind: AnyPgColumn; actorId: AnyPgColumn },
): [CheckBuilder, CheckBuilder] {
   return [
      check(
         `${table}_actor_kind_check`,
         sql`${self.actorKind} IN (${sqlList(ACTOR_KINDS)})`,
      ),
      check(
         `${table}_actor_id_check`,
         sql`(${self.actorKind} = 'system') = (${self.actorId} IS NULL)`,
      ),
   ];
}
