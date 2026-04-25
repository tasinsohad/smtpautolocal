import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { userSecrets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const getSecrets = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const { db, userId } = context as any;
    const row = await db.query.userSecrets.findFirst({
      where: eq(userSecrets.userId, userId),
    });
    return row ?? null;
  });

export const saveSecrets = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({
    cfApiToken: z.string().optional().nullable(),
    cfAccountId: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const { db, userId } = context as any;
    const existing = await db.query.userSecrets.findFirst({
      where: eq(userSecrets.userId, userId),
    });
    if (existing) {
      await db.update(userSecrets).set(data).where(eq(userSecrets.userId, userId));
    } else {
      await db.insert(userSecrets).values({ userId, ...data });
    }
    return { ok: true };
  });

export const getCfZones = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const { db, userId } = context as any;
    const secrets = await db.query.userSecrets.findFirst({
      where: eq(userSecrets.userId, userId),
    });
    if (!secrets?.cfApiToken) return [];

    try {
      const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=50", {
        headers: {
          Authorization: `Bearer ${secrets.cfApiToken}`,
          "Content-Type": "application/json",
        },
      });
      const json = await res.json() as any;
      if (!json.success) return [];
      return (json.result ?? []).map((z: any) => ({ id: z.id, name: z.name, status: z.status }));
    } catch {
      return [];
    }
  });
