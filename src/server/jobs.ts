import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { domainBatches, jobTemplates } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

const createBatchSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().optional(),
});

export const createDomainBatch = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => createBatchSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const { db, userId } = context as any;
    const [res] = await db.insert(domainBatches).values({
      userId,
      name: data.name,
      templateId: data.templateId,
    }).returning();
    return res;
  });

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  subdomainPrefixes: z.array(z.string()),
  personNames: z.array(z.string()),
});

export const saveJobTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const { db, userId } = context as any;
    if (data.id && data.id !== "new") {
      await db.update(jobTemplates)
        .set({
          name: data.name,
          subdomainPrefixes: JSON.stringify(data.subdomainPrefixes),
          personNames: JSON.stringify(data.personNames),
        })
        .where(and(eq(jobTemplates.id, data.id), eq(jobTemplates.userId, userId)));
      return { id: data.id };
    } else {
      const [res] = await db.insert(jobTemplates).values({
        userId,
        name: data.name,
        subdomainPrefixes: JSON.stringify(data.subdomainPrefixes),
        personNames: JSON.stringify(data.personNames),
      }).returning();
      return res;
    }
  });

export const deleteJobTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const { db, userId } = context as any;
    await db.delete(jobTemplates).where(and(eq(jobTemplates.id, data.id), eq(jobTemplates.userId, userId)));
    return { ok: true };
  });

export const listJobTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
const { db, userId } = context as any;
    const templates = await db.query.jobTemplates.findMany({
      where: eq(jobTemplates.userId, userId),
    });
    return templates.map((t: any) => ({
      ...t,
      subdomainPrefixes: t.subdomainPrefixes ? JSON.parse(t.subdomainPrefixes) : [],
      personNames: t.personNames ? JSON.parse(t.personNames) : [],
    }));
  });
