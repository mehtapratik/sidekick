import 'server-only';

import { withRLS, type RlsTx } from '../db';
import { resolveApiCaller, type ApiCaller } from './auth';
import { getEnabledFeatures } from '../features/entitlements';
import {
   type ApiDeniedEvent,
   logEvent,
   toLoggedError,
} from '../observability/log';

export interface GuardOptions {
   /** Key of the feature the caller must be entitled to */
   feature?: string;
   /** Scope an API-key caller must hold; session callers skip this check */
   requireScope?: string;
}

export interface ApiHandlerArgs<Ctx> {
   tx: RlsTx;
   caller: ApiCaller;
   req: Request;
   /** Next.js's second route-handler argument (e.g. `{ params }`), passed through untouched */
   ctx: Ctx;
}

export type ApiHandler<Ctx> = (args: ApiHandlerArgs<Ctx>) => Promise<Response>;

/** The error-shape table from contracts.md: one place maps a code to its status and message */
const GUARD_ERRORS = {
   UNAUTHENTICATED: { status: 401, error: 'Unauthorized' },
   SCOPE_MISSING: { status: 403, error: 'Forbidden' },
   FEATURE_DISABLED: { status: 403, error: 'Feature disabled' },
   INTERNAL: { status: 500, error: 'Internal error' },
} as const;

type GuardErrorCode = keyof typeof GUARD_ERRORS;

function guardError(code: GuardErrorCode): Response {
   const { status, error } = GUARD_ERRORS[code];

   return Response.json({ error, code }, { status });
}

/** Scopes only narrow what an API key may do; a session caller has no scopes to check */
function isMissingScope(caller: ApiCaller, scope?: string): boolean {
   return (
      caller.kind === 'key' &&
      scope !== undefined &&
      !caller.scopes.includes(scope)
   );
}

/** Why the checks turned a caller away: the fields api.denied adds to the request's */
type GuardDenial = Pick<ApiDeniedEvent, 'code' | 'feature' | 'scope'>;

/**
 * The auth, scope and feature checks, then the handler. Decides and never logs:
 * withApiGuard logs what it returns, and what it throws.
 */
async function authorizeAndHandle<Ctx>(
   caller: ApiCaller | undefined,
   handler: ApiHandler<Ctx>,
   opts: GuardOptions,
   req: Request,
   ctx: Ctx,
): Promise<Response | GuardDenial> {
   // No caller: nobody signed in, or an API key we can't look up yet (Phase 9)
   if (!caller) {
      return { code: 'UNAUTHENTICATED' };
   }

   // Needs no database, so it runs before a transaction (and a pooled connection) is taken
   if (isMissingScope(caller, opts.requireScope)) {
      return { code: 'SCOPE_MISSING', scope: opts.requireScope };
   }

   return withRLS(caller.userId, async (tx) => {
      if (
         opts.feature &&
         !(await getEnabledFeatures(tx)).includes(opts.feature)
      ) {
         return { code: 'FEATURE_DISABLED', feature: opts.feature };
      }

      return handler({ tx, caller, req, ctx });
   });
}

/**
 * Wraps a route handler with authentication, scope and feature checks, and runs it
 * inside one RLS transaction for the caller. Every App Router route handler must use it.
 * @param handler Runs only for an authenticated, permitted caller
 * @param opts Feature the caller must be entitled to, and scope a key caller must hold
 * @returns A Next.js route handler
 * @description
 * - It runs from cheapest to most expensive
 * - A request stops at the first failure
 * - It is the one place that logs: api.denied, api.error, then api.request for every request
 */
export function withApiGuard<Ctx = unknown>(
   handler: ApiHandler<Ctx>,
   opts: GuardOptions = {},
): (req: Request, ctx: Ctx) => Promise<Response> {
   return async function apiGuard(req, ctx) {
      const startedAt = performance.now();
      const request = { method: req.method, path: new URL(req.url).pathname };
      // Known once the caller resolves, and still needed if a later step throws
      let userId: string | null = null;
      let response: Response;

      try {
         const caller = await resolveApiCaller(req);
         userId = caller?.userId ?? null;

         // `await`, not a bare promise: the try/catch only catches a rejection it awaits
         const outcome = await authorizeAndHandle(
            caller,
            handler,
            opts,
            req,
            ctx,
         );

         if (outcome instanceof Response) {
            response = outcome;
         } else {
            // Turned away: log why, then send the matching { error, code } body
            logEvent({ event: 'api.denied', ...request, userId, ...outcome });
            response = guardError(outcome.code);
         }
      } catch (error) {
         // withRLS has already rolled the transaction back
         logEvent({
            event: 'api.error',
            ...request,
            userId,
            error: toLoggedError(error),
         });
         response = guardError('INTERNAL');
      }

      logEvent({
         event: 'api.request',
         ...request,
         userId,
         status: response.status,
         latencyMs: Math.round(performance.now() - startedAt),
      });
      return response;
   };
}
