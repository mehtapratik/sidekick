import { z } from 'zod';

// What the tasks sandbox's API accepts and returns. Shared by its routes and,
// later, its UI; no database code.

/** What `POST /api/sandbox/tasks` accepts */
export const createTaskRequestSchema = z.object({
   // Client-generated, so the client knows the id before the first save
   id: z.uuid(),
   title: z.string().trim().min(1).max(200),
   done: z.boolean().default(false),
});

/** What `POST /api/sandbox/tasks` accepts */
export interface CreateTaskRequest extends z.infer<
   typeof createTaskRequestSchema
> {}

/** A task as the API returns it */
export const taskSchema = z.object({
   // The task's id, which is also its entity's id
   id: z.uuid(),
   title: z.string(),
   done: z.boolean(),
   // The entity's content_seq: the baseline the next save sends
   contentSeq: z.int(),
   createdAt: z.iso.datetime(),
   updatedAt: z.iso.datetime(),
});

/** A task as the API returns it */
export interface Task extends z.infer<typeof taskSchema> {}

/** What `PUT /api/sandbox/tasks/:id` accepts */
export const saveTaskRequestSchema = z.object({
   title: z.string().trim().min(1).max(200),
   done: z.boolean(),
   // The contentSeq the client started from: a save based on anything older
   // is stale and answers 409
   baselineContentSeq: z.int().nonnegative(),
   // The author flags a version; every other save is a revision
   bump: z.enum(['version', 'revision']).default('revision'),
   // An optional note logged with a version bump
   changeNote: z.string().trim().max(500).optional(),
});

/** What `PUT /api/sandbox/tasks/:id` accepts */
export interface SaveTaskRequest extends z.infer<
   typeof saveTaskRequestSchema
> {}
