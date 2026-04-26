import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { domains, dnsRecords } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NodeSSH } from "node-ssh";

export const provisionServer = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ domainId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { db, userId } = context as any;
    if (!db) return { error: "Database not connected" };

    const domain = await db.query.domains.findFirst({
      where: and(eq(domains.id, data.domainId), eq(domains.userId, userId)),
      with: { server: true },
    });

    if (!domain || !domain.server) return { error: "Domain or Server not found" };

    const ssh = new NodeSSH();
    const log: string[] = [];

    const addLog = (msg: string) => {
      log.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      console.log(`[Provisioning ${domain.name}] ${msg}`);
    };

    try {
      addLog(`Connecting to ${domain.server.ipAddress}...`);
      await ssh.connect({
        host: domain.server.ipAddress,
        username: domain.server.sshUser,
        password: domain.server.sshPassword || undefined,
      });
      addLog("Connected successfully.");

      addLog("Updating system packages...");
      await ssh.execCommand("sudo apt update && sudo apt upgrade -y");

      addLog("Installing Docker...");
      await ssh.execCommand("curl -sSL https://get.docker.com/ | CHANNEL=stable sh");
      await ssh.execCommand("systemctl enable --now docker");

      addLog("Installing Mailcow...");
      await ssh.execCommand("cd /opt && git clone https://github.com/mailcow/mailcow-dockerized || cd mailcow-dockerized");
      // generate_config.sh requires interaction or environment variables
      // Mailcow supports MAILCOW_HOSTNAME=...
      await ssh.execCommand(`cd /opt/mailcow-dockerized && MAILCOW_HOSTNAME=mail.${domain.name} ./generate_config.sh`);
      
      addLog("Starting Mailcow containers...");
      await ssh.execCommand("cd /opt/mailcow-dockerized && docker compose pull && docker compose up -d");

      addLog("Provisioning complete!");
      
      await db.update(domains).set({ status: "active" }).where(eq(domains.id, domain.id));

      return { success: true, log };
    } catch (error) {
      addLog(`ERROR: ${String(error)}`);
      await db.update(domains).set({ status: "error" }).where(eq(domains.id, domain.id));
      return { success: false, log, error: String(error) };
    } finally {
      ssh.dispose();
    }
  });
