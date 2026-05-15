'use client';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <MantineProvider defaultColorScheme="auto">
      <Notifications />
      {children}
    </MantineProvider>
  );
}
