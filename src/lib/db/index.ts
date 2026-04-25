import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';
import { getEvent } from '@tanstack/react-start/server';

// Re-export types from the Cloudflare declarations
export type { CloudflareWorkersEnv as CloudflareEnv };

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  const event = getEvent();
  
  // Cloudflare Workers provides bindings on context.cloudflare.env
  const ctx = event.nativeEvent.context as any;
  const cfCtx = ctx.cloudflare || ctx;
  
  // D1 binding: 'DB' as configured in wrangler.jsonc
  const d1 = cfCtx.env?.DB as D1Database | undefined;
  
  if (!d1) {
    const message = [
      "❌ Cloudflare D1 binding 'DB' not found!",
      "",
      "Make sure your wrangler.jsonc has:",
      '  d1_databases: [{ binding: "DB", ... }]',
      "",
      "And that you've applied migrations:",
      "  npm run db:migrate:local  # development",
      "  npm run db:migrate:remote # production",
    ].join('\n');
    throw new Error(message);
  }
  
  return drizzle(d1, { schema });
}
