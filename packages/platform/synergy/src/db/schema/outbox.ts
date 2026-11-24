import { sql } from 'drizzle-orm';
import {
   bigint,
   check,
   customType,
   index,
   jsonb,
   pgPolicy,
   pgRole,
   pgTable,
   text,
   uuid,
} from 'drizzle-orm/pg-core';

import { utcTimestamp } from '@sidekick/core/db/columns';
import { profiles } from '@sidekick/core/db/schema';

import { provenance, provenanceChecks, sqlList } from './columns';
import { ownRow } from './policies';

/**
 * Every kind of event Synergy writes. Keys only (D201). Each lesson adds the
 * events for what it builds, from the overview's list.
 */
export const OUTBOX_EVENT_KINDS = [
   'entity.created',
   'entity.content_saved',
   'entity.version_bumped',
   'entity.status_changed',
] as const;

/**
 * The read-only role outbox readers connect as. Created in migration 0010,
 * so Drizzle only refers to it.
 */
export const outboxReader = pgRole('outbox_reader').existing();

/**
 * Postgres's 64-bit transaction id. Drizzle has no built-in for it; it reads
 * as a string, because it can exceed JavaScript's safe integer range.
 */
const xid8 = customType<{ data: string; driverData: string }>({
   dataType: () => 'xid8',
});

/**
 * One row per change event, written in the same transaction as the change,
 * for readers that work across users (notifications, search, push).
 *
 * Delete model: hard delete. Non-syncable: no device reads it, and a pruning
 * job deletes events every reader has processed (Synergy store choices).
 */
export const outbox = pgTable(
   'outbox',
   {
      // Orders the events inside one transaction; xact_id orders transactions.
      id: bigint('id', { mode: 'number' })
         .primaryKey()
         .generatedAlwaysAsIdentity(),
      // The transaction that wrote the event. Can't be rebuilt later.
      xactId: xid8('xact_id')
         .notNull()
         .default(sql`pg_current_xact_id()`),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      kind: text('kind', { enum: OUTBOX_EVENT_KINDS }).notNull(),
      // The entity, link or tag the event is about. No foreign key: an event
      // must outlive its subject (an entity erased).
      subjectId: uuid('subject_id').notNull(),
      payload: jsonb('payload').notNull().default({}),
      createdAt: utcTimestamp('created_at').notNull().defaultNow(),
      ...provenance,
   },
   (self) => [
      index('outbox_xact_id_id_idx').on(self.xactId, self.id),
      check(
         'outbox_kind_check',
         sql`${self.kind} IN (${sqlList(OUTBOX_EVENT_KINDS)})`,
      ),
      ...provenanceChecks('outbox', self),
      // Insert only: app_runtime writes its own user's events and reads none.
      pgPolicy('outbox_insert_own_rows', {
         for: 'insert',
         withCheck: ownRow(self),
      }),
      // Readers work across users: outbox_reader sees every row.
      pgPolicy('outbox_reader_reads_every_row', {
         for: 'select',
         to: outboxReader,
         using: sql`true`,
      }),
   ],
);
