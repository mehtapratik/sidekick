import { z } from 'zod';

import {
   errorResponse,
   parseRequestBody,
   type ApiHandler,
} from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';

import { setEntityStatusRequestSchema } from '../contracts/entity';
import { SYNERGY_ERROR_CODE } from '../contracts/errors';
import { setEntityStatus } from '../repository/entities';
import { identifyActor } from './actor';
import { entityETag, toEntity, type EntityRouteContext } from './entity';
import { synergyErrorResponse } from './error-response';

/**
 * `PATCH /api/synergy/entities/:id/status` with `{ "status": "deprecated" }`
 * or `"active"`: answers the entity after the change, with its new ETag.
 * Another user's id, a deleted entity and an id that never existed all
 * answer 404 (D209).
 */
export const changeEntityStatus: ApiHandler<EntityRouteContext> =
   async function changeEntityStatus({ tx, req, ctx, caller }) {
      const { id } = await ctx.params;
      if (z.uuid().safeParse(id).error) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      const parsed = await parseRequestBody(req, setEntityStatusRequestSchema);
      if (!parsed.ok) {
         return parsed.response;
      }

      try {
         const row = await setEntityStatus(tx, {
            id,
            status: parsed.data.status,
            actor: identifyActor(caller),
         });
         const entity = toEntity(row);

         return Response.json(entity, {
            headers: {
               'ETag': entityETag(entity),
               'Cache-Control': 'private, no-cache',
            },
         });
      } catch (error) {
         return synergyErrorResponse(error);
      }
   };
