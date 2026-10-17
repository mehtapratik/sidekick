'use client';

import { useState } from 'react';

import { useNavigation } from '@/hooks/useNavigation';
import { isValidEmail, isValidPassword } from '@/utils/validation';
import { Anchor, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { signUpCopies } from '@sidekick/copy/auth';
import { genericErrorCopy } from '@sidekick/copy/errors';
import {
  buttonCopies,
  labelCopies,
  placeholderCopies,
  validationCopies,
} from '@sidekick/copy/form';
import { createBrowserClient } from '@sidekick/core/supabase/browser';

import styles from '../auth.module.css';

function SignupView({
  setUnverifiedEmail,
}: {
  setUnverifiedEmail: (email: string | undefined) => void;
}): React.ReactElement {
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
    const { error, data } = await supabase.auth.signUp(values);

    if (error) {
      notifications.show({
        color: 'red',
        message: genericErrorCopy,
      });
      return;
    }
    if (!data?.session) {
      setUnverifiedEmail(values.email);
      return;
    }
    push('/dashboard');
  };

  return (
    <>
      <Title order={2} className={styles.title}>
        {signUpCopies.pageTitle}
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
            {buttonCopies.createAccount}
          </Button>
          <Text className={styles.switchText}>
            {signUpCopies.hasAccount} <Anchor href="/login">{signUpCopies.signInLink}</Anchor>
          </Text>
        </Stack>
      </form>
    </>
  );
}

function UnverifiedEmailView({ email }: { email: string }) {
  return (
    <>
      <Title order={2} className={styles.title}>
        {signUpCopies.confirmAccountPageTitle}
      </Title>
      <Text className={styles.unverifiedEmailText}>{signUpCopies.confirmEmail(email)}</Text>
      <Text>
        {signUpCopies.alreadyConfirmed} <Anchor href="/login">{signUpCopies.signInLink}</Anchor>
      </Text>
    </>
  );
}

export default function SignupPage(): React.ReactElement {
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | undefined>(undefined);

  return (
    <Paper withBorder shadow="md" className={styles.container}>
      {unverifiedEmail ? (
        <UnverifiedEmailView email={unverifiedEmail} />
      ) : (
        <SignupView setUnverifiedEmail={setUnverifiedEmail} />
      )}
    </Paper>
  );
}
