import { errorResponse } from '@sidekick/core/api';

import { SYNERGY_ERROR_STATUS } from '../contracts';
import { SynergyError } from '../repository/errors';

/**
 * Turns a SynergyError into its HTTP response, with the status from the error
 * map. Anything else is rethrown, so withApiGuard rolls the transaction back
 * and answers 500.
 */
export function synergyErrorResponse(error: unknown): Response {
   if (!(error instanceof SynergyError)) {
      throw error;
   }

   return errorResponse(error.code, SYNERGY_ERROR_STATUS[error.code]);
}
