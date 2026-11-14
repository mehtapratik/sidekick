import { and, eq, isNull, sql, type InferSelectModel } from 'drizzle-orm';

import type { RlsTx } from '@sidekick/core/db';

import { entityIndex, versionLog } from '../db/schema';
import type { ACTOR_KINDS } from '../db/schema/columns';
import { increment } from '../db/utils';
import { SynergyError } from './errors';
import { withUserLock } from './lock';

type ActorKind = (typeof ACTOR_KINDS)[number];

// Who is writing. Mirrors the provenance CHECK: only the system has no id.
export interface SystemAsActor {
   kind: 'system';
   id?: never;
}
export interface NonSystemAsActor {
   kind: Exclude<ActorKind, 'system'>;
   id: string;
}

export type Actor = SystemAsActor | NonSystemAsActor;

// A row of entity_index, exactly as Drizzle returns it.
export interface EntityIndexRow extends InferSelectModel<typeof entityIndex> {}

// The user withRLS set. RLS's WITH CHECK refuses any other user_id anyway.
export const currentUserId = sql`current_setting('app.current_user_id')::uuid`;

export interface RegisterEntityPayload {
   id: string;
   provider: string;
   type: string;
   displayName: string;
   title?: string;
   actor: Actor;
}
// Creates an entity's index row. The provider calls it in the same transaction
// that inserts its own row.
export const registerEntity = withUserLock(
   async function registerEntityMutation(
      tx,
      payload: RegisterEntityPayload,
   ): Promise<EntityIndexRow> {
      const [entity] = await tx
         .insert(entityIndex)
         .values({
            id: payload.id,
            provider: payload.provider,
            type: payload.type,
            displayName: payload.displayName,
            title: payload.title,
            actorKind: payload.actor.kind,
            actorId: payload.actor.id,
            userId: currentUserId,
         })
         .returning();

      return entity;
   },
);

export interface SaveEntityContentPayload {
   id: string;
   // The content_seq the editor started from.
   baselineContentSeq: number;
   // The author flags a version; every other save is a revision.
   bump: 'revision' | 'version';
   changeNote?: string;
   displayName: string;
   title?: string;
   actor: Actor;
}

export const saveEntityContent = withUserLock(
   async function saveEntityContentMutation(
      tx,
      payload: SaveEntityContentPayload,
   ): Promise<EntityIndexRow> {
      const {
         id,
         baselineContentSeq,
         bump,
         changeNote,
         displayName,
         title,
         actor: { kind: actorKind, id: actorId },
      } = payload;
      const revision =
         bump === 'revision'
            ? increment(entityIndex.revision)
            : entityIndex.revision;
      const version =
         bump === 'version'
            ? increment(entityIndex.version)
            : entityIndex.version;
      const contentSeq = increment(entityIndex.contentSeq);

      const [updatedEntityRow] = await tx
         .update(entityIndex)
         .set({
            version,
            revision,
            contentSeq,
            displayName,
            title: title ?? null,
            editedAt: sql`now()`,
            updatedAt: sql`now()`,
            actorKind,
            actorId: actorId ?? null,
            reason: null,
         })
         .where(
            and(
               eq(entityIndex.id, id),
               eq(entityIndex.contentSeq, baselineContentSeq),
               isNull(entityIndex.deletedAt),
            ),
         )
         .returning();

      if (!updatedEntityRow) {
         // No match: either
         // 1. the baseline from which edit was initiated has shifted (updated by another tab or device),
         // 2. entity has been deleted, or
         // 3. it never existed in first place.
         // We hold the lock, so this answer can't change before we return it.
         const [live] = await tx
            .select({ id: entityIndex.id })
            .from(entityIndex)
            .where(and(eq(entityIndex.id, id), isNull(entityIndex.deletedAt)));

         throw new SynergyError(live ? 'stale_content' : 'not_found');
      }

      if (bump === 'version') {
         await tx.insert(versionLog).values({
            userId: currentUserId,
            entityId: id,
            version: updatedEntityRow.version,
            changeNote,
            actorKind,
            actorId: actorId ?? null,
         });
      }

      return updatedEntityRow;
   },
);

export interface GetEntityOptions {
   includeDeleted: boolean;
}

export async function getEntity(
   tx: RlsTx,
   id: string,
   options: GetEntityOptions,
): Promise<EntityIndexRow | undefined> {
   const [entity] = await tx
      .select()
      .from(entityIndex)
      .where(
         options.includeDeleted
            ? eq(entityIndex.id, id)
            : and(eq(entityIndex.id, id), isNull(entityIndex.deletedAt)),
      );
   return entity;
}
