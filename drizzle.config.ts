import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    wranglerConfigPath: './wrangler.jsonc',
    // For local development, use the local D1 database
    // The binding name must match 'DB' in wrangler.jsonc
    dbName: 'smtp-forge-db',
  },
} satisfies Config;