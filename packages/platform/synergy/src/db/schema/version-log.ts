import { sql } from 'drizzle-orm';
import {
   check,
   integer,
   pgTable,
   text,
   uniqueIndex,
   uuid,
} from 'drizzle-orm/pg-core';

import { profiles } from '@sidekick/core/db/schema';

import { provenance, provenanceChecks, timestamps, tombstone } from './columns';
import { entityIndex } from './entity-index';
import { ownRowsPolicy } from './policies';

/**
 * One row per version bump, written by saveEntityContent in the same transaction.
 * Delete model: soft delete, tombstones visible (D66), like entity_index.
 */
export const versionLog = pgTable(
   'version_log',
   {
      // Written by Synergy on the server, never by an offline client.
      id: uuid('id').primaryKey().defaultRandom(),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      entityId: uuid('entity_id')
         .notNull()
         .references(() => entityIndex.id, { onDelete: 'cascade' }),
      version: integer('version').notNull(),
      // Optional and stored as written: user content.
      changeNote: text('change_note'),
      ...timestamps,
      ...provenance,
      ...tombstone,
   },
   (self) => [
      // Partial: a tombstoned row never blocks logging the same version again.
      uniqueIndex('version_log_entity_id_version_key')
         .on(self.entityId, self.version)
         .where(sql`${self.deletedAt} IS NULL`),
      check('version_log_version_check', sql`${self.version} > 0`),
      ...provenanceChecks('version_log', self),
      ownRowsPolicy('version_log', self),
   ],
);
