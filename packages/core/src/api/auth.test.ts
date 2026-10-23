import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createServerClient } from '../supabase/server';
import { createMockHttpRequest } from '../../tests/helpers/http';
import {
  MOCK_AUTH_TOKEN,
  MOCK_SESSION_CALLER,
  createMockSupabaseServerClient,
} from '../../tests/helpers/mocks';
import { resolveApiCaller } from './auth';

vi.mock('../supabase/server', () => ({
  createServerClient: vi.fn(),
}));

describe('resolveApiCaller', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves a signed-in user to a session caller', async () => {
    vi.mocked(createServerClient).mockResolvedValue(createMockSupabaseServerClient('validUser'));
    const resolution = await resolveApiCaller(createMockHttpRequest());
    expect(resolution).toEqual(MOCK_SESSION_CALLER);
    expect(createServerClient).toHaveBeenCalledOnce();
  });

  it('resolves to undefined when nobody is signed in', async () => {
    vi.mocked(createServerClient).mockResolvedValue(createMockSupabaseServerClient('invalidUser'));
    const resolution = await resolveApiCaller(createMockHttpRequest());
    expect(resolution).toBeUndefined();
  });

  it('resolves to undefined when Supabase Auth returns an error', async () => {
    vi.mocked(createServerClient).mockResolvedValue(createMockSupabaseServerClient('error'));
    const resolution = await resolveApiCaller(createMockHttpRequest());
    expect(resolution).toBeUndefined();
  });

  it('resolves a Bearer header to undefined without reading the session', async () => {
    const resolution = await resolveApiCaller(
      createMockHttpRequest({ Authorization: MOCK_AUTH_TOKEN }),
    );
    expect(resolution).toBeUndefined();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('lets a Bearer header win over a valid session', async () => {
    vi.mocked(createServerClient).mockResolvedValue(createMockSupabaseServerClient('validUser'));
    const resolution = await resolveApiCaller(
      createMockHttpRequest({ Authorization: MOCK_AUTH_TOKEN }),
    );
    expect(resolution).toBeUndefined();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('falls through to the session when the Authorization header is empty', async () => {
    vi.mocked(createServerClient).mockResolvedValue(createMockSupabaseServerClient('validUser'));
    const resolution = await resolveApiCaller(createMockHttpRequest({ Authorization: '' }));
    expect(resolution).toEqual(MOCK_SESSION_CALLER);
    expect(createServerClient).toHaveBeenCalledOnce();
  });
});
