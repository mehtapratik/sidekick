import type { Entity } from '../contracts/entity';
import type { EntityIndexRow } from '../repository/entities';

/** Maps an entity_index row to the Entity the API returns */
export function toEntity(row: EntityIndexRow): Entity {
   return {
      id: row.id,
      provider: row.provider,
      type: row.type,
      displayName: row.displayName,
      title: row.title ?? undefined,
      status: row.status,
      version: row.version,
      revision: row.revision,
      contentSeq: row.contentSeq,
      editedAt: row.editedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
   };
}
