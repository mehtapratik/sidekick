import { HTTP_STATUS, type HttpStatus } from '@sidekick/core/http';

/**
 * Every error Synergy can answer with, by name. Keys only (D201): the client
 * looks up the words, and SYNERGY_ERROR_STATUS gives each one its HTTP status.
 */
export const SYNERGY_ERROR_CODE = Object.freeze({
   NOT_FOUND: 'not_found',
   STALE_CONTENT: 'stale_content',
   INVALID_CURSOR: 'invalid_cursor',
});

/** One of Synergy's error codes */
export type SynergyErrorCode =
   (typeof SYNERGY_ERROR_CODE)[keyof typeof SYNERGY_ERROR_CODE];

/**
 * The HTTP status each code answers with (Synergy overview, API). Typed as a
 * Record, so a new code without a status fails the typecheck.
 */
export const SYNERGY_ERROR_STATUS: Readonly<
   Record<SynergyErrorCode, HttpStatus>
> = {
   [SYNERGY_ERROR_CODE.NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
   [SYNERGY_ERROR_CODE.STALE_CONTENT]: HTTP_STATUS.CONFLICT,
   [SYNERGY_ERROR_CODE.INVALID_CURSOR]: HTTP_STATUS.BAD_REQUEST,
};
