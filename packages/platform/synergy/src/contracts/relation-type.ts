import { z } from 'zod';

/** A reference points at its target; an association only relates the two. */
export const RELATION_KINDS = ['reference', 'association'] as const;

/** Whether a link is a reference or an association */
export type RelationKind = (typeof RELATION_KINDS)[number];

/** A deprecated type stays on existing links but is refused on new ones. */
export const RELATION_TYPE_STATUSES = ['active', 'deprecated'] as const;

/** Whether a relation type can be chosen for new links */
export type RelationTypeStatus = (typeof RELATION_TYPE_STATUSES)[number];

/**
 * A relation type as Synergy's API returns it. Keys only (D201): the words
 * for each key come from Synergy's catalog.
 */
export const relationTypeSchema = z.object({
   // The name the link's source gives the relation: 'violates'
   sourceKey: z.string(),
   // The name the target gives it back: 'violated-by'
   targetKey: z.string(),
   kind: z.enum(RELATION_KINDS),
   status: z.enum(RELATION_TYPE_STATUSES),
   isSystem: z.boolean(),
});

/** A relation type as Synergy's API returns it */
export interface RelationType extends z.infer<typeof relationTypeSchema> {}
