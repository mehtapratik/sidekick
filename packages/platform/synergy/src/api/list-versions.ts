import { z } from 'zod';

import { errorResponse, type ApiHandler } from '@sidekick/core/api';
import { HTTP_STATUS } from '@sidekick/core/http';

import { SYNERGY_ERROR_CODE } from '../contracts/errors';
import type { Version, VersionsPage } from '../contracts/version';
import { getEntity } from '../repository/entities';
import { listVersions, type VersionLogRow } from '../repository/versions';
import type { EntityRouteContext } from './entity';
import { decodeVersionCursor, encodeVersionCursor } from './version-cursor';

/** How many versions one page holds */
const PAGE_SIZE = 20;

/** Maps a version_log row to the Version the API returns */
function toVersion(row: VersionLogRow): Version {
   return {
      version: row.version,
      changeNote: row.changeNote ?? undefined,
      createdAt: row.createdAt.toISOString(),
   };
}

/**
 * `GET /api/synergy/entities/:id/versions[?cursor=…]`: one page of the
 * entity's versions, newest first, with the cursor for the next page.
 * Another user's id, a deleted entity and an id that never existed all
 * answer 404 (D209); a cursor this API didn't make answers 400.
 */
export const listEntityVersions: ApiHandler<EntityRouteContext> =
   async function listEntityVersions({ tx, req, ctx }) {
      const { id } = await ctx.params;
      if (z.uuid().safeParse(id).error) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      const cursor = new URL(req.url).searchParams.get('cursor');
      const before = cursor === null ? undefined : decodeVersionCursor(cursor);
      if (cursor !== null && before === undefined) {
         return errorResponse(
            SYNERGY_ERROR_CODE.INVALID_CURSOR,
            HTTP_STATUS.BAD_REQUEST,
         );
      }

      const entity = await getEntity(tx, id, { includeDeleted: false });
      if (!entity) {
         return errorResponse(
            SYNERGY_ERROR_CODE.NOT_FOUND,
            HTTP_STATUS.NOT_FOUND,
         );
      }

      // One row more than a page: if it comes back, there is a next page
      const rows = await listVersions(tx, {
         entityId: id,
         before,
         limit: PAGE_SIZE + 1,
      });
      const page = rows.slice(0, PAGE_SIZE);
      const last = page.at(-1);
      const hasMore = rows.length > PAGE_SIZE;

      const body: VersionsPage = {
         versions: page.map(toVersion),
         nextCursor: hasMore && last ? encodeVersionCursor(last.version) : null,
      };
      return Response.json(body);
   };
