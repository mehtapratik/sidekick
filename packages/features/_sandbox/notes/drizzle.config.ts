import { defineConfig } from 'drizzle-kit';

const directUrl = process.env.DATABASE_DIRECT_URL;

if (!directUrl) {
   throw new Error('Missing DATABASE_DIRECT_URL environment variable');
}

export default defineConfig({
   schema: './src/db/schema/index.ts',
   out: './src/db/migrations',
   dialect: 'postgresql',
   // This package's own migrations table (lesson 2): drizzle-kit applies only
   // migrations newer than the newest row, so packages can't share one.
   migrations: {
      table: '__drizzle_migrations_sandbox_notes',
   },
   dbCredentials: {
      url: directUrl,
   },
});
