import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth";
import { domains, plannedInboxes, servers } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";

export const getOverviewStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { db, userId } = context as any;

    const [domainCount] = await db.select({ value: count() }).from(domains).where(eq(domains.userId, userId));
    const [inboxCount] = await db.select({ value: count() }).from(plannedInboxes).where(eq(plannedInboxes.userId, userId));
    const [serverCount] = await db.select({ value: count() }).from(servers).where(eq(servers.userId, userId));

    return {
      totalDomains: domainCount.value,
      totalInboxes: inboxCount.value,
      totalServers: serverCount.value,
      activeJobs: 0, // Placeholder
    };
  });
