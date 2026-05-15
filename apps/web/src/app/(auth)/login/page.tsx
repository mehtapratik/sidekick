'use client';

import { useNavigation } from '@/hooks/useNavigation';
import { isValidEmail, isValidPassword } from '@/utils/validation';
import { Anchor, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { signInCopies } from '@sidekick/copy/auth';
import {
  buttonCopies,
  labelCopies,
  placeholderCopies,
  validationCopies,
} from '@sidekick/copy/form';
import { createBrowserClient } from '@sidekick/core/supabase/browser';

import styles from '../auth.module.css';

export default function LoginPage(): React.ReactElement {
  const supabase = createBrowserClient();
  const { push } = useNavigation();
  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) =>
        isValidEmail(value)
          ? null
          : validationCopies.invalidInput(labelCopies.email.toLocaleLowerCase()),
      password: (value) => (isValidPassword(value) ? null : validationCopies.tooSmallPassword),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
      notifications.show({
        color: 'red',
        message: signInCopies.error,
      });
      return;
    }

    push('/dashboard');
  };

  return (
    <Paper withBorder shadow="md" className={styles.container}>
      <Title order={2} className={styles.title}>
        {signInCopies.pageTitle}
      </Title>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label={labelCopies.email}
            placeholder={placeholderCopies.email}
            {...form.getInputProps('email')}
          />
          <PasswordInput label={labelCopies.password} {...form.getInputProps('password')} />
          <Button type="submit" className={styles.submitButton}>
            {buttonCopies.signIn}
          </Button>
          <Text className={styles.switchText}>
            {signInCopies.noAccount} <Anchor href="/signup">{signInCopies.signUpLink}</Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
