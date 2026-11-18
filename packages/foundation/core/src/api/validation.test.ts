import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseRequestBody } from './validation';

const schema = z.object({ title: z.string().min(1) });

function jsonRequest(body: string): Request {
   return new Request('http://localhost/api/test', { method: 'POST', body });
}

describe('parseRequestBody', () => {
   it('returns the parsed data for a valid body', async () => {
      const parsed = await parseRequestBody(
         jsonRequest('{"title":"Hello"}'),
         schema,
      );

      expect(parsed).toEqual({ ok: true, data: { title: 'Hello' } });
   });

   it('answers 400 with one keyed issue per problem', async () => {
      const parsed = await parseRequestBody(
         jsonRequest('{"title":""}'),
         schema,
      );
      if (parsed.ok) throw new Error('expected a validation failure');

      expect(parsed.response.status).toBe(400);
      const body = await parsed.response.json();
      expect(body).toEqual({
         code: 'validation_failed',
         issues: [
            {
               path: ['title'],
               message: {
                  key: 'common.validation.too_small',
                  values: expect.objectContaining({ minimum: 1 }),
               },
            },
         ],
      });
      // Never echoes what the user sent
      expect(body.issues[0].message.values).not.toHaveProperty('input');
   });

   it('answers 400, instead of throwing, when the body is not JSON', async () => {
      const parsed = await parseRequestBody(jsonRequest('not json'), schema);
      if (parsed.ok) throw new Error('expected a validation failure');

      expect(parsed.response.status).toBe(400);
   });
});
