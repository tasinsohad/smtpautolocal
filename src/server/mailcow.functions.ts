import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function getMailcow(supabase: any, domainId: string) {
  const { data, error } = await supabase
    .from("domains")
    .select("name, mailcow_api_key, mailcow_hostname")
    .eq("id", domainId)
    .single();
  if (error || !data) throw new Error("Domain not found");
  if (!data.mailcow_api_key) throw new Error("Mailcow API key not set for this domain");
  if (!data.mailcow_hostname) throw new Error("Mailcow hostname not set for this domain");
  return data as { name: string; mailcow_api_key: string; mailcow_hostname: string };
}

async function mcFetch(host: string, key: string, path: string, init?: RequestInit) {
  const url = `https://${host.replace(/^https?:\/\//, "").replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new Error(`Mailcow ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

/* ---------- Ping ---------- */
const pingSchema = z.object({ domainId: z.string().uuid() });
export const mailcowPing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const m = await getMailcow(supabase, data.domainId);
    try {
      await mcFetch(m.mailcow_hostname, m.mailcow_api_key, "/api/v1/get/status/containers");
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  });

/* ---------- Add domain to Mailcow ---------- */
export const mailcowAddDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const m = await getMailcow(supabase, data.domainId);
    try {
      await mcFetch(m.mailcow_hostname, m.mailcow_api_key, "/api/v1/add/domain", {
        method: "POST",
        body: JSON.stringify({
          domain: m.name,
          description: `Added by Mailcow Provisioner`,
          aliases: 100,
          mailboxes: 100,
          defquota: 1024,
          maxquota: 10240,
          quota: 10240,
          active: 1,
          rl_value: 10,
          rl_frame: "s",
          backupmx: 0,
          relay_all_recipients: 0,
        }),
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  });

/* ---------- Get DKIM ---------- */
export const mailcowGetDkim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const m = await getMailcow(supabase, data.domainId);
    try {
      // Generate DKIM if missing (idempotent server-side: errors if exists, swallow)
      try {
        await mcFetch(m.mailcow_hostname, m.mailcow_api_key, "/api/v1/add/dkim", {
          method: "POST",
          body: JSON.stringify({ domains: m.name, dkim_selector: "dkim", key_size: 2048 }),
        });
      } catch { /* already exists */ }
      const dkim = await mcFetch(m.mailcow_hostname, m.mailcow_api_key, `/api/v1/get/dkim/${encodeURIComponent(m.name)}`);
      const pub = dkim?.dkim_txt as string | undefined;
      if (!pub) return { ok: false, error: "No DKIM key returned" };

      // Update existing dkim placeholder record
      await supabase
        .from("dns_records")
        .update({ content: pub, status: "pending", last_error: null, cf_record_id: null })
        .eq("domain_id", data.domainId)
        .eq("name", "dkim._domainkey")
        .eq("type", "TXT");

      return { ok: true, dkim: pub };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  });

/* ---------- Add mailbox ---------- */
const mailboxSchema = z.object({
  domainId: z.string().uuid(),
  localPart: z.string().min(1).max(64).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(8).max(128),
  name: z.string().max(100).optional(),
  quotaMb: z.number().int().min(1).max(102400).optional(),
});
export const mailcowAddMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => mailboxSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const m = await getMailcow(supabase, data.domainId);
    try {
      await mcFetch(m.mailcow_hostname, m.mailcow_api_key, "/api/v1/add/mailbox", {
        method: "POST",
        body: JSON.stringify({
          local_part: data.localPart,
          domain: m.name,
          name: data.name ?? data.localPart,
          quota: data.quotaMb ?? 1024,
          password: data.password,
          password2: data.password,
          active: 1,
          force_pw_update: 0,
          tls_enforce_in: 1,
          tls_enforce_out: 1,
        }),
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  });

/* ---------- List mailboxes ---------- */
export const mailcowListMailboxes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const m = await getMailcow(supabase, data.domainId);
    try {
      const list = await mcFetch(m.mailcow_hostname, m.mailcow_api_key, `/api/v1/get/mailbox/all/${encodeURIComponent(m.name)}`);
      const boxes = Array.isArray(list) ? list : [];
      return {
        ok: true,
        mailboxes: boxes.map((b: any) => ({
          username: b.username,
          name: b.name,
          quota: b.quota,
          active: b.active,
        })),
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  });
