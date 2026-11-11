import 'server-only';

import { DrizzleQueryError } from 'drizzle-orm';

/** Fields every API event shares.
 *
 *  Never add headers, cookies, tokens, bodies or emails. */
export interface RequestLogContext {
   method: string;
   /** The URL pathname only: a query string can carry tokens, emails or search terms */
   path: string;
   /** `null` when there is no caller. JSON.stringify drops `undefined`, and the field must stay visible. */
   userId: string | null;
}

/** One per request, at its end, whatever the outcome */
export interface ApiRequestEvent extends RequestLogContext {
   event: 'api.request';
   status: number;
   latencyMs: number;
}

/** The guard's 401 and 403 codes: the same value the client receives in `{ error, code }` */
export type DenyCode = 'UNAUTHENTICATED' | 'SCOPE_MISSING' | 'FEATURE_DISABLED';

/** Every 401 and 403, with what the caller was missing */
export interface ApiDeniedEvent extends RequestLogContext {
   event: 'api.denied';
   code: DenyCode;
   /** The feature the caller isn't entitled to */
   feature?: string;
   /** The scope the key caller doesn't hold */
   scope?: string;
}

export interface LoggedError {
   name: string;
   message: string;
   /** Stack frames only (`at …` lines): the stack's first lines repeat the message */
   stack?: string[];
}

/** Every 500, with the details the client never sees */
export interface ApiErrorEvent extends RequestLogContext {
   event: 'api.error';
   error: LoggedError;
}

export type LogEvent = ApiRequestEvent | ApiDeniedEvent | ApiErrorEvent;

type ConsoleWriterMap = Record<LogEvent['event'], (line: string) => void>;

// The console method sets the level that hosts such as Vercel show and filter by.
// A Record keyed by every event name fails to compile when a new event has no level.
// Arrow functions, not `console.log` itself: they look the method up on each call,
// so a test's vi.spyOn(console, 'log') still sees the write.
const CONSOLE_WRITERS: ConsoleWriterMap = {
   // console.log is allowed in this file only: see the no-console override in eslint.config.js
   'api.request': (line) => console.log(line),
   'api.denied': (line) => console.warn(line),
   'api.error': (line) => console.error(line),
};

/** Writes one event as one JSON line */
export function logEvent(event: LogEvent): void {
   CONSOLE_WRITERS[event.event](JSON.stringify(event));
}

/** What a thrown value says about itself, minus the parts that can carry user data */
export function toLoggedError(error: unknown): LoggedError {
   if (!(error instanceof Error)) {
      return { name: 'NonError', message: String(error) };
   }

   // Drizzle's message embeds the query's parameters, which hold user data such as note
   // text or emails. Its cause is the database's own error: relation "notes" does not exist.
   const source =
      error instanceof DrizzleQueryError && error.cause instanceof Error
         ? error.cause
         : error;

   return {
      name: source.name,
      message: source.message,
      stack: error.stack
         ?.split('\n')
         .filter((line) => line.trimStart().startsWith('at ')),
   };
}
