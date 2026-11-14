// Test-only stand-in for the `server-only` package. The real package throws
// unless it's resolved with Next.js's "react-server" condition, which a test
// runner doesn't use. vitest.config.ts points `server-only` here instead.
export {};
