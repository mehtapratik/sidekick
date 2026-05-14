'use client';

import { useNavigation } from '@/hooks/useNavigation';
import { Anchor, AppShell as MantineAppShell, NavLink, Text } from '@mantine/core';
import { createBrowserClient } from '@sidekick/core/supabase/browser';
import type { User } from '@sidekick/core/supabase/types';

import styles from './app-shell.module.css';

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const supabase = createBrowserClient();
  const { push } = useNavigation();

  async function handleSignout() {
    await supabase.auth.signOut();
    push('/login');
  }

  return (
    <MantineAppShell navbar={{ width: 240, breakpoint: 'sm' }} className={styles.shell}>
      <MantineAppShell.Header className={styles.header}>
        <div className={styles.headerInner}>
          <Text className={styles.brandName}>Sidekick</Text>
          <div className={styles.headerRight}>
            <Text className={styles.userEmail}>{user.email}</Text>
            <Anchor component="button" className={styles.signoutButton} onClick={handleSignout}>
              Signout
            </Anchor>
          </div>
        </div>
      </MantineAppShell.Header>
      <MantineAppShell.Navbar className={styles.navbar}>
        <NavLink label="Dashboard" href="/dashboard" />
      </MantineAppShell.Navbar>
      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
