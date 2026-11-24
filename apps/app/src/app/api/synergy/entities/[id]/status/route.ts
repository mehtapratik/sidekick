import { withApiGuard } from '@sidekick/core/api';
import { changeEntityStatus } from '@sidekick/synergy/server';

/** Deprecates an entity or makes it active again (see changeEntityStatus) */
export const PATCH = withApiGuard(changeEntityStatus, { lockUser: true });
