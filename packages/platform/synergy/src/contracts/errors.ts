/**
 * Synergy's error codes. Keys only (D201): the client looks up the words, and
 * the API's error map turns each code into an HTTP status.
 */
export type SynergyErrorCode = 'not_found' | 'stale_content';

/**
 * The HTTP status each code answers with (Synergy overview, API). Typed as a
 * Record, so a new code without a status fails the typecheck.
 */
export const SYNERGY_ERROR_STATUS: Readonly<Record<SynergyErrorCode, number>> =
   {
      not_found: 404,
      stale_content: 409,
   };
