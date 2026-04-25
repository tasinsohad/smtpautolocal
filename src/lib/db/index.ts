import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';

// Re-export types from the Cloudflare declarations
export type { CloudflareWorkersEnv as CloudflareEnv };

// Cache the database instance
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  // In Cloudflare Workers, bindings are available via globalThis
  // The binding name 'DB' matches our wrangler.jsonc configuration
  const d1 = (globalThis as any).DB as D1Database | undefined;
  
  if (!d1) {
    const message = [
      "❌ Cloudflare D1 binding 'DB' not found!",
      "",
      "Make sure your wrangler.jsonc has:",
      '  d1_databases: [{ binding: "DB", ... }]',
      "",
      "And that you have applied migrations:",
      "  npm run db:migrate:local  # development",
      "  npm run db:migrate:remote # production",
    ].join('\n');
    throw new Error(message);
  }
  
  if (!dbInstance) {
    dbInstance = drizzle(d1, { schema });
  }
  
  return dbInstance;
}