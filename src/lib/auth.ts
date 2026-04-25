import { createMiddleware } from '@tanstack/react-start';
import { getDb } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_USER_EMAIL = 'admin@smtpforge.local';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const requireAuth = createMiddleware().server(async ({ next }: any) => {
  const db = getDb();
  
  let user: any = null;
  try {
    user = await db.query.users.findFirst({
      where: eq(users.email, DEFAULT_USER_EMAIL),
    });
  } catch {
    // DB not connected
  }

  if (!user) {
    try {
      const [newUser] = await db.insert(users).values({
        email: DEFAULT_USER_EMAIL,
      }).returning();
      user = newUser;
    } catch {
      user = { id: 'dev-user', email: DEFAULT_USER_EMAIL };
    }
  }

  return next({
    context: {
      db,
      userId: user?.id ?? 'dev-user',
      user: user ?? { id: 'dev-user', email: DEFAULT_USER_EMAIL },
    },
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const optionalAuth = createMiddleware().server(async ({ next }: any) => {
  let db: any;
  let user: any = null;
  
  try {
    db = getDb();
    user = await db.query.users.findFirst({
      where: eq(users.email, DEFAULT_USER_EMAIL),
    });
  } catch {
    // DB not connected
  }
  
  return next({
    context: {
      db,
      userId: user?.id ?? null,
      user,
    },
  });
});