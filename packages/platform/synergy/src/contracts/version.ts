import { z } from 'zod';

/** One version bump as Synergy's API returns it, without its provenance */
export const versionSchema = z.object({
   version: z.int().positive(),
   changeNote: z.string().optional(),
   createdAt: z.iso.datetime(),
});

/** One version bump as Synergy's API returns it */
export interface Version extends z.infer<typeof versionSchema> {}

/**
 * One page of `GET /api/synergy/entities/:id/versions`, newest first.
 * `nextCursor` is null on the last page.
 */
export const versionsPageSchema = z.object({
   versions: z.array(versionSchema),
   nextCursor: z.string().nullable(),
});

/** One page of an entity's versions */
export interface VersionsPage extends z.infer<typeof versionsPageSchema> {}
