import { withApiGuard } from '@sidekick/core/api';
import { FEATURE_KEY } from '@sidekick/sandbox-notes';
import { createNote } from '@sidekick/sandbox-notes/server';

/** Creates a note and its Synergy entity (see createNote) */
export const POST = withApiGuard(createNote, {
   feature: FEATURE_KEY,
   lockUser: true,
});
