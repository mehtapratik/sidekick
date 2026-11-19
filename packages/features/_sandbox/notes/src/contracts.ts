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
export interface Note {
   /** The note's id, which is also its entity's id */
   id: string;
   /** The note's title */
   title: string;
   /** The note's body */
   body: NoteBody;
   /** The entity's content_seq: the baseline the next save sends */
   contentSeq: number;
   /** When the note was created, as an ISO 8601 string */
   createdAt: string;
   /** When the note was last saved, as an ISO 8601 string */
   updatedAt: string;
}
