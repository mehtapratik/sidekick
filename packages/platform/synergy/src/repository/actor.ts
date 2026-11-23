import { sql } from 'drizzle-orm';

import type { ACTOR_KINDS } from '../db/schema/columns';

type ActorKind = (typeof ACTOR_KINDS)[number];

/** The system writing on its own: it has no id */
export interface SystemAsActor {
   kind: 'system';
   id?: never;
}
/** A human, agent or API key writing: each has an id */
export interface NonSystemAsActor {
   kind: Exclude<ActorKind, 'system'>;
   /** The id of the user, agent or API key */
   id: string;
}

/** Who is writing. Mirrors the provenance CHECK: only the system has no id. */
export type Actor = SystemAsActor | NonSystemAsActor;

/** SQL for the user withRLS set. RLS's WITH CHECK refuses any other user_id anyway. */
export const currentUserId = sql`current_setting('app.current_user_id')::uuid`;
