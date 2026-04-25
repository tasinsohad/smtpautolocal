import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    wranglerConfigPath: './wrangler.jsonc',
    // Alternative: Use environment variables for CI/CD pipelines
    // accountId: process.env.CF_ACCOUNT_ID,
    // databaseId: process.env.D1_DATABASE_ID,
  },
} satisfies Config;