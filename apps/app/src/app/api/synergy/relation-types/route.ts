import { withApiGuard } from '@sidekick/core/api';
import { listRelationTypesHandler } from '@sidekick/synergy/server';

/** Lists the relation-type vocabulary (see listRelationTypesHandler) */
export const GET = withApiGuard(listRelationTypesHandler);
