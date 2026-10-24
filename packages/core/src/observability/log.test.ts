import { DrizzleQueryError } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
   type LogEvent,
   logEvent,
   type RequestLogContext,
   toLoggedError,
} from './log';

const MOCK_LOG_CONTEXT: RequestLogContext = {
   method: 'GET',
   path: '/api/test',
   userId: 'mock-user-id',
};

const MOCK_LOG_EVENT_ARGS: readonly {
   mockEvent: LogEvent;
   consoleMethod: 'log' | 'warn' | 'error';
}[] = [
   {
      mockEvent: {
         event: 'api.request',
         ...MOCK_LOG_CONTEXT,
         status: 200,
         latencyMs: 12,
      },
      consoleMethod: 'log',
   },
   {
      mockEvent: {
         event: 'api.denied',
         ...MOCK_LOG_CONTEXT,
         code: 'FEATURE_DISABLED',
         feature: 'taxila',
      },
      consoleMethod: 'warn',
   },
   {
      mockEvent: {
         event: 'api.error',
         ...MOCK_LOG_CONTEXT,
         error: { name: 'Error', message: 'boom' },
      },
      consoleMethod: 'error',
   },
];

describe('logEvent', () => {
   afterEach(() => {
      vi.restoreAllMocks();
   });

   it.each(MOCK_LOG_EVENT_ARGS)(
      'writes $mockEvent.event as one JSON line to console.$consoleMethod',
      ({ mockEvent, consoleMethod }) => {
         const consoleSpy = vi
            .spyOn(console, consoleMethod)
            .mockImplementation(() => {});
         logEvent(mockEvent);

         expect(consoleSpy).toHaveBeenCalledOnce();
         const [line] = consoleSpy.mock.calls[0];
         expect(line).not.toContain('\n');
         expect(JSON.parse(line)).toEqual(mockEvent);
      },
   );

   it('keeps a multi-line message on one line', () => {
      const consoleErrorSpy = vi
         .spyOn(console, 'error')
         .mockImplementation(() => {});
      logEvent({
         event: 'api.error',
         ...MOCK_LOG_CONTEXT,
         error: { name: 'Error', message: 'first line\nsecond line' },
      });

      expect(consoleErrorSpy.mock.calls[0][0]).not.toContain('\n');
   });
});

describe('toLoggedError', () => {
   it('keeps the name, message and stack frames of an Error', () => {
      const loggedError = toLoggedError(new TypeError('cannot read "id"'));

      expect(loggedError.name).toBe('TypeError');
      expect(loggedError.message).toBe('cannot read "id"');
      expect(loggedError.stack?.length).toBeGreaterThan(0);
      expect(
         loggedError.stack?.every((frame) =>
            frame.trimStart().startsWith('at '),
         ),
      ).toBe(true);
   });

   it('drops the query parameters a Drizzle error carries in its message', () => {
      const mockDrizzleError = new DrizzleQueryError(
         'insert into "notes" ("body", "owner_email") values ($1, $2)',
         ['my secret note', 'jane@example.com'],
         new Error('relation "notes" does not exist'),
      );
      const loggedError = toLoggedError(mockDrizzleError);

      expect(loggedError.message).toBe('relation "notes" does not exist');
      expect(JSON.stringify(loggedError)).not.toMatch(
         /secret note|jane@example\.com/,
      );
   });

   it('describes a thrown value that is not an Error', () => {
      expect(toLoggedError('boom')).toEqual({
         name: 'NonError',
         message: 'boom',
      });
   });
});
