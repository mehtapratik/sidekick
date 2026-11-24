import { and, desc, eq, lt, type InferSelectModel } from 'drizzle-orm';

import type { RlsTx } from '@sidekick/core/db';

import { versionLog } from '../db/schema';

/** A row of version_log, exactly as Drizzle returns it */
export interface VersionLogRow extends InferSelectModel<typeof versionLog> {}

/** Which page of an entity's version log to read */
export interface ListVersionsOptions {
   /** The entity whose versions to list */
   entityId: string;
   /** Only versions below this one; leave it out for the first page */
   before?: number;
   /** At most this many rows */
   limit: number;
}

/**
 * One page of an entity's version log, newest first. RLS limits it to the
 * user's own rows; the unique (entity_id, version) index serves the query.
 */
export async function listVersions(
   tx: RlsTx,
   options: ListVersionsOptions,
): Promise<VersionLogRow[]> {
   const { entityId, before, limit } = options;

   return tx
      .select()
      .from(versionLog)
      .where(
         and(
            eq(versionLog.entityId, entityId),
            before === undefined ? undefined : lt(versionLog.version, before),
         ),
      )
      .orderBy(desc(versionLog.version))
      .limit(limit);
}
