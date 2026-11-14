import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { createServerClient } from '@sidekick/core/supabase/server';

import { AppShell } from './app-shell';

/** Render on every request, never statically: the layout reads the signed-in user */
export const dynamic = 'force-dynamic';

/** Layout for every signed-in page: sends signed-out visitors to /login and wraps the page in AppShell */
export default async function AppLayout({
   children,
}: {
   children: ReactNode;
}): Promise<React.ReactElement> {
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
