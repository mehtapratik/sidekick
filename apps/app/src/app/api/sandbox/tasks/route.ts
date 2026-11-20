import { withApiGuard } from '@sidekick/core/api';
import { FEATURE_KEY } from '@sidekick/sandbox-tasks';
import { createTask } from '@sidekick/sandbox-tasks/server';

/** Creates a task and its Synergy entity (see createTask) */
export const POST = withApiGuard(createTask, {
   feature: FEATURE_KEY,
   lockUser: true,
});
