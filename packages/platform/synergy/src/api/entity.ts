import { createHash } from 'node:crypto';

import type { Entity } from '../contracts/entity';
import type { EntityIndexRow } from '../repository/entities';

/** Next.js's second route-handler argument for `/api/synergy/entities/[id]` */
export interface EntityRouteContext {
   /** The route's dynamic segments */
   params: Promise<{ id: string }>;
}

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

/**
 * The ETag of an entity's response: a hash of the exact JSON the API sends, so
 * it changes whenever any field does (status included) and never otherwise.
 * HTTP requires an ETag to cover the whole response (RFC 9110).
 */
export function entityETag(entity: Entity): string {
   const hash = createHash('sha256')
      .update(JSON.stringify(entity))
      .digest('base64url');

   return `"${hash}"`;
}
