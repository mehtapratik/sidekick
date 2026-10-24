export const signInCopies = {
   pageTitle: 'Sign in',
   noAccount: 'No account?',
   signUpLink: 'Sign up',
   error: 'Invalid email or password',
} as const;

export const signUpCopies = {
   confirmAccountPageTitle: 'Confirm your email',
   pageTitle: 'Create an account',
   hasAccount: 'Already have an account?',
   signInLink: 'Sign in',
   confirmEmail: (email: string) =>
      `If this email address is valid, you will receive a confirmation email at ${email}. Please check your inbox and follow the instructions to complete the sign-up process.`,
   alreadyConfirmed: `Already confirmed your email?`,
} as const;
