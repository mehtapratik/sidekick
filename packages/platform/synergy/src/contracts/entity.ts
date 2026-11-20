import { z } from 'zod';

/** The lifecycle states an entity can be in */
export const ENTITY_STATUSES = ['active', 'deprecated', 'superseded'] as const;

/** The lifecycle states an entity can be in */
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

/**
 * An entity as Synergy's API returns it: its index fields, never its owner or
 * provenance. Timestamps are ISO 8601 strings.
 */
export const entitySchema = z.object({
   id: z.uuid(),
   // Keys, never labels (D201): 'sandbox-notes', 'note'
   provider: z.string(),
   type: z.string(),
   displayName: z.string(),
   title: z.string().optional(),
   status: z.enum(ENTITY_STATUSES),
   version: z.int(),
   revision: z.int(),
   // The stale-write token and the ETag
   contentSeq: z.int(),
   editedAt: z.iso.datetime(),
   createdAt: z.iso.datetime(),
   updatedAt: z.iso.datetime(),
});

/** An entity as Synergy's API returns it */
export interface Entity extends z.infer<typeof entitySchema> {}
