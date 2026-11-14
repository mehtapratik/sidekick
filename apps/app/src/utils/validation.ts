/** Whether the text looks like an email address */
export function isValidEmail(email: string): boolean {
   return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Whether the password is at least 8 characters long */
export function isValidPassword(password: string): boolean {
   return typeof password === 'string' && password.length >= 8;
}
