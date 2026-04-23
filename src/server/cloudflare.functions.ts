import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RATE_LIMIT_WINDOW_SEC = 300;
const RATE_LIMIT_MAX = 1100; // safe under Cloudflare's 1200/5min

async function checkRateLimit(supabase: any, userId: string, provider: string) {
  const { data } = await supabase
    .from("rate_limits")
    .select("window_started_at, count")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  const now = Date.now();
  const windowStart = data ? new Date(data.window_started_at).getTime() : 0;
  const windowAge = (now - windowStart) / 1000;

  if (!data || windowAge > RATE_LIMIT_WINDOW_SEC) {
    await supabase.from("rate_limits").upsert({
      user_id: userId,
      provider,
      window_started_at: new Date().toISOString(),
      count: 1,
    });
    return;
  }

  if (data.count >= RATE_LIMIT_MAX) {
    const waitMs = (RATE_LIMIT_WINDOW_SEC - windowAge) * 1000 + 100;
    throw new Error(`Cloudflare rate limit reached. Wait ${Math.ceil(waitMs / 1000)}s.`);
  }

  await supabase
    .from("rate_limits")
    .update({ count: data.count + 1 })
    .eq("user_id", userId)
    .eq("provider", provider);
}

async function getCfToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_secrets")
    .select("cf_api_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.cf_api_token) throw new Error("Cloudflare API token not set. Add it in Settings.");
  return data.cf_api_token as string;
}

async function cfFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as any;
  if (!res.ok || json.success === false) {
    const msg = json.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`Cloudflare: ${msg}`);
  }
  return json;
}

/* ---------- Verify token & list zones ---------- */
export const cfVerifyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const token = await getCfToken(supabase, userId);
    const json = await cfFetch(token, "/user/tokens/verify");
    return { ok: true, status: json.result?.status };
  });

export const cfListZones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const token = await getCfToken(supabase, userId);
    const json = await cfFetch(token, "/zones?per_page=50");
    return { zones: (json.result ?? []).map((z: any) => ({ id: z.id, name: z.name, account_id: z.account?.id })) };
  });

/* ---------- Push a single DNS record (idempotent) ---------- */
const pushOneSchema = z.object({ recordId: z.string().uuid() });

export const cfPushDnsRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pushOneSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const token = await getCfToken(supabase, userId);

    const { data: rec, error: recErr } = await supabase
      .from("dns_records")
      .select("*, domains!inner(name, cf_zone_id)")
      .eq("id", data.recordId)
      .single();
    if (recErr || !rec) throw new Error("Record not found");

    const dom = rec.domains as { name: string; cf_zone_id: string | null };
    if (!dom.cf_zone_id) throw new Error(`No Cloudflare zone ID for ${dom.name}`);

    const fqdnName = rec.name === "@" ? dom.name : `${rec.name}.${dom.name}`;

    try {
      await checkRateLimit(supabase, userId, "cloudflare");

      // Idempotent: search for existing
      const search = await cfFetch(
        token,
        `/zones/${dom.cf_zone_id}/dns_records?type=${encodeURIComponent(rec.type)}&name=${encodeURIComponent(fqdnName)}`
      );
      const existing = search.result?.[0];

      const body: any = {
        type: rec.type,
        name: fqdnName,
        content: rec.content,
        ttl: rec.ttl ?? 1,
        proxied: rec.proxied ?? false,
      };
      if (rec.priority !== null && rec.priority !== undefined) body.priority = rec.priority;

      let cfId: string;
      if (existing) {
        await checkRateLimit(supabase, userId, "cloudflare");
        const upd = await cfFetch(token, `/zones/${dom.cf_zone_id}/dns_records/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        cfId = upd.result.id;
      } else {
        const created = await cfFetch(token, `/zones/${dom.cf_zone_id}/dns_records`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        cfId = created.result.id;
      }

      await supabase
        .from("dns_records")
        .update({ cf_record_id: cfId, status: "synced", last_error: null })
        .eq("id", rec.id);

      return { ok: true, cf_record_id: cfId };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await supabase.from("dns_records").update({ status: "error", last_error: msg }).eq("id", rec.id);
      return { ok: false, error: msg };
    }
  });

/* ---------- Delete a record from Cloudflare ---------- */
const delSchema = z.object({ recordId: z.string().uuid() });
export const cfDeleteDnsRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => delSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const token = await getCfToken(supabase, userId);
    const { data: rec } = await supabase
      .from("dns_records")
      .select("cf_record_id, domain_id, domains!inner(cf_zone_id)")
      .eq("id", data.recordId)
      .single();
    if (rec?.cf_record_id && (rec as any).domains?.cf_zone_id) {
      try {
        await checkRateLimit(supabase, userId, "cloudflare");
        await cfFetch(token, `/zones/${(rec as any).domains.cf_zone_id}/dns_records/${rec.cf_record_id}`, { method: "DELETE" });
      } catch {
        // ignore — already gone
      }
    }
    await supabase.from("dns_records").delete().eq("id", data.recordId);
    return { ok: true };
  });
