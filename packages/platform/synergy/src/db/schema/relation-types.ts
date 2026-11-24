import { sql } from 'drizzle-orm';
import { boolean, check, pgPolicy, pgTable, text } from 'drizzle-orm/pg-core';

import { timestamps } from '@sidekick/core/db/columns';

import {
   RELATION_KINDS,
   RELATION_TYPE_STATUSES,
} from '../../contracts/relation-type';
import { sqlList } from './columns';

/**
 * The vocabulary every link's type points at. Keys only (D201): the words
 * for each key arrive with Synergy's own catalog (lesson I1).
 *
 * Global: the same for every user, with no user_id. app_runtime may only read
 * it; rows come from migrations. A symmetric type (related-to) has the same
 * key on both sides.
 *
 * Delete model: hard delete. A type is deprecated by status, never deleted.
 */
export const relationTypes = pgTable(
   'relation_types',
   {
      // The name the link's source gives the relation ("violates").
      sourceKey: text('source_key').primaryKey(),
      // The name the target gives it back ("violated-by").
      targetKey: text('target_key').notNull(),
      kind: text('kind', { enum: RELATION_KINDS }).notNull(),
      status: text('status', { enum: RELATION_TYPE_STATUSES })
         .notNull()
         .default('active'),
      // System rows (untyped, superseded-by) are Synergy's own, not vocabulary.
      isSystem: boolean('is_system').notNull().default(false),
      ...timestamps,
   },
   (self) => [
      check(
         'relation_types_kind_check',
         sql`${self.kind} IN (${sqlList(RELATION_KINDS)})`,
      ),
      check(
         'relation_types_status_check',
         sql`${self.status} IN 
        (${sqlList(RELATION_TYPE_STATUSES)})`,
      ),
      // Every user reads the same rows. No write policy: with RLS on, no
      // policy means no write, and the migration revokes the grants as well.
      pgPolicy('relation_types_read_all', {
         for: 'select',
         using: sql`true`,
      }),
   ],
);
