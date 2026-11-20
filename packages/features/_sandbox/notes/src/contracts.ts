import { z } from 'zod';

// What the notes sandbox's API accepts and returns. Shared by its routes and,
// later, its UI; no database code.

/**
 * A note's body: a Tiptap document as JSON. Only the outer shape is checked,
 * a `doc` node holding a list of nodes; the editor owns everything inside.
 */
export const noteBodySchema = z.looseObject({
   type: z.literal('doc'),
   content: z.array(z.looseObject({ type: z.string() })).optional(),
});

/** A note's body: a Tiptap document as JSON */
export interface NoteBody extends z.infer<typeof noteBodySchema> {}

/** What `POST /api/sandbox/notes` accepts */
export const createNoteRequestSchema = z.object({
   // Client-generated, so the editor knows the id before the first save
   id: z.uuid(),
   title: z.string().trim().min(1).max(200),
   body: noteBodySchema,
});

/** What `POST /api/sandbox/notes` accepts */
export interface CreateNoteRequest extends z.infer<
   typeof createNoteRequestSchema
> {}

/** A note as the API returns it */
export const noteSchema = z.object({
   // The note's id, which is also its entity's id
   id: z.uuid(),
   title: z.string(),
   body: noteBodySchema,
   // The entity's content_seq: the baseline the next save sends
   contentSeq: z.int(),
   createdAt: z.iso.datetime(),
   updatedAt: z.iso.datetime(),
});

/** A note as the API returns it */
export interface Note extends z.infer<typeof noteSchema> {}

/** What `PUT /api/sandbox/notes/:id` accepts */
export const saveNoteRequestSchema = z.object({
   title: z.string().trim().min(1).max(200),
   body: noteBodySchema,
   // The contentSeq the editor started from: a save based on anything older
   // is stale and answers 409
   baselineContentSeq: z.int().nonnegative(),
   // The author flags a version; every other save is a revision
   bump: z.enum(['version', 'revision']).default('revision'),
   // An optional note logged with a version bump
   changeNote: z.string().trim().max(500).optional(),
});

/** What `PUT /api/sandbox/notes/:id` accepts */
export interface SaveNoteRequest extends z.infer<
   typeof saveNoteRequestSchema
> {}
