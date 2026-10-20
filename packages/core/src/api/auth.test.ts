import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AuthError,
  AuthSessionMissingError,
  type SupabaseClient,
  type User,
  type UserResponse,
} from '@supabase/supabase-js';

import { createServerClient } from '../supabase/server';
import { resolveApiCaller } from './auth';

const MOCK_AUTH_TOKEN = 'bearer mocked-auth-token';
const MOCK_USER = { id: 'mock-user-id' } as User;
const MOCK_AUTH_USER_RESPONSE: {
  validUser: UserResponse;
  invalidUser: UserResponse;
  error: UserResponse;
} = {
  validUser: {
    data: {
      user: MOCK_USER,
    },
    error: null,
  },
  invalidUser: { data: { user: null }, error: new AuthSessionMissingError() },
  error: {
    data: { user: null },
    error: new AuthError('boom'),
  },
};

function getSupabaseServerClient(state: 'validUser' | 'invalidUser' | 'error') {
  return {
    auth: {
      getUser: async () => MOCK_AUTH_USER_RESPONSE[state],
    },
  } as unknown as SupabaseClient;
}

function getHttpRequestObject(includeHeaders = false, mockAuthToken = MOCK_AUTH_TOKEN) {
  return new Request('http://localhost/auth', {
    headers: includeHeaders
      ? {
          Authorization: mockAuthToken,
        }
      : undefined,
  });
}

vi.mock('../supabase/server', () => ({
  createServerClient: vi.fn(),
}));

describe('resolveApiCaller', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves a signed-in user to a session caller', async () => {
    vi.mocked(createServerClient).mockResolvedValue(getSupabaseServerClient('validUser'));
    const resolution = await resolveApiCaller(getHttpRequestObject(false));
    expect(resolution).toEqual({ kind: 'session', userId: 'mock-user-id' });
    expect(createServerClient).toHaveBeenCalledOnce();
  });

  it('resolves to null when nobody is signed in', async () => {
    vi.mocked(createServerClient).mockResolvedValue(getSupabaseServerClient('invalidUser'));
    const resolution = await resolveApiCaller(getHttpRequestObject(false));
    expect(resolution).toBeNull();
  });

  it('resolves to null when Supabase Auth returns an error', async () => {
    vi.mocked(createServerClient).mockResolvedValue(getSupabaseServerClient('error'));
    const resolution = await resolveApiCaller(getHttpRequestObject(false));
    expect(resolution).toBeNull();
  });

  it('resolves a Bearer header to null without reading the session', async () => {
    const resolution = await resolveApiCaller(getHttpRequestObject(true));
    expect(resolution).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('lets a Bearer header win over a valid session', async () => {
    vi.mocked(createServerClient).mockResolvedValue(getSupabaseServerClient('validUser'));
    const resolution = await resolveApiCaller(getHttpRequestObject(true));
    expect(resolution).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('falls through to the session when the Authorization header is empty', async () => {
    vi.mocked(createServerClient).mockResolvedValue(getSupabaseServerClient('validUser'));
    const resolution = await resolveApiCaller(getHttpRequestObject(true, ''));
    expect(resolution).toEqual({ kind: 'session', userId: 'mock-user-id' });
    expect(createServerClient).toHaveBeenCalledOnce();
  });
});
