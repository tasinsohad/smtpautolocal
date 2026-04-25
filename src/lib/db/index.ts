// @ts-ignore - drizzle-orm exports drizzle from the postgres module
import { drizzle } from 'drizzle-orm/postgres-js';
// @ts-ignore
import postgres from 'postgres';
import * as schema from './schema';

// For demo/development, use a mock if no env vars
const useMock = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockDb: any = null;

if (useMock) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Using mock database.');
  console.warn('   This is only for local development without Supabase.');
  
  // Create a mock database for local development
  mockDb = {
    query: {
      users: { findFirst: async () => null },
    },
    insert: () => ({ values: () => ({ returning: async () => [{ id: 'mock-id', email: 'admin@smtpforge.local' }] }) }),
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }) }),
  };
}

// Cache the database instance per request
const dbCache = new Map<string, ReturnType<typeof drizzle>>();

export function getDb() {
  if (useMock) return mockDb;
  
  const cacheKey = `db-${Math.random().toString(36).slice(2, 9)}`;
  
  if (!dbCache.has(cacheKey)) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Use postgres for Drizzle ORM with Supabase
    const sql = postgres(supabaseUrl, {
      ssl: true,
      pass: supabaseServiceKey,
    });
    
    dbCache.set(cacheKey, drizzle(sql, { schema }));
  }
  
  return dbCache.get(cacheKey)!;
}

// Export types
export type SupabaseDb = ReturnType<typeof getDb>;