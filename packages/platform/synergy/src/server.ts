import 'server-only';

/**
 * Synergy's server entry point: the repository providers call inside their
 * withRLS transaction. server-only makes a browser bundle that imports it
 * fail to build (D199).
 */
export {
   getEntity,
   registerEntity,
   saveEntityContent,
   type EntityIndexRow,
   type GetEntityOptions,
   type RegisterEntityPayload,
   type SaveEntityContentPayload,
} from './repository/entities';
export { synergyErrorResponse } from './api/error-response';
export { SynergyError } from './repository/errors';
export { identifyActor } from './api/actor';
export { toEntity, type EntityRouteContext } from './api/entity';
export { readEntity } from './api/read-entity';
export { type Actor } from './repository/actor';
export { changeEntityStatus } from './api/change-entity-status';
export { listEntityVersions } from './api/list-versions';
export { listRelationTypesHandler } from './api/list-relation-types';
