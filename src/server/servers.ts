import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { servers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const listServers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { db, userId } = context as any;
    const rows = await db.select().from(servers).where(eq(servers.userId, userId));
    return rows.map((s: any) => ({
      ...s,
      setupSteps: s.setupSteps ? JSON.parse(s.setupSteps) : null,
    }));
  });

export const createServer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({
    label: z.string().min(1),
    hostname: z.string().min(1),
    ipAddress: z.string().min(1),
    sshUser: z.string().default("root"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = context as any;
    const [row] = await db.insert(servers).values({
      userId,
      label: data.label,
      hostname: data.hostname,
      ipAddress: data.ipAddress,
      sshUser: data.sshUser,
      status: "configuring",
    }).returning();
    return row;
  });

export const deleteServer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = context as any;
    await db.delete(servers).where(and(eq(servers.id, data.id), eq(servers.userId, userId)));
    return { ok: true };
  });
