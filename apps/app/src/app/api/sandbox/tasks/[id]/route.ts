import { withApiGuard } from '@sidekick/core/api';
import { FEATURE_KEY } from '@sidekick/sandbox-tasks';
import { saveTask } from '@sidekick/sandbox-tasks/server';

/** Saves a task, refusing a stale save with 409 (see saveTask) */
export const PUT = withApiGuard(saveTask, {
   feature: FEATURE_KEY,
   lockUser: true,
});
