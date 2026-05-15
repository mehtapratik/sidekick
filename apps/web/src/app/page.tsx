import { redirect } from 'next/navigation';

import { createServerClient } from '@sidekick/core/supabase/server';

export const dynamic = 'force-dynamic';

// Root route has no UI — proxy handles unauthenticated redirects but authenticated
// users landing on "/" are bounced here to the dashboard.
export default async function RootPage(): Promise<never> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/dashboard' : '/login');
}
