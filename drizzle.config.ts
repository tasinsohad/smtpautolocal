import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.SUPABASE_URL!,
    authToken: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
} satisfies Config;
