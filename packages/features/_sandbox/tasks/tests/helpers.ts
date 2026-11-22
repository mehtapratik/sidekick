import { vi } from 'vitest';

import { createServerClient } from '@sidekick/core/supabase/server';

/**
 * Makes the next requests arrive signed in as this user. The test file must
 * mock `@sidekick/core/supabase/server` first, so the guard's real
 * resolveApiCaller reads this stand-in session instead of Supabase Auth.
 */
export function signInAs(userId: string): void {
   const session = {
      auth: {
         getUser: async () => ({ data: { user: { id: userId } }, error: null }),
      },
   };

   // The one cast in our tests: a stand-in for Supabase's client, which has
   // hundreds of members; resolveApiCaller only ever calls auth.getUser().
   vi.mocked(createServerClient).mockResolvedValue(
      session as unknown as Awaited<ReturnType<typeof createServerClient>>,
   );
}
