import { withApiGuard } from '@sidekick/core/api';
import { listEntityVersions } from '@sidekick/synergy/server';

/** Lists an entity's versions, a page at a time (see listEntityVersions) */
export const GET = withApiGuard(listEntityVersions);
