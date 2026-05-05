import { createMiddleware } from "@tanstack/react-start";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth middleware that requires authentication
export const requireAuth = createMiddleware().server(async ({ next }) => {
  let db: any = null;
  let user: any = null;
  let userId: string | null = null;

  try {
    // Get the session from the request
    const authHeader = (next as any).context?.request?.headers?.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Verify the token with Supabase
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      return new Response("Invalid token", { status: 401 });
    }

    // Get database connection
    const { getDb } = await import("./db");
    db = getDb();

    // Find or create user in our database
    user = await db.query.users.findFirst({
      where: eq(users.email, supabaseUser.email!),
    });

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: supabaseUser.email!,
        })
        .returning();
      user = newUser;
    }

    userId = user.id;

    return next({
      context: {
        db,
        userId,
        user,
        supabaseUser,
      },
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return new Response("Authentication failed", { status: 401 });
  }
});

// Optional auth middleware - doesn't require authentication
export const optionalAuth = createMiddleware().server(async ({ next }) => {
  let db: any = null;
  let user: any = null;
  let userId: string | null = null;

  try {
    const authHeader = (next as any).context?.request?.headers?.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token) {
      const {
        data: { user: supabaseUser },
        error,
      } = await supabase.auth.getUser(token);

      if (!error && supabaseUser) {
        const { getDb } = await import("./db");
        db = getDb();

        user = await db.query.users.findFirst({
          where: eq(users.email, supabaseUser.email!),
        });

        if (user) {
          userId = user.id;
        }
      }
    }
  } catch (error) {
    console.error("Optional auth error:", error);
  }

  return next({
    context: {
      db,
      userId,
      user,
    },
  });
});
