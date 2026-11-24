import { asc, eq, type InferSelectModel } from 'drizzle-orm';

import type { RlsTx } from '@sidekick/core/db';

import { relationTypes } from '../db/schema';

/** A row of relation_types, exactly as Drizzle returns it */
export interface RelationTypeRow extends InferSelectModel<
   typeof relationTypes
> {}

/** Every relation type, in a fixed order so the API answer is stable. */
export async function listRelationTypes(tx: RlsTx): Promise<RelationTypeRow[]> {
   return tx.select().from(relationTypes).orderBy(asc(relationTypes.sourceKey));
}

/**
 * One relation type by its source key, or undefined when there is none.
 * Segment 4's link create uses it to refuse an unknown or deprecated type.
 */
export async function getRelationType(
   tx: RlsTx,
   sourceKey: string,
): Promise<RelationTypeRow | undefined> {
   const [row] = await tx
      .select()
      .from(relationTypes)
      .where(eq(relationTypes.sourceKey, sourceKey))
      .limit(1);

   return row;
}
