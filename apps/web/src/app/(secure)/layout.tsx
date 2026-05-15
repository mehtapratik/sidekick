import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

import { createServerClient } from '@sidekick/core/supabase/server';

import { AppShell } from './app-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }): Promise<React.ReactElement> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Why check auth here if middleware already does it?
  // If middleware is ever misconfigured or a route is accidentally excluded from the matcher,
  // this catches it. Two independent checks are better than one for security-critical boundaries.
  if (!user) {
    redirect('/login');
  }

  return <AppShell user={user}>{children}</AppShell>;
}
