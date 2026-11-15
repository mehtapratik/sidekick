import * as sandboxNotes from '@sidekick/sandbox-notes';
import * as sandboxTasks from '@sidekick/sandbox-tasks';

import type { FeatureManifest } from './manifest';

export type { FeatureManifest } from './manifest';

/** Every feature's manifest in the system */
export const ALL_FEATURES: readonly FeatureManifest[] = [
   sandboxNotes.MANIFEST,
   sandboxTasks.MANIFEST,
];

/** The key of every feature in ALL_FEATURES, so a mistyped key is a type error */
export type FeatureKey =
   typeof sandboxNotes.FEATURE_KEY | typeof sandboxTasks.FEATURE_KEY;
