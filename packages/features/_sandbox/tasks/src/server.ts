import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
   errorResponse,
   parseRequestBody,
   type ApiHandler,
} from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';
import { SYNERGY_ERROR_CODE } from '@sidekick/synergy/contracts';
import {
   identifyActor,
   registerEntity,
   saveEntityContent,
   synergyErrorResponse,
} from '@sidekick/synergy/server';

import {
   createTaskRequestSchema,
   saveTaskRequestSchema,
   type Task,
} from './contracts';
import { sandboxTasks } from './db/schema';
import { FEATURE_KEY } from './index';

/**
 * `POST /api/sandbox/tasks`: creates a task and registers its entity with
 * Synergy, in the guard's transaction. Answers 201 with the task.
 */
export const createTask: ApiHandler<unknown> = async function createTask({
   tx,
   req,
   caller,
}) {
   const parsed = await parseRequestBody(req, createTaskRequestSchema);
   if (!parsed.ok) {
      return parsed.response;
   }
   const { id, title, done } = parsed.data;

   // Order of operations, synergy's registerEntity or entity's own mutation,
   // doesn't matter for correctness: any error response or throw rolls
   // back both writes (D268).
   const entity = await registerEntity(tx, {
      id,
      provider: FEATURE_KEY,
      type: 'task',
      displayName: title,
      title,
      actor: identifyActor(caller),
   });

   const [timestamps] = await tx
      .insert(sandboxTasks)
      .values({
         id,
         userId: caller.userId,
         title,
         done,
      })
      .returning({
         createdAt: sandboxTasks.createdAt,
         updatedAt: sandboxTasks.updatedAt,
      });

   const task: Task = {
      id,
      title,
      done,
      contentSeq: entity.contentSeq,
      createdAt: timestamps.createdAt.toISOString(),
      updatedAt: timestamps.updatedAt.toISOString(),
   };

   return Response.json(task, { status: HTTP_STATUS.CREATED });
};

/** Next.js's second route-handler argument for `/api/sandbox/tasks/[id]` */
export interface TaskRouteContext {
   /** The route's dynamic segments */
   params: Promise<{ id: string }>;
}

/**
 * `PUT /api/sandbox/tasks/:id`: saves a task's title and done flag and bumps its
 * entity in Synergy. Answers 200 with the task, 404 when there's no such task
 * for the caller, or 409 `stale_content` when someone saved since the
 * editor's baseline.
 */
export const saveTask: ApiHandler<TaskRouteContext> = async function saveTask({
   tx,
   ctx,
   req,
   caller,
}) {
   // An id that isn't a uuid can't name a task: not found, never a 500
   const { id } = await ctx.params;

   if (z.uuid().safeParse(id).error) {
      return errorResponse(SYNERGY_ERROR_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const parsed = await parseRequestBody(req, saveTaskRequestSchema);
   if (!parsed.ok) {
      return parsed.response;
   }

   const { title, done, baselineContentSeq, bump, changeNote } = parsed.data;

   let updatedContentSeq: number;
   try {
      const entity = await saveEntityContent(tx, {
         id,
         baselineContentSeq,
         bump,
         changeNote,
         displayName: title,
         title,
         actor: identifyActor(caller),
      });

      updatedContentSeq = entity.contentSeq;
   } catch (error) {
      return synergyErrorResponse(error);
   }

   const [timestamps] = await tx
      .update(sandboxTasks)
      .set({
         title,
         done,
         updatedAt: sql`now()`,
      })
      .where(eq(sandboxTasks.id, id))
      .returning({
         createdAt: sandboxTasks.createdAt,
         updatedAt: sandboxTasks.updatedAt,
      });

   // The entity is live but the task isn't: answer not found, and the
   // rollback (D268) undoes the entity's bump
   if (!timestamps) {
      return errorResponse(SYNERGY_ERROR_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return Response.json(
      {
         id,
         title,
         done,
         contentSeq: updatedContentSeq,
         createdAt: timestamps.createdAt.toISOString(),
         updatedAt: timestamps.updatedAt.toISOString(),
      } satisfies Task,
      { status: HTTP_STATUS.OK },
   );
};
