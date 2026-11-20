import { withApiGuard } from '@sidekick/core/api';
import { FEATURE_KEY } from '@sidekick/sandbox-notes';
import { saveNote } from '@sidekick/sandbox-notes/server';

/** Saves a note, refusing a stale save with 409 (see saveNote) */
export const PUT = withApiGuard(saveNote, {
   feature: FEATURE_KEY,
   lockUser: true,
});
