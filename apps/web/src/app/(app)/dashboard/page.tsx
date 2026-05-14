import { Text, Title } from '@mantine/core';
import { createServerClient } from '@sidekick/core/supabase/server';

import styles from './page.module.css';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Title order={2}>Dashboard</Title>
      {user?.email && <Text className={styles.welcomeText}>Welcome, {user.email}</Text>}
    </>
  );
}
