import { defineConfig } from 'drizzle-kit';

const directUrl = process.env.DATABASE_DIRECT_URL;

if (!directUrl) {
   throw new Error('Missing DATABASE_DIRECT_URL environment variable');
}

export default defineConfig({
   schema: './src/db/schema/index.ts',
   out: './src/db/migrations',
   dialect: 'postgresql',
   // Each package records its applied migrations in its own table:
   // drizzle-kit applies only migrations newer than the newest row, so a shared
   // table would skip one package's older migrations.
   migrations: {
      table: '__drizzle_migrations_core',
   },
   dbCredentials: {
      url: directUrl,
   },
});
