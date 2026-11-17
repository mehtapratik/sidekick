import { describe, expect, it } from 'vitest';

import type { SynergyErrorCode } from '../contracts/errors';
import { SynergyError } from '../repository/errors';
import { synergyErrorResponse } from './error-response';

const CASES: [SynergyErrorCode, number][] = [
   ['not_found', 404],
   ['stale_content', 409],
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
