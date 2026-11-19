import type { ApiCaller } from '@sidekick/core/api';

import type { Actor } from '../repository/entities';

/**
 * Who Synergy records as the writer of a request: the signed-in human, or the
 * API key the request used.
 */
export function identifyActor(caller: ApiCaller): Actor {
   if (caller.kind === 'session') {
      return { kind: 'human', id: caller.userId };
   }

   return { kind: 'api_key', id: caller.keyId };
}
