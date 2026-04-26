import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { domains, dnsRecords, domainBatches, domainPlans, plannedInboxes, cloudflareZones, userSecrets } from "@/lib/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { planDomain } from "@/lib/planning";

export const validateDomainsAgainstZones = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ domains: z.array(z.string()) }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return [];

    try {
      const zones = await db
        .select()
        .from(cloudflareZones)
        .where(eq(cloudflareZones.userId, userId));
      
      const zoneMap = new Map(zones.map((z: any) => [z.name.toLowerCase(), z.zoneId]));

      return data.domains.map((d) => ({
        name: d,
        valid: zoneMap.has(d.toLowerCase()),
        zoneId: zoneMap.get(d.toLowerCase()) || null,
      }));
    } catch {
      return [];
    }
  });

export const listDomains = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ batchId: z.string().optional() }).optional().parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return [];

    try {
      let query = db.select().from(domains).where(eq(domains.userId, userId));
      if (data?.batchId) {
        query = db
          .select()
          .from(domains)
          .where(and(eq(domains.userId, userId), eq(domains.batchId, data.batchId)));
      }
      return await query.orderBy(desc(domains.createdAt));
    } catch {
      return [];
    }
  });

export const getDomain = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return null;

    try {
      return await db.query.domains.findFirst({
        where: and(eq(domains.id, data.id), eq(domains.userId, userId)),
      });
    } catch {
      return null;
    }
  });

export const updateDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string(),
        cfZoneId: z.string().optional().nullable(),
        cfAccountId: z.string().optional().nullable(),
        mailcowHostname: z.string().optional().nullable(),
        mailcowApiKey: z.string().optional().nullable(),
        status: z.string().optional(),
        plannedInboxCount: z.number().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return { ok: false, error: "Database not connected" };

    try {
      const { id, ...rest } = data;
      await db
        .update(domains)
        .set(rest)
        .where(and(eq(domains.id, id), eq(domains.userId, userId)));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

export const deleteDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return { ok: false, error: "Database not connected" };

    try {
      await db.delete(dnsRecords).where(eq(dnsRecords.domainId, data.id));
      await db.delete(plannedInboxes).where(eq(plannedInboxes.domainId, data.id));
      await db.delete(domainPlans).where(eq(domainPlans.domainId, data.id));
      await db.delete(domains).where(and(eq(domains.id, data.id), eq(domains.userId, userId)));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });

export const listDomainPlans = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return [];

    try {
      return await db.select().from(domainPlans).where(eq(domainPlans.userId, userId));
    } catch {
      return [];
    }
  });

export const listDomainBatches = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return [];

    try {
      return await db
        .select()
        .from(domainBatches)
        .where(eq(domainBatches.userId, userId))
        .orderBy(desc(domainBatches.createdAt));
    } catch {
      return [];
    }
  });

export const getDomainDetails = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return { domain: null, records: [] };

    try {
      const domain = await db.query.domains.findFirst({
        where: and(eq(domains.id, data.id), eq(domains.userId, userId)),
        with: {
          server: true,
        },
      });
      const records = await db.select().from(dnsRecords).where(eq(dnsRecords.domainId, data.id));
      const inboxes = await db.select().from(plannedInboxes).where(eq(plannedInboxes.domainId, data.id));
      const plan = await db.query.domainPlans.findFirst({
        where: eq(domainPlans.domainId, data.id),
      });
      return { domain, records, inboxes, plan };
    } catch (error) {
      console.error("getDomainDetails failed:", error);
      return { domain: null, records: [], inboxes: [], plan: null };
    }
  });

