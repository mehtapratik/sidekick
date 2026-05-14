export function isValidEmail(email: string) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string) {
  return typeof password === 'string' && password.length >= 8;
}
