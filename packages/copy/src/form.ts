export const labelCopies = {
  email: 'Email',
  password: 'Password',
} as const;

export const buttonCopies = {
  submit: 'Submit',
  signIn: 'Sign in',
  createAccount: 'Create account',
} as const;

export const placeholderCopies = {
  email: 'you@example.com',
} as const;

export const validationCopies = {
  invalidInput: (label: string) => `Invalid ${label}.`,
  requiredInput: (label: string) => `${label} is required.`,
  tooSmallPassword: 'Password must be at least 8 characters long.',
} as const;
