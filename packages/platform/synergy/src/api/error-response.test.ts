import { describe, expect, it } from 'vitest';

import { SYNERGY_ERROR_CODE, type SynergyErrorCode } from '../contracts/errors';
import { SynergyError } from '../repository/errors';
import { synergyErrorResponse } from './error-response';

const CASES: [SynergyErrorCode, number][] = [
   [SYNERGY_ERROR_CODE.NOT_FOUND, 404],
   [SYNERGY_ERROR_CODE.STALE_CONTENT, 409],
];

describe('synergyErrorResponse', () => {
   it.each(CASES)(
      'answers %s with %i and a code-only body',
      async (code, status) => {
         const response = synergyErrorResponse(new SynergyError(code));

         expect(response.status).toBe(status);
         expect(await response.json()).toEqual({ code });
      },
   );

   it('rethrows anything that is not a SynergyError', () => {
      const error = new Error('database is down');

      expect(() => synergyErrorResponse(error)).toThrow(error);
   });
});
