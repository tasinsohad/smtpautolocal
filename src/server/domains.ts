import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth.server";
import { z } from "zod";
import { domains, dnsRecords, domainBatches, domainPlans, plannedInboxes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { planDomain } from "@/lib/planning";

export const listDomains = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ batchId: z.string().optional() }).optional().parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = context as any;
    let query = db.select().from(domains).where(eq(domains.userId, userId));
    if (data?.batchId) {
      query = db.select().from(domains).where(and(eq(domains.userId, userId), eq(domains.batchId, data.batchId)));
    }
    return await query.orderBy(desc(domains.createdAt));
  });

export const getDomain = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = context as any;
    return await db.query.domains.findFirst({
      where: and(eq(domains.id, data.id), eq(domains.userId, userId)),
    });
  });

export const updateDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string(),
    cfZoneId: z.string().optional().nullable(),
    cfAccountId: z.string().optional().nullable(),
    mailcowHostname: z.string().optional().nullable(),
    mailcowApiKey: z.string().optional().nullable(),
    status: z.string().optional(),
    plannedInboxCount: z.number().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = context as any;
    const { id, ...rest } = data;
    await db.update(domains).set(rest).where(and(eq(domains.id, id), eq(domains.userId, userId)));
    return { ok: true };
  });

export const deleteDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = context as any;
    await db.delete(dnsRecords).where(eq(dnsRecords.domainId, data.id));
    await db.delete(plannedInboxes).where(eq(plannedInboxes.domainId, data.id));
    await db.delete(domainPlans).where(eq(domainPlans.domainId, data.id));
    await db.delete(domains).where(and(eq(domains.id, data.id), eq(domains.userId, userId)));
    return { ok: true };
  });

export const listDomainPlans = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { db, userId } = context as any;
    return await db.select().from(domainPlans).where(eq(domainPlans.userId, userId));
  });

export const listDomainBatches = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { db, userId } = context as any;
    return await db.select().from(domainBatches).where(eq(domainBatches.userId, userId)).orderBy(desc(domainBatches.createdAt));
  });

export const getDomainDetails = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = context as any;
    const domain = await db.query.domains.findFirst({
      where: and(eq(domains.id, data.id), eq(domains.userId, userId)),
    });
    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.domainId, data.id));
    return { domain, records };
  });

export const addDomainsWizardAction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({
    batchName: z.string().optional(),
    templateId: z.string().optional(),
    rows: z.array(z.object({
      domain: z.string(),
      ipAddress: z.string(),
      sshUser: z.string(),
      inboxCount: z.number(),
    })),
    prefixes: z.array(z.string()),
    names: z.array(z.string()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, userId } = context as any;

    let batchId: string | null = null;
    if (data.batchName) {
      const [batch] = await db.insert(domainBatches).values({
        userId,
        name: data.batchName,
        templateId: data.templateId === "default" ? null : data.templateId,
      }).returning();
      batchId = batch.id;
    }

    let okCount = 0;
    for (const row of data.rows) {
      const [domain] = await db.insert(domains).values({
        userId,
        batchId,
        name: row.domain,
        status: "pending",
        plannedInboxCount: row.inboxCount,
      }).returning();

      const plan = planDomain(row.domain, {
        totalInboxes: row.inboxCount,
        prefixes: data.prefixes,
        names: data.names,
      });

      const [p] = await db.insert(domainPlans).values({
        userId,
        domainId: domain.id,
        totalInboxes: plan.totalInboxes,
        subdomainCount: plan.subdomainCount,
        status: "planned",
        prefixesSnapshot: JSON.stringify(data.prefixes),
        namesSnapshot: JSON.stringify(data.names),
      }).returning();

      const inboxRows = plan.inboxes.map((ib) => ({
        userId,
        domainId: domain.id,
        planId: p.id,
        subdomainPrefix: ib.subdomainPrefix,
        subdomainFqdn: ib.subdomainFqdn,
        localPart: ib.localPart,
        email: ib.email,
        personName: ib.personName,
        format: ib.format,
        status: "planned",
      }));

      if (inboxRows.length) {
        await db.insert(plannedInboxes).values(inboxRows);
      }

      await db.insert(dnsRecords).values([
        { userId, domainId: domain.id, type: "A", name: "@", content: row.ipAddress, status: "pending" },
        { userId, domainId: domain.id, type: "A", name: "mail", content: row.ipAddress, status: "pending" },
        { userId, domainId: domain.id, type: "MX", name: "@", content: `mail.${row.domain}`, priority: 10, status: "pending" },
        { userId, domainId: domain.id, type: "TXT", name: "@", content: `v=spf1 ip4:${row.ipAddress} -all`, status: "pending" },
        { userId, domainId: domain.id, type: "TXT", name: "_dmarc", content: "v=DMARC1; p=none", status: "pending" },
      ]);

      okCount++;
    }

    return { okCount };
  });
