// Variables the web server cannot serve a request without. Server-only ones
// (DATABASE_URL) are read lazily where they are used, so a missing one would
// otherwise surface only on the first request that needs it.
const REQUIRED_ENV = [
   'NEXT_PUBLIC_SUPABASE_URL',
   'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
   'DATABASE_URL',
] as const;

/**
 * Runs once when a Next.js server instance starts (`next dev`, `next start`, each
 * Vercel function instance), before it handles a request. It does not run during
 * `next build`, which has no secrets in CI.
 * @description Every request fails with this error until the variables are set
 */
export function register(): void {
   const missing = REQUIRED_ENV.filter((name) => !process.env[name]);

   if (missing.length > 0) {
      throw new Error(
         `Missing environment variables: ${missing.join(', ')}. Set them in .env.local (see .env.example) or in the host's settings.`,
      );
   }
}
