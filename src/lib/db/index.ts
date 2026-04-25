import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { getEvent } from '@tanstack/react-start/server';

export function getDb() {
  const event = getEvent();
  // @ts-ignore - Cloudflare bindings are available on context
  // Try 'DB' first, then 'smtp_forge_db' if that's what the user prefers
  const env = event.nativeEvent.context.cloudflare.env;
  const d1 = env.DB || env.smtp_forge_db;
  
  if (!d1) {
    throw new Error("Cloudflare D1 binding not found. Ensure 'DB' or 'smtp_forge_db' is configured in wrangler.jsonc.");
  }
  
  return drizzle(d1, { schema });
}
