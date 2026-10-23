import 'server-only';

import { withRLS, type RlsTx } from '../db';
import { resolveApiCaller, type ApiCaller } from './auth';
import { getEnabledFeatures } from '../features/entitlements';

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
  return caller.kind === 'key' && scope !== undefined && !caller.scopes.includes(scope);
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
 */
export function withApiGuard<Ctx = unknown>(
  handler: ApiHandler<Ctx>,
  opts: GuardOptions = {},
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async function apiGuard(req, ctx) {
    try {
      const caller = await resolveApiCaller(req);
      if (!caller) {
        return guardError('UNAUTHENTICATED');
      }

      // Needs no database, so it runs before a transaction (and a pooled connection) is taken
      if (isMissingScope(caller, opts.requireScope)) {
        return guardError('SCOPE_MISSING');
      }

      // `return await`, not `return`: the try/catch only catches a rejection it awaits.
      // Without it, a rejection skips our catch: no log, and no { error, code } body.
      return await withRLS(caller.userId, async (tx) => {
        if (opts.feature && !(await getEnabledFeatures(tx)).includes(opts.feature)) {
          return guardError('FEATURE_DISABLED');
        }

        return handler({ tx, caller, req, ctx });
      });
    } catch (error) {
      // withRLS has already rolled the transaction back. Lesson 5 replaces this with api.error.
      console.error('withApiGuard: unhandled error', error);
      return guardError('INTERNAL');
    }
  };
}
