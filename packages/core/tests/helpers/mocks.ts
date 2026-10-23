import {
  AuthError,
  AuthSessionMissingError,
  type SupabaseClient,
  type User,
  type UserResponse,
} from '@supabase/supabase-js';

import type { KeyBasedApiCaller, SessionBasedApiCaller } from '../../src/api/auth';
import type { RlsTx } from '../../src/db';

// Shared mock values. Every export carries its full qualifier (MOCK_…, createMock…), so a
// reader of any test file can tell a mock from real code without opening this file.

export const MOCK_AUTH_TOKEN = 'bearer mocked-auth-token';

export const MOCK_USER = { id: 'mock-user-id' } as User;

export const MOCK_SESSION_CALLER: SessionBasedApiCaller = { kind: 'session', userId: MOCK_USER.id };

export const MOCK_KEY_CALLER: KeyBasedApiCaller = {
  kind: 'key',
  userId: MOCK_USER.id,
  keyId: 'mock-key-id',
  scopes: ['notes:read'],
};

/** Stands in for withRLS's transaction where the code under test only passes it along */
export const MOCK_RLS_TX = {} as RlsTx;

export const MOCK_AUTH_USER_RESPONSE: {
  validUser: UserResponse;
  invalidUser: UserResponse;
  error: UserResponse;
} = {
  validUser: { data: { user: MOCK_USER }, error: null },
  invalidUser: { data: { user: null }, error: new AuthSessionMissingError() },
  error: { data: { user: null }, error: new AuthError('boom') },
};

/** A Supabase server client whose auth.getUser() resolves to one of the responses above */
export function createMockSupabaseServerClient(
  state: keyof typeof MOCK_AUTH_USER_RESPONSE,
): SupabaseClient {
  return {
    auth: {
      getUser: async () => MOCK_AUTH_USER_RESPONSE[state],
    },
  } as unknown as SupabaseClient;
}
