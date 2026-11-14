import { sql } from 'drizzle-orm';
import {
   check,
   index,
   integer,
   pgTable,
   text,
   uuid,
} from 'drizzle-orm/pg-core';

import { profiles } from '@sidekick/core/db/schema';

import {
   provenance,
   provenanceChecks,
   sqlList,
   timestamps,
   tombstone,
   utcTimestamp,
} from './columns';
import { ownRowsPolicy } from './policies';

// Delete model: soft delete, tombstones visible (D66). RLS compares only
// user_id; the repository filters deleted_at in each query that wants live rows.

export const ENTITY_STATUSES = ['active', 'deprecated', 'superseded'] as const;

export const entityIndex = pgTable(
   'entity_index',
   {
      // Client-generated, so the editor knows the id before the first save.
      id: uuid('id').primaryKey(),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      // Keys, never labels (D201): 'sandbox-notes', 'note'.
      provider: text('provider').notNull(),
      type: text('type').notNull(),
      // User content, stored as written.
      displayName: text('display_name').notNull(),
      title: text('title'),
      status: text('status', { enum: ENTITY_STATUSES })
         .notNull()
         .default('active'),
      version: integer('version').notNull().default(1),
      revision: integer('revision').notNull().default(0),
      // Moves on every content write, anchors included: the stale-write token.
      contentSeq: integer('content_seq').notNull().default(0),
      editedAt: utcTimestamp('edited_at').notNull().defaultNow(),
      ...timestamps,
      ...provenance,
      ...tombstone,
   },
   (self) => [
      index('entity_index_user_id_status_idx').on(self.userId, self.status),
      check(
         'entity_index_status_check',
         sql`${self.status} IN (${sqlList(ENTITY_STATUSES)})`,
      ),
      check(
         'entity_index_counters_check',
         sql`${self.version} > 0 AND ${self.revision} >= 0 AND ${self.contentSeq} >= 0`,
      ),
      ...provenanceChecks('entity_index', self),
      ownRowsPolicy('entity_index', self),
   ],
);
