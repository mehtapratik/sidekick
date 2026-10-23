import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockHttpRequest } from '../../tests/helpers/http';
import { MOCK_KEY_CALLER, MOCK_RLS_TX, MOCK_SESSION_CALLER } from '../../tests/helpers/mocks';
import { withRLS } from '../db';
import { getEnabledFeatures } from '../features/entitlements';
import { resolveApiCaller } from './auth';
import { type ApiHandler, withApiGuard } from './guard';
import { type LogEvent, logEvent } from '../observability/log';

vi.mock('./auth', () => ({ resolveApiCaller: vi.fn() }));
vi.mock('../db', () => ({ withRLS: vi.fn() }));
vi.mock('../features/entitlements', () => ({ getEnabledFeatures: vi.fn() }));
// Spies that keep the real code: toLoggedError runs for real, logEvent is silenced below
vi.mock('../observability/log', { spy: true });

const mockHandler = vi.fn<ApiHandler<unknown>>();

/** Every event the guard logged, in order */
function loggedEvents(): LogEvent[] {
  return vi.mocked(logEvent).mock.calls.map(([event]) => event);
}

/** The fields every event for createMockHttpRequest() carries */
const MOCK_REQUEST_FIELDS = { method: 'GET', path: '/api/test' };

describe('withApiGuard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_SESSION_CALLER);
    // Run the callback the way withRLS does, minus the database
    vi.mocked(withRLS).mockImplementation(async (_userId, fn) => fn(MOCK_RLS_TX));
    vi.mocked(getEnabledFeatures).mockResolvedValue(['core-drive']);
    vi.mocked(logEvent).mockImplementation(() => {});
    mockHandler.mockResolvedValue(Response.json({ ok: true }));
  });

  it('responds 401 without opening a transaction when there is no caller', async () => {
    vi.mocked(resolveApiCaller).mockResolvedValue(undefined);
    const response = await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized', code: 'UNAUTHENTICATED' });
    expect(withRLS).not.toHaveBeenCalled();
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('responds 403 without opening a transaction when a key caller lacks the scope', async () => {
    vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_KEY_CALLER);
    const guarded = withApiGuard(mockHandler, { requireScope: 'notes:write' });
    const response = await guarded(createMockHttpRequest(), undefined);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden', code: 'SCOPE_MISSING' });
    expect(withRLS).not.toHaveBeenCalled();
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('lets a key caller with the scope through', async () => {
    vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_KEY_CALLER);
    const guarded = withApiGuard(mockHandler, { requireScope: 'notes:read' });
    const response = await guarded(createMockHttpRequest(), undefined);

    expect(response.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledOnce();
  });

  it('skips the scope check for session callers', async () => {
    const guarded = withApiGuard(mockHandler, { requireScope: 'notes:write' });
    const response = await guarded(createMockHttpRequest(), undefined);

    expect(response.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledOnce();
  });

  it('responds 403 when the caller is not entitled to the feature', async () => {
    const guarded = withApiGuard(mockHandler, { feature: 'taxila' });
    const response = await guarded(createMockHttpRequest(), undefined);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Feature disabled', code: 'FEATURE_DISABLED' });
    expect(getEnabledFeatures).toHaveBeenCalledWith(MOCK_RLS_TX);
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('does not read entitlements when no feature is required', async () => {
    const response = await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

    expect(response.status).toBe(200);
    expect(getEnabledFeatures).not.toHaveBeenCalled();
  });

  it('runs the handler in the caller’s transaction and passes ctx through', async () => {
    const mockRequest = createMockHttpRequest();
    const mockCtx = { params: Promise.resolve({ id: 'note-1' }) };
    const guarded = withApiGuard(mockHandler, { feature: 'core-drive' });
    const response = await guarded(mockRequest, mockCtx);

    expect(withRLS).toHaveBeenCalledWith(MOCK_SESSION_CALLER.userId, expect.any(Function));
    expect(mockHandler).toHaveBeenCalledWith({
      tx: MOCK_RLS_TX,
      caller: MOCK_SESSION_CALLER,
      req: mockRequest,
      ctx: mockCtx,
    });
    expect(await response.json()).toEqual({ ok: true });
  });

  it.each([
    [
      'the handler',
      () => mockHandler.mockRejectedValue(new Error('relation "notes" does not exist')),
      MOCK_SESSION_CALLER.userId,
    ],
    [
      'resolveApiCaller',
      () => vi.mocked(resolveApiCaller).mockRejectedValue(new Error('no env')),
      null,
    ],
  ])('turns a throw in %s into a generic 500', async (_where, makeItThrow, loggedUserId) => {
    makeItThrow();
    const response = await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

    expect(response.status).toBe(500);
    // Exactly the generic body: no message, stack or SQL reaches the client
    expect(await response.json()).toEqual({ error: 'Internal error', code: 'INTERNAL' });

    // The details go to the server log instead
    expect(loggedEvents()).toEqual([
      {
        event: 'api.error',
        ...MOCK_REQUEST_FIELDS,
        userId: loggedUserId,
        error: expect.objectContaining({ name: 'Error' }),
      },
      expect.objectContaining({ event: 'api.request', status: 500 }),
    ]);
  });

  describe('logging', () => {
    it('logs one api.request with status and latency for an allowed request', async () => {
      await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

      expect(loggedEvents()).toEqual([
        {
          event: 'api.request',
          ...MOCK_REQUEST_FIELDS,
          userId: MOCK_SESSION_CALLER.userId,
          status: 200,
          latencyMs: expect.any(Number),
        },
      ]);
    });

    it('logs api.denied with a null userId before the api.request for a 401', async () => {
      vi.mocked(resolveApiCaller).mockResolvedValue(undefined);
      await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

      expect(loggedEvents()).toEqual([
        { event: 'api.denied', ...MOCK_REQUEST_FIELDS, userId: null, code: 'UNAUTHENTICATED' },
        expect.objectContaining({ event: 'api.request', status: 401, userId: null }),
      ]);
    });

    it('logs the missing scope for a scope denial', async () => {
      vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_KEY_CALLER);
      await withApiGuard(mockHandler, { requireScope: 'notes:write' })(
        createMockHttpRequest(),
        undefined,
      );

      expect(loggedEvents()[0]).toEqual({
        event: 'api.denied',
        ...MOCK_REQUEST_FIELDS,
        userId: MOCK_KEY_CALLER.userId,
        code: 'SCOPE_MISSING',
        scope: 'notes:write',
      });
    });

    it('logs the missing feature for a feature denial', async () => {
      await withApiGuard(mockHandler, { feature: 'taxila' })(createMockHttpRequest(), undefined);

      expect(loggedEvents()[0]).toEqual({
        event: 'api.denied',
        ...MOCK_REQUEST_FIELDS,
        userId: MOCK_SESSION_CALLER.userId,
        code: 'FEATURE_DISABLED',
        feature: 'taxila',
      });
    });

    it('logs the pathname only, and never a cookie, token or query value', async () => {
      const mockRequest = new Request(
        'http://localhost/api/test?email=jane%40example.com&token=query-secret',
        {
          headers: {
            authorization: 'Bearer header-secret',
            cookie: 'sb-access-token=cookie-secret',
          },
        },
      );
      await withApiGuard(mockHandler)(mockRequest, undefined);

      expect(loggedEvents()[0]).toMatchObject({ path: '/api/test' });
      expect(JSON.stringify(loggedEvents())).not.toMatch(
        /jane|query-secret|header-secret|cookie-secret/,
      );
    });
  });
});
