import { sql, type SQL } from 'drizzle-orm';
import {
   check,
   text,
   uuid,
   type AnyPgColumn,
   type CheckBuilder,
} from 'drizzle-orm/pg-core';

// Columns only Synergy's tables carry: who wrote a row, and why. The shared
// conventions (timestamps, tombstone) come from @sidekick/core/db/columns.

/**
 * Renders our own constants as a SQL list: 'a', 'b'. sql.raw pastes text
 * unescaped, so never pass it anything a user typed.
 */
export function sqlList(values: readonly string[]): SQL {
   return sql.raw(values.map((value) => `'${value}'`).join(', '));
}

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
