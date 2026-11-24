/**
 * Synergy's contracts: what the server and the browser share. No database
 * code, so either side may import it (D199).
 */
export {
   SYNERGY_ERROR_CODE,
   SYNERGY_ERROR_STATUS,
   type SynergyErrorCode,
} from './errors';
export {
   ENTITY_STATUSES,
   type EntityStatus,
   entitySchema,
   type Entity,
   EXPLICIT_ENTITY_STATUSES,
   type ExplicitEntityStatus,
   setEntityStatusRequestSchema,
   type SetEntityStatusRequest,
} from './entity';
export {
   versionSchema,
   type Version,
   versionsPageSchema,
   type VersionsPage,
} from './version';
export {
   RELATION_KINDS,
   type RelationKind,
   RELATION_TYPE_STATUSES,
   type RelationTypeStatus,
   relationTypeSchema,
   type RelationType,
} from './relation-type';
