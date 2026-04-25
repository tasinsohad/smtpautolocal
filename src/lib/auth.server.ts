import { createMiddleware } from "@tanstack/react-start";
import { getDb } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

// For development, we auto-create a default user
// In production, you should implement proper authentication (Auth.js, Clerk, etc.)
const DEFAULT_USER_EMAIL = "admin@smtpforge.local";

export const requireAuth = createMiddleware().handler(async ({ next }) => {
  const db = getDb();
  
  // Auto-create/find default user for development
  // Replace this with proper auth in production
  let user = await db.query.users.findFirst({
    where: eq(users.email, DEFAULT_USER_EMAIL),
  });

  if (!user) {
    try {
      const [newUser] = await db.insert(users).values({
        id: crypto.randomUUID(),
        email: DEFAULT_USER_EMAIL,
      }).returning();
      user = newUser;
    } catch (err) {
      // Handle race condition where user was just created
      user = await db.query.users.findFirst({
        where: eq(users.email, DEFAULT_USER_EMAIL),
      });
    }
  }

  if (!user) {
    throw new Error("Failed to initialize user session");
  }

  return next({
    context: {
      db,
      userId: user.id,
      user,
    },
  });
});

// Optional: Export a public handler for unauthenticated routes
export const optionalAuth = createMiddleware().handler(async ({ next }) => {
  try {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.email, DEFAULT_USER_EMAIL),
    });
    return next({
      context: {
        db,
        userId: user?.id ?? null,
        user: user ?? null,
      },
    });
  } catch {
    return next({
      context: {
        db: null,
        userId: null,
        user: null,
      },
    });
  }
});
