import { defineConfig } from 'drizzle-kit'

const directUrl = process.env.DATABASE_DIRECT_URL

if (!directUrl) {
  throw new Error('Missing DATABASE_URL environment variable')
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: directUrl,
  },
})
