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
   type Actor,
   type EntityIndexRow,
   type GetEntityOptions,
   type RegisterEntityPayload,
   type SaveEntityContentPayload,
} from './repository/entities';
export { synergyErrorResponse } from './api/error-response';
export { SynergyError } from './repository/errors';
