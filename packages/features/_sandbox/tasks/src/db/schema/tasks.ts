import { sql } from 'drizzle-orm';
import { boolean, pgPolicy, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps, tombstone } from '@sidekick/core/db/columns';
import { profiles } from '@sidekick/core/db/schema';

/**
 * One row per sandbox task. Its id is its entity's id in Synergy's
 * entity_index, enforced by a deferrable foreign key (migration 0001).
 *
 * Delete model: soft delete, tombstones hidden. A deleted task is invisible to
 * every query and frozen; nothing restores it.
 */
export const sandboxTasks = pgTable(
   'sandbox_tasks',
   {
      // Client-generated, and the same id as the task's entity_index row.
      id: uuid('id').primaryKey(),
      userId: uuid('user_id')
         .notNull()
         .references(() => profiles.id, { onDelete: 'cascade' }),
      title: text('title').notNull(),
      done: boolean('done').notNull().default(false),
      ...timestamps,
      ...tombstone,
   },
   (self) => [
      // Own live rows: USING hides tombstones as well as other users' rows.
      // WITH CHECK leaves deleted_at out, so an update may set it (the soft
      // delete). nullif: a pooled connection reads the setting back as '',
      // and ''::uuid would throw.
      pgPolicy('sandbox_tasks_own_live_rows', {
         for: 'all',
         using: sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid AND ${self.deletedAt} IS NULL`,
         withCheck: sql`${self.userId} = nullif(current_setting('app.current_user_id', true), '')::uuid`,
      }),
   ],
);
