import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockHttpRequest } from '../../tests/helpers/http';
import { MOCK_KEY_CALLER, MOCK_RLS_TX, MOCK_SESSION_CALLER } from '../../tests/helpers/mocks';
import { withRLS } from '../db';
import { getEnabledFeatures } from '../features/entitlements';
import { resolveApiCaller } from './auth';
import { type ApiHandler, withApiGuard } from './guard';

vi.mock('./auth', () => ({ resolveApiCaller: vi.fn() }));
vi.mock('../db', () => ({ withRLS: vi.fn() }));
vi.mock('../features/entitlements', () => ({ getEnabledFeatures: vi.fn() }));

const mockHandler = vi.fn<ApiHandler<unknown>>();

describe('withApiGuard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(resolveApiCaller).mockResolvedValue(MOCK_SESSION_CALLER);
    // Run the callback the way withRLS does, minus the database
    vi.mocked(withRLS).mockImplementation(async (_userId, fn) => fn(MOCK_RLS_TX));
    vi.mocked(getEnabledFeatures).mockResolvedValue(['core-drive']);
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
    ],
    ['resolveApiCaller', () => vi.mocked(resolveApiCaller).mockRejectedValue(new Error('no env'))],
  ])('turns a throw in %s into a generic 500', async (_where, makeItThrow) => {
    makeItThrow();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await withApiGuard(mockHandler)(createMockHttpRequest(), undefined);

    expect(response.status).toBe(500);
    // Exactly the generic body: no message, stack or SQL reaches the client
    expect(await response.json()).toEqual({ error: 'Internal error', code: 'INTERNAL' });
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });
});
