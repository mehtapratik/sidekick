/** The tasks sandbox's key: its entitlement, its guard option and its Synergy provider name */
export const FEATURE_KEY = 'sandbox-tasks';

/** The tasks sandbox's manifest, which the features registry lists */
export const MANIFEST = {
   key: FEATURE_KEY,
   name: 'Sandbox tasks',
   description: 'A mock tasks provider that Synergy is proven with',
};

/**
 * The entity types the tasks sandbox provides, by name. A type is scoped to its
 * provider (D200): Synergy never lists them, and another provider may reuse
 * the same word.
 */
export const ENTITY_TYPE = Object.freeze({
   TASK: 'task',
});
