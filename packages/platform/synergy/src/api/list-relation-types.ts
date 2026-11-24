import type { ApiHandler } from '@sidekick/core/api';

import type { RelationType } from '../contracts';
import {
   listRelationTypes,
   type RelationTypeRow,
} from '../repository/relation-types';

/** Maps a relation_types row to the RelationType the API returns */
export function toRelationType(row: RelationTypeRow): RelationType {
   return row;
}

/**
 * `GET /api/synergy/relation-types`: the whole vocabulary, system rows
 * included. The table is small and the same for every user, so there is
 * no paging.
 */
export const listRelationTypesHandler: ApiHandler<never> =
   async function listRelationTypesHandler({ tx }) {
      const rows = await listRelationTypes(tx);
      const body: RelationType[] = rows.map(toRelationType);
      return Response.json(body);
   };
