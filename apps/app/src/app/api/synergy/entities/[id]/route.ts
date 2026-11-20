import { withApiGuard } from '@sidekick/core/api';
import { readEntity } from '@sidekick/synergy/server';

/** Reads an entity's index fields, with an ETag and 304 (see readEntity) */
export const GET = withApiGuard(readEntity);
