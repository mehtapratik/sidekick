/**
 * Synergy's error codes. Keys only (D201): the client looks up the words, and
 * the API's error map turns each code into an HTTP status.
 */
export type SynergyErrorCode = 'not_found' | 'stale_content';
