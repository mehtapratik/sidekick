import { withUserLock } from '@sidekick/core/db';

import type { EntityStatus } from '../contracts/entity';
import { outbox, type OUTBOX_EVENT_KINDS } from '../db/schema';
import { currentUserId, type Actor } from './actor';

/** One of the kinds in OUTBOX_EVENT_KINDS */
type OutboxEventKind = (typeof OUTBOX_EVENT_KINDS)[number];

/**
 * What each kind of event carries in its payload: only the facts a reader
 * needs to act on it. A kind missing here fails the typecheck.
 */
interface OutboxPayloads {
   'entity.created': { provider: string; type: string };
   'entity.content_saved': { contentSeq: number };
   'entity.version_bumped': { version: number };
   'entity.status_changed': { from: EntityStatus; to: EntityStatus };
}

interface OutboxEventBase {
   /** The entity, link or tag the event is about */
   subjectId: string;
   /** Who made the change */
   actor: Actor;
}

/** An event of one kind, with that kind's payload */
interface OutboxEventOf<Kind extends OutboxEventKind> extends OutboxEventBase {
   kind: Kind;
   payload: OutboxPayloads[Kind];
}

/** One event: its kind decides the shape of its payload */
export type OutboxEvent = {
   [Kind in OutboxEventKind]: OutboxEventOf<Kind>;
}[OutboxEventKind];

/**
 * Writes one event to the outbox in the caller's transaction, so the event
 * commits or rolls back with the change it describes. No RETURNING:
 * app_runtime may insert into the outbox but not read it.
 */
export const recordEvent = withUserLock(async function recordEventWrite(
   tx,
   event: OutboxEvent,
): Promise<void> {
   await tx.insert(outbox).values({
      userId: currentUserId,
      kind: event.kind,
      subjectId: event.subjectId,
      payload: event.payload,
      actorKind: event.actor.kind,
      actorId: event.actor.id ?? null,
   });
});
