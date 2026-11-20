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
   createNoteRequestSchema,
   saveNoteRequestSchema,
   type Note,
} from './contracts';
import { sandboxNotes } from './db/schema';
import { ENTITY_TYPE, FEATURE_KEY } from './index';

/**
 * `POST /api/sandbox/notes`: creates a note and registers its entity with
 * Synergy, in the guard's transaction. Answers 201 with the note.
 */
export const createNote: ApiHandler<unknown> = async function createNote({
   tx,
   caller,
   req,
}) {
   const parsed = await parseRequestBody(req, createNoteRequestSchema);
   if (!parsed.ok) {
      return parsed.response;
   }
   const { id, title, body } = parsed.data;

   // Order of operations, synergy's registerEntity or entity's own mutation,
   // doesn't matter for correctness: any error response or throw rolls
   // back both writes (D268).
   const entity = await registerEntity(tx, {
      id,
      provider: FEATURE_KEY,
      type: ENTITY_TYPE.NOTE,
      displayName: title,
      title,
      actor: identifyActor(caller),
   });

   const [timestamps] = await tx
      .insert(sandboxNotes)
      .values({
         id,
         userId: caller.userId,
         title,
         body,
      })
      .returning({
         createdAt: sandboxNotes.createdAt,
         updatedAt: sandboxNotes.updatedAt,
      });

   const note: Note = {
      id,
      title,
      body,
      contentSeq: entity.contentSeq,
      createdAt: timestamps.createdAt.toISOString(),
      updatedAt: timestamps.updatedAt.toISOString(),
   };

   return Response.json(note, { status: HTTP_STATUS.CREATED });
};

/** Next.js's second route-handler argument for `/api/sandbox/notes/[id]` */
export interface NoteRouteContext {
   /** The route's dynamic segments */
   params: Promise<{ id: string }>;
}

/**
 * `PUT /api/sandbox/notes/:id`: saves a note's title and body and bumps its
 * entity in Synergy. Answers 200 with the note, 404 when there's no such note
 * for the caller, or 409 `stale_content` when someone saved since the
 * editor's baseline.
 */
export const saveNote: ApiHandler<NoteRouteContext> = async function saveNote({
   tx,
   ctx,
   req,
   caller,
}) {
   // An id that isn't a uuid can't name a note: not found, never a 500
   const { id } = await ctx.params;

   if (z.uuid().safeParse(id).error) {
      return errorResponse(SYNERGY_ERROR_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   const parsed = await parseRequestBody(req, saveNoteRequestSchema);
   if (!parsed.ok) {
      return parsed.response;
   }

   const { title, body, baselineContentSeq, bump, changeNote } = parsed.data;

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
      .update(sandboxNotes)
      .set({
         title,
         body,
         updatedAt: sql`now()`,
      })
      .where(eq(sandboxNotes.id, id))
      .returning({
         createdAt: sandboxNotes.createdAt,
         updatedAt: sandboxNotes.updatedAt,
      });

   // The entity is live but the note isn't: answer not found, and the
   // rollback (D268) undoes the entity's bump
   if (!timestamps) {
      return errorResponse(SYNERGY_ERROR_CODE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
   }

   return Response.json(
      {
         id,
         title,
         body,
         contentSeq: updatedContentSeq,
         createdAt: timestamps.createdAt.toISOString(),
         updatedAt: timestamps.updatedAt.toISOString(),
      } satisfies Note,
      { status: HTTP_STATUS.OK },
   );
};
