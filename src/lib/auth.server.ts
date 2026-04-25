import { createMiddleware } from "@tanstack/react-start";
import { getDb } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export const requireAuth = createMiddleware().handler(async ({ next }) => {
  const db = getDb();
  
  // Mock authentication: Auto-create/find a default user
  const defaultEmail = "admin@smtpforge.local";
  let user = await db.query.users.findFirst({
    where: eq(users.email, defaultEmail),
  });

  if (!user) {
    const [newUser] = await db.insert(users).values({
      id: crypto.randomUUID(),
      email: defaultEmail,
    }).returning();
    user = newUser;
  }

  return next({
    context: {
      db,
      userId: user.id,
      user,
    },
  });
});
