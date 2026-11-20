import { z } from 'zod';

import { errorResponse, type ApiHandler } from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';

import { SYNERGY_ERROR_CODE } from '../contracts/errors';
import { getEntity } from '../repository/entities';
import { toEntity } from './entity';

/** Next.js's second route-handler argument for `/api/synergy/entities/[id]` */
export interface EntityRouteContext {
   /** The route's dynamic segments */
   params: Promise<{ id: string }>;
}

/**
 * Whether an `If-None-Match` header names this ETag. The header may list
 * several ETags, mark them weak (`W/"4"`) or be `*`.
 */
export function matchesIfNoneMatch(
   ifNoneMatch: string | null,
   etag: string,
): boolean {
   if (!ifNoneMatch) {
      return false;
   }

   return ifNoneMatch
      .split(',')
      .map((tag) => tag.trim().replace(/^W\//, ''))
      .some((tag) => tag === '*' || tag === etag);
}

/**
 * `GET /api/synergy/entities/:id`: an entity's index fields with
 * `ETag: "<content_seq>"`, or 304 with no body when the caller's
 * `If-None-Match` already names it (D210). Another user's id, a deleted
 * entity and an id that never existed all answer 404 (D209).
 */
export const readEntity: ApiHandler<EntityRouteContext> =
   async function readEntity({ tx, req, ctx }) {
      const { id } = await ctx.params;
      if (z.uuid().safeParse(id).error) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      const row = await getEntity(tx, id, { includeDeleted: false });
      if (!row) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      const etag = `"${row.contentSeq}"`;
      // private: only the caller's browser may store it; no-cache: it must ask
      // (cheaply, with If-None-Match) before reusing it
      const headers = { 'ETag': etag, 'Cache-Control': 'private, no-cache' };

      if (matchesIfNoneMatch(req.headers.get('if-none-match'), etag)) {
         return new Response(null, {
            status: HTTP_STATUS.NOT_MODIFIED,
            headers,
         });
      }

      return Response.json(toEntity(row), { headers });
   };
