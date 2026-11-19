import 'server-only';

import { parseRequestBody, type ApiHandler } from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';
import { identifyActor, registerEntity } from '@sidekick/synergy/server';

import { createNoteRequestSchema, type Note } from './contracts';
import { sandboxNotes } from './db/schema';
import { FEATURE_KEY } from './index';

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

   // Synergy first, then the note: the guard commits whatever a handler
   // returns, so every check that can fail runs before our own write.
   const entity = await registerEntity(tx, {
      id,
      provider: FEATURE_KEY,
      type: 'note',
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