export const pushDnsToCloudflare = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ domainId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return { error: "Database not connected" };

    const domain = await db.query.domains.findFirst({
      where: and(eq(domains.id, data.domainId), eq(domains.userId, userId)),
    });
    if (!domain || !domain.cfZoneId) return { error: "Domain or Zone ID missing" };

    const secrets = await db.query.userSecrets.findFirst({
      where: eq(userSecrets.userId, userId),
    });
    if (!secrets?.cfApiToken) return { error: "Cloudflare token missing" };

    const records = await db.select().from(dnsRecords).where(eq(dnsRecords.domainId, domain.id));

    const results = [];
    for (const record of records) {
      if (record.status === "active") continue;
      try {
        const name = record.name === "@" ? domain.name : `${record.name}.${domain.name}`;
        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.cfZoneId}/dns_records`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secrets.cfApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: record.type,
            name,
            content: record.content,
            ttl: record.ttl || 1,
            priority: record.priority,
            proxied: record.proxied || false,
          }),
        });
        const json = (await res.json()) as any;
        if (json.success) {
          await db
            .update(dnsRecords)
            .set({ cfRecordId: json.result.id, status: "active" })
            .where(eq(dnsRecords.id, record.id));
          results.push({ name: record.name, success: true });
        } else {
          results.push({ name: record.name, success: false, error: json.errors?.[0]?.message });
        }
      } catch (err) {
        results.push({ name: record.name, success: false, error: String(err) });
      }
    }

    return { results };
  });

export const addDomainsWizardAction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        batchName: z.string().optional(),
        templateId: z.string().optional(),
        rows: z.array(
          z.object({
            domain: z.string(),
            ipAddress: z.string(),
            sshUser: z.string(),
            inboxCount: z.number(),
          }),
        ),
        prefixes: z.array(z.string()),
        names: z.array(z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId, dbError } = context as any;
    if (!db) return { okCount: 0, error: dbError || "Database not connected" };

    try {
      const secrets = await db.query.userSecrets.findFirst({
        where: eq(userSecrets.userId, userId),
      });

      const zones = await db
        .select()
        .from(cloudflareZones)
        .where(eq(cloudflareZones.userId, userId));
      const zoneMap = new Map(zones.map((z: any) => [z.name.toLowerCase(), z.zoneId]));

      let batchId: string | null = null;
      if (data.batchName) {
        const [batch] = await db
          .insert(domainBatches)
          .values({
            userId,
            name: data.batchName,
            templateId: data.templateId === "default" ? null : data.templateId,
          })
          .returning();
        batchId = batch.id;
      }

      let okCount = 0;
      for (const row of data.rows) {
        const cfZoneId = zoneMap.get(row.domain.toLowerCase()) || null;

        const [domain] = await db
          .insert(domains)
          .values({
            userId,
            batchId,
            name: row.domain,
            status: "pending",
            ipAddress: row.ipAddress,
            sshUser: row.sshUser || "root",
            plannedInboxCount: row.inboxCount,
            cfZoneId,
          })
          .returning();

        const plan = planDomain(row.domain, {
          totalInboxes: row.inboxCount,
          prefixes: data.prefixes,
          names: data.names,
        });

        const [p] = await db
          .insert(domainPlans)
          .values({
            userId,
            domainId: domain.id,
            totalInboxes: plan.totalInboxes,
            subdomainCount: plan.subdomainCount,
            status: "planned",
            prefixesSnapshot: data.prefixes,
            namesSnapshot: data.names,
          })
          .returning();

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

        // --- PHASE 4: DNS AUTOMATION ---
        const records = [
          // Root records
          { userId, domainId: domain.id, type: "A", name: "mail", content: row.ipAddress },
          { userId, domainId: domain.id, type: "TXT", name: "_dmarc", content: "v=DMARC1; p=none" },
          {
            userId,
            domainId: domain.id,
            type: "TXT",
            name: "dkim._domainkey",
            content: "v=DKIM1;k=rsa;t=s;s=email;p=PLACEHOLDER",
          },
        ];

        // Per-subdomain records
        const uniqueSubdomains = Array.from(new Set(plan.inboxes.map((ib) => ib.subdomainPrefix)));
        for (const sub of uniqueSubdomains) {
          records.push(
            { userId, domainId: domain.id, type: "A", name: sub, content: row.ipAddress },
            {
              userId,
              domainId: domain.id,
              type: "MX",
              name: sub,
              content: `mail.${row.domain}`,
              priority: 10,
            },
            {
              userId,
              domainId: domain.id,
              type: "TXT",
              name: sub,
              content: `v=spf1 ip4:${row.ipAddress} -all`,
            },
            {
              userId,
              domainId: domain.id,
              type: "TXT",
              name: `_dmarc.${sub}`,
              content: "v=DMARC1; p=none",
            },
            {
              userId,
              domainId: domain.id,
              type: "CNAME",
              name: `autodiscover.${sub}`,
              content: `mail.${row.domain}`,
            },
            {
              userId,
              domainId: domain.id,
              type: "CNAME",
              name: `autoconfig.${sub}`,
              content: `mail.${row.domain}`,
            },
            {
              userId,
              domainId: domain.id,
              type: "TXT",
              name: `dkim._domainkey.${sub}`,
              content: "v=DKIM1;k=rsa;t=s;s=email;p=PLACEHOLDER",
            },
          );
        }

        await db.insert(dnsRecords).values(records);
        okCount++;
      }

      return { okCount };
    } catch (error) {
      console.error("Wizard Execution Failed:", error);
      const msg = error instanceof Error ? error.message : String(error);
      return { okCount: 0, error: `Critical Failure: ${msg}` };
    }
  });
export const getBatchDetails = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return { batch: null, domains: [], inboxes: [] };

    try {
      const batch = await db.query.domainBatches.findFirst({
        where: and(eq(domainBatches.id, data.id), eq(domainBatches.userId, userId)),
      });
      if (!batch) return { batch: null, domains: [], inboxes: [] };

      const batchDomains = await db.select().from(domains).where(eq(domains.batchId, batch.id));
      const domainIds = batchDomains.map((d: any) => d.id);

      let records: any[] = [];
      let inboxes: any[] = [];

      if (domainIds.length > 0) {
        records = await db.select().from(dnsRecords).where(inArray(dnsRecords.domainId, domainIds));
        inboxes = await db.select().from(plannedInboxes).where(inArray(plannedInboxes.domainId, domainIds));
      }

      return { batch, domains: batchDomains, records, inboxes };
    } catch (error) {
      console.error("getBatchDetails failed:", error);
      return { batch: null, domains: [], inboxes: [] };
    }
  });
