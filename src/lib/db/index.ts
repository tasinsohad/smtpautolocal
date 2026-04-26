// @ts-ignore - drizzle-orm exports drizzle from the postgres module
import { drizzle } from "drizzle-orm/postgres-js";
// @ts-ignore
import postgres from "postgres";
import * as schema from "./schema";

// Check if Supabase is properly configured
function hasSupabaseConfig(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Check for presence and not placeholder values
  return !!(
    url &&
    key &&
    url.startsWith("https://") &&
    !url.includes("your-project-url") &&
    key !== "your-service-role-key"
  );
}

// Singleton DB instance for serverless
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbInstance: any = null;

export function getDb(): any {
  // Check for valid configuration
  if (!hasSupabaseConfig()) {
    throw new Error(
      "❌ Supabase not configured!\n" +
        "Please create a .env file with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
        "See .env.example for instructions.",
    );
  }

  // Reuse singleton connection (postgres pools connections automatically)
  if (!dbInstance) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Use SSL for production, disable for local development
    const isLocal = supabaseUrl.includes("localhost");

    const sql = postgres(supabaseUrl, {
      ssl: isLocal ? false : true,
      pass: supabaseServiceKey,
      // Add connection timeout to prevent hanging
      connect_timeout: 10,
      // Connection timeout for queries
      idle_timeout: 20,
      // Maximum connections in pool
      max: 1,
    });

    dbInstance = drizzle(sql, { schema });
  }

  return dbInstance;
}

// Export types
export type SupabaseDb = ReturnType<typeof getDb>;
