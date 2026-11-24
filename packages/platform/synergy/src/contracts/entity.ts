import { z } from 'zod';

/**
 * The statuses a user can set by hand. Superseded is set only when another
 * entry replaces this one (lesson 8).
 */
export const EXPLICIT_ENTITY_STATUSES = ['active', 'deprecated'] as const;

/** A status a person can set by hand */
export type ExplicitEntityStatus = (typeof EXPLICIT_ENTITY_STATUSES)[number];

/** The body of `PATCH /api/synergy/entities/:id/status` */
export const setEntityStatusRequestSchema = z.object({
   status: z.enum(EXPLICIT_ENTITY_STATUSES),
});

/** The body of `PATCH /api/synergy/entities/:id/status` */
export interface SetEntityStatusRequest extends z.infer<
   typeof setEntityStatusRequestSchema
> {}

/** The lifecycle states an entity can be in */
export const ENTITY_STATUSES = [
   ...EXPLICIT_ENTITY_STATUSES,
   'superseded',
] as const;

/** The lifecycle states an entity can be in. One of `ENTITY_STATUSES` values.*/
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
   // The stale-write token a save sends back as its baseline
   contentSeq: z.int(),
   editedAt: z.iso.datetime(),
   createdAt: z.iso.datetime(),
   updatedAt: z.iso.datetime(),
});

/** An entity as Synergy's API returns it */
export interface Entity extends z.infer<typeof entitySchema> {}
