import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { cfPushDnsRecord, cfDeleteDnsRecord } from "@/server/cloudflare.functions";
import { mailcowPing, mailcowAddDomain, mailcowGetDkim, mailcowAddMailbox, mailcowListMailboxes } from "@/server/mailcow.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronLeft, Play, RefreshCcw, Trash2, Plus, CheckCircle2, XCircle, Mail, Shuffle, Inbox } from "lucide-react";
import { planDomain, parseList } from "@/lib/planning";

export const Route = createFileRoute("/_app/domains/$id")({
  component: DomainDetail,
});

type DnsRecord = {
  id: string; type: string; name: string; content: string; ttl: number; priority: number | null;
  cf_record_id: string | null; status: string; last_error: string | null;
};

type Domain = {
  id: string; name: string; status: string; cf_zone_id: string | null; cf_account_id: string | null;
  mailcow_api_key: string | null; mailcow_hostname: string | null; server_id: string | null;
};

function DomainDetail() {
  const { id } = Route.useParams() as { id: string };
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: domain } = useQuery({
    queryKey: ["domain", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("domains").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Domain;
    },
  });

  const { data: records, refetch: refetchRecords } = useQuery({
    queryKey: ["dns_records", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dns_records").select("*").eq("domain_id", id).order("type");
      if (error) throw error;
      return data as DnsRecord[];
    },
  });

  if (!domain) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center gap-3">
        <Link to="/domains"><Button variant="ghost" size="icon"><ChevronLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{domain.name}</h1>
          <p className="text-sm text-muted-foreground">{domain.cf_zone_id ? `Zone ${domain.cf_zone_id}` : "No Cloudflare zone linked yet"}</p>
        </div>
        <Badge variant="secondary">{domain.status}</Badge>
      </div>

      <Tabs defaultValue="dns">
        <TabsList>
          <TabsTrigger value="dns">DNS records</TabsTrigger>
          <TabsTrigger value="plan">Inbox plan</TabsTrigger>
          <TabsTrigger value="mailcow">Mailcow</TabsTrigger>
          <TabsTrigger value="mailboxes">Mailboxes</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="dns" className="space-y-4">
          <DnsPanel domain={domain} records={records ?? []} refetch={refetchRecords} userId={user?.id ?? ""} />
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          <InboxPlanPanel domain={domain} userId={user?.id ?? ""} />
        </TabsContent>

        <TabsContent value="mailcow" className="space-y-4">
          <MailcowPanel domain={domain} onChanged={() => qc.invalidateQueries({ queryKey: ["domain", id] })} refetchRecords={refetchRecords} />
        </TabsContent>

        <TabsContent value="mailboxes" className="space-y-4">
          <MailboxesPanel domain={domain} />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <ConfigPanel domain={domain} onSaved={() => qc.invalidateQueries({ queryKey: ["domain", id] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ DNS PANEL ============ */
function DnsPanel({ domain, records, refetch, userId }: { domain: Domain; records: DnsRecord[]; refetch: () => void; userId: string }) {
  const pushFn = useServerFn(cfPushDnsRecord);
  const delFn = useServerFn(cfDeleteDnsRecord);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<{ ts: number; ok: boolean; msg: string }[]>([]);
  const [progress, setProgress] = useState(0);

  const pushAll = async (onlyFailed = false) => {
    if (!domain.cf_zone_id) { toast.error("No Cloudflare zone linked. Run 'Sync zones' in Settings."); return; }
    const targets = records.filter((r) => (onlyFailed ? r.status === "error" : true));
    if (!targets.length) { toast.info("Nothing to push"); return; }
    setRunning(true); setLogs([]); setProgress(0);
    let done = 0;
    for (const r of targets) {
      try {
        const res = await pushFn({ data: { recordId: r.id } });
        const fqdn = r.name === "@" ? domain.name : `${r.name}.${domain.name}`;
        if (res.ok) setLogs((l) => [...l, { ts: Date.now(), ok: true, msg: `✅ ${r.type} ${fqdn}` }]);
        else setLogs((l) => [...l, { ts: Date.now(), ok: false, msg: `❌ ${r.type} ${fqdn} — ${res.error}` }]);
      } catch (e: any) {
        setLogs((l) => [...l, { ts: Date.now(), ok: false, msg: `❌ ${r.type} ${r.name} — ${e?.message ?? e}` }]);
      }
      done++; setProgress(Math.round((done / targets.length) * 100));
    }
    setRunning(false);
    refetch();
    toast.success(`Done. ${done} processed.`);
  };

  const onAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = z.object({
      type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "SRV"]),
      name: z.string().trim().min(1).max(253),
      content: z.string().trim().min(1).max(2048),
      ttl: z.coerce.number().int().min(1).max(86400).default(1),
      priority: z.coerce.number().int().min(0).max(65535).optional().or(z.literal(NaN)),
    }).safeParse({
      type: fd.get("type"),
      name: fd.get("name"),
      content: fd.get("content"),
      ttl: fd.get("ttl") || 1,
      priority: fd.get("priority") || undefined,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const { error } = await supabase.from("dns_records").insert({
      user_id: userId,
      domain_id: domain.id,
      type: parsed.data.type,
      name: parsed.data.name,
      content: parsed.data.content,
      ttl: parsed.data.ttl,
      priority: Number.isFinite(parsed.data.priority) ? parsed.data.priority : null,
      proxied: false,
      status: "pending",
    });
    if (error) toast.error(error.message); else { toast.success("Record added"); refetch(); (e.target as HTMLFormElement).reset(); }
  };

  const removeRecord = async (r: DnsRecord) => {
    if (!confirm(`Remove ${r.type} ${r.name}? (Also from Cloudflare if synced)`)) return;
    try {
      await delFn({ data: { recordId: r.id } });
      toast.success("Removed"); refetch();
    } catch (e: any) { toast.error(e?.message ?? String(e)); }
  };

  const completedCount = records.filter((r) => r.status === "synced").length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>DNS records</CardTitle>
              <CardDescription>{completedCount} of {records.length} synced to Cloudflare</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => pushAll(true)} disabled={running}><RefreshCcw className="mr-2 h-4 w-4" />Retry failed</Button>
              <Button onClick={() => pushAll(false)} disabled={running}><Play className="mr-2 h-4 w-4" />{running ? "Pushing…" : "Push all"}</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {running && <Progress value={progress} />}
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Content</th><th className="px-3 py-2 text-left">TTL</th><th className="px-3 py-2 text-left">Status</th><th /></tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{r.type}{r.priority !== null ? ` (${r.priority})` : ""}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.name === "@" ? domain.name : `${r.name}.${domain.name}`}</td>
                    <td className="max-w-md truncate px-3 py-2 font-mono text-xs">{r.content}</td>
                    <td className="px-3 py-2 text-xs">{r.ttl === 1 ? "auto" : r.ttl}</td>
                    <td className="px-3 py-2">
                      {r.status === "synced" ? <Badge className="bg-success text-success-foreground">synced</Badge>
                        : r.status === "error" ? <Badge variant="destructive" title={r.last_error ?? ""}>error</Badge>
                        : <Badge variant="secondary">pending</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeRecord(r)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No records</td></tr>}
              </tbody>
            </table>
          </div>

          {logs.length > 0 && (
            <div className="rounded-md border bg-terminal p-3 font-mono text-xs leading-relaxed text-terminal-foreground" style={{ maxHeight: 240, overflowY: "auto" }}>
              {logs.map((l, i) => (<div key={i} className={l.ok ? "" : "text-destructive"}>{l.msg}</div>))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add custom record</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="space-y-1"><Label className="text-xs">Type</Label>
              <select name="type" defaultValue="A" className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {["A","AAAA","CNAME","MX","TXT","SRV"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2"><Label className="text-xs">Name (@ for apex)</Label><Input name="name" defaultValue="@" maxLength={253} /></div>
            <div className="space-y-1 md:col-span-2"><Label className="text-xs">Content</Label><Input name="content" required maxLength={2048} /></div>
            <div className="space-y-1"><Label className="text-xs">TTL</Label><Input name="ttl" type="number" defaultValue={1} min={1} max={86400} /></div>
            <div className="space-y-1"><Label className="text-xs">Priority</Label><Input name="priority" type="number" min={0} max={65535} placeholder="MX/SRV" /></div>
            <div className="md:col-span-5" />
            <Button type="submit"><Plus className="mr-2 h-4 w-4" />Add</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

/* ============ MAILCOW PANEL ============ */
function MailcowPanel({ domain, onChanged, refetchRecords }: { domain: Domain; onChanged: () => void; refetchRecords: () => void }) {
  const pingFn = useServerFn(mailcowPing);
  const addFn = useServerFn(mailcowAddDomain);
  const dkimFn = useServerFn(mailcowGetDkim);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const run = async (key: string, fn: () => Promise<any>, successMsg: string) => {
    setBusy(key);
    try {
      const r = await fn();
      if (r?.ok === false) setResults((s) => ({ ...s, [key]: { ok: false, msg: r.error ?? "Failed" } }));
      else { setResults((s) => ({ ...s, [key]: { ok: true, msg: successMsg } })); onChanged(); refetchRecords(); }
    } catch (e: any) {
      setResults((s) => ({ ...s, [key]: { ok: false, msg: e?.message ?? String(e) } }));
    } finally { setBusy(null); }
  };

  const ready = Boolean(domain.mailcow_api_key && domain.mailcow_hostname);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mailcow integration</CardTitle>
        <CardDescription>{ready ? `Connected to ${domain.mailcow_hostname}` : "Set Mailcow API key in Configuration tab first"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Action
          title="1. Ping Mailcow API"
          desc="Verify the API key works against this Mailcow instance."
          busy={busy === "ping"} disabled={!ready}
          onRun={() => run("ping", () => pingFn({ data: { domainId: domain.id } }), "Mailcow is reachable")}
          result={results.ping}
        />
        <Action
          title="2. Add this domain to Mailcow"
          desc="Creates the domain entry with default quotas and rate limits."
          busy={busy === "add"} disabled={!ready}
          onRun={() => run("add", () => addFn({ data: { domainId: domain.id } }), "Domain added to Mailcow")}
          result={results.add}
        />
        <Action
          title="3. Generate DKIM and update DNS record"
          desc="Asks Mailcow to generate a DKIM key, then writes it back to the dkim._domainkey record. Push DNS again afterwards."
          busy={busy === "dkim"} disabled={!ready}
          onRun={() => run("dkim", () => dkimFn({ data: { domainId: domain.id } }), "DKIM generated and DNS record updated. Push DNS again.")}
          result={results.dkim}
        />
      </CardContent>
    </Card>
  );
}

function Action({ title, desc, busy, disabled, onRun, result }: { title: string; desc: string; busy: boolean; disabled?: boolean; onRun: () => void; result?: { ok: boolean; msg: string } }) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
          {result && (
            <div className={`mt-2 flex items-start gap-2 text-xs ${result.ok ? "text-success" : "text-destructive"}`}>
              {result.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" /> : <XCircle className="mt-0.5 h-3.5 w-3.5" />}
              <span>{result.msg}</span>
            </div>
          )}
        </div>
        <Button onClick={onRun} disabled={busy || disabled}>{busy ? "Working…" : "Run"}</Button>
      </div>
    </div>
  );
}

/* ============ MAILBOXES PANEL ============ */
function MailboxesPanel({ domain }: { domain: Domain }) {
  const listFn = useServerFn(mailcowListMailboxes);
  const addFn = useServerFn(mailcowAddMailbox);
  const [open, setOpen] = useState(false);
  const ready = Boolean(domain.mailcow_api_key && domain.mailcow_hostname);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["mailboxes", domain.id, ready],
    queryFn: async () => {
      if (!ready) return { ok: false, error: "Set up Mailcow first" };
      return await listFn({ data: { domainId: domain.id } });
    },
  });

  const onAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = z.object({
      localPart: z.string().trim().min(1).max(64).regex(/^[a-z0-9._-]+$/, "Lowercase letters, digits, . _ -"),
      password: z.string().min(8).max(128),
      name: z.string().trim().max(100).optional().or(z.literal("")),
      quotaMb: z.coerce.number().int().min(1).max(102400).default(1024),
    }).safeParse({
      localPart: fd.get("localPart"),
      password: fd.get("password"),
      name: fd.get("name") || undefined,
      quotaMb: fd.get("quotaMb") || 1024,
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const r = await addFn({ data: { domainId: domain.id, ...parsed.data, name: parsed.data.name || undefined } });
    if (r.ok) { toast.success("Mailbox created"); setOpen(false); refetch(); }
    else toast.error(r.error ?? "Failed");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Mailboxes</CardTitle>
            <CardDescription>Email accounts on this domain</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={!ready || isFetching}><RefreshCcw className="mr-2 h-4 w-4" />Refresh</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button disabled={!ready}><Plus className="mr-2 h-4 w-4" />New mailbox</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New mailbox on {domain.name}</DialogTitle></DialogHeader>
                <form onSubmit={onAdd} className="space-y-3">
                  <div className="space-y-1"><Label>Local part</Label>
                    <div className="flex items-center gap-2">
                      <Input name="localPart" required maxLength={64} placeholder="alice" />
                      <span className="text-sm text-muted-foreground">@{domain.name}</span>
                    </div>
                  </div>
                  <div className="space-y-1"><Label>Display name</Label><Input name="name" maxLength={100} /></div>
                  <div className="space-y-1"><Label>Password</Label><Input name="password" type="password" required minLength={8} maxLength={128} /></div>
                  <div className="space-y-1"><Label>Quota (MB)</Label><Input name="quotaMb" type="number" defaultValue={1024} min={1} max={102400} /></div>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!ready && <div className="text-sm text-muted-foreground">Configure Mailcow API key first.</div>}
        {ready && data && !data.ok && <div className="text-sm text-destructive">{data.error}</div>}
        {ready && data && data.ok && "mailboxes" in data && (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2 text-left">Address</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Quota</th><th className="px-3 py-2 text-left">Active</th></tr>
              </thead>
              <tbody>
                {(data.mailboxes ?? []).map((m: any) => (
                  <tr key={m.username} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs"><Mail className="mr-1 inline h-3 w-3" />{m.username}</td>
                    <td className="px-3 py-2">{m.name}</td>
                    <td className="px-3 py-2 text-xs">{m.quota ? `${Math.round(m.quota / 1024 / 1024)} MB` : "—"}</td>
                    <td className="px-3 py-2">{m.active ? "yes" : "no"}</td>
                  </tr>
                ))}
                {(!data.mailboxes || data.mailboxes.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">No mailboxes yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============ CONFIG PANEL ============ */
function ConfigPanel({ domain, onSaved }: { domain: Domain; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = z.object({
      cf_zone_id: z.string().trim().max(64).optional().or(z.literal("")),
      mailcow_hostname: z.string().trim().min(3).max(253),
      mailcow_api_key: z.string().trim().max(200).optional().or(z.literal("")),
    }).safeParse({
      cf_zone_id: fd.get("cf_zone_id"),
      mailcow_hostname: fd.get("mailcow_hostname"),
      mailcow_api_key: fd.get("mailcow_api_key"),
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setSaving(true);
    const { error } = await supabase.from("domains").update({
      cf_zone_id: parsed.data.cf_zone_id || null,
      mailcow_hostname: parsed.data.mailcow_hostname,
      mailcow_api_key: parsed.data.mailcow_api_key || null,
    }).eq("id", domain.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); onSaved(); }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Configuration</CardTitle><CardDescription>Cloudflare zone & Mailcow connection details</CardDescription></CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-1"><Label>Cloudflare zone ID</Label><Input name="cf_zone_id" defaultValue={domain.cf_zone_id ?? ""} maxLength={64} placeholder="(use Settings → Sync zones to auto-fill)" /></div>
          <div className="space-y-1"><Label>Mailcow hostname</Label><Input name="mailcow_hostname" defaultValue={domain.mailcow_hostname ?? `mail.${domain.name}`} required maxLength={253} /></div>
          <div className="space-y-1"><Label>Mailcow API key (read/write)</Label><Input name="mailcow_api_key" type="password" defaultValue={domain.mailcow_api_key ?? ""} maxLength={200} placeholder="from Mailcow admin → System → Configuration → API" /></div>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ============ INBOX PLAN PANEL ============ */
type PlannedInboxRow = {
  id: string;
  subdomain_prefix: string;
  subdomain_fqdn: string;
  local_part: string;
  email: string;
  person_name: string | null;
  format: string | null;
  status: string;
};

type DomainPlanRow = {
  id: string;
  total_inboxes: number;
  subdomain_count: number;
  status: string;
  prefixes_snapshot: string[];
  names_snapshot: string[];
};

function InboxPlanPanel({ domain, userId }: { domain: Domain & { planned_inbox_count?: number | null }; userId: string }) {
  const qc = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [overrideTotal, setOverrideTotal] = useState<number | "">("");

  const { data: plan } = useQuery({
    queryKey: ["plan", domain.id],
    queryFn: async () => {
      const { data } = await supabase.from("domain_plans").select("*").eq("domain_id", domain.id).maybeSingle();
      return data as DomainPlanRow | null;
    },
  });

  const { data: inboxes } = useQuery({
    queryKey: ["plan-inboxes", domain.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planned_inboxes")
        .select("*")
        .eq("domain_id", domain.id)
        .order("subdomain_fqdn")
        .order("local_part");
      if (error) throw error;
      return data as PlannedInboxRow[];
    },
  });

  const { data: defaults } = useQuery({
    queryKey: ["user_secrets"],
    queryFn: async () => {
      const { data } = await supabase.from("user_secrets").select("*").maybeSingle();
      return data;
    },
  });

  const grouped = useMemo<[string, PlannedInboxRow[]][]>(() => {
    const map = new Map<string, PlannedInboxRow[]>();
    for (const ib of inboxes ?? []) {
      const arr = map.get(ib.subdomain_fqdn) ?? [];
      arr.push(ib);
      map.set(ib.subdomain_fqdn, arr);
    }
    return Array.from(map.entries());
  }, [inboxes]);

  const regenerate = async () => {
    if (!userId) return;
    const total =
      typeof overrideTotal === "number" && overrideTotal > 0
        ? overrideTotal
        : (domain as any).planned_inbox_count ?? plan?.total_inboxes ?? 0;
    if (!total || total < 1) {
      toast.error("Set an inbox count first");
      return;
    }
    const prefixes = (plan?.prefixes_snapshot && plan.prefixes_snapshot.length
      ? plan.prefixes_snapshot
      : ((defaults as any)?.subdomain_prefixes ?? [])) as string[];
    const names = (plan?.names_snapshot && plan.names_snapshot.length
      ? plan.names_snapshot
      : ((defaults as any)?.person_names ?? [])) as string[];
    if (!prefixes.length) { toast.error("No subdomain prefixes saved (Settings)"); return; }
    if (!names.length) { toast.error("No names saved (Settings)"); return; }

    setRegenerating(true);
    try {
      const built = planDomain(domain.name, { totalInboxes: total, prefixes, names });
      await supabase.from("planned_inboxes").delete().eq("domain_id", domain.id);

      let planId = plan?.id;
      if (planId) {
        await supabase
          .from("domain_plans")
          .update({
            total_inboxes: built.totalInboxes,
            subdomain_count: built.subdomainCount,
            status: "planned",
            prefixes_snapshot: prefixes,
            names_snapshot: names,
          } as any)
          .eq("id", planId);
      } else {
        const { data: ins } = await supabase
          .from("domain_plans")
          .insert({
            user_id: userId,
            domain_id: domain.id,
            total_inboxes: built.totalInboxes,
            subdomain_count: built.subdomainCount,
            status: "planned",
            prefixes_snapshot: prefixes,
            names_snapshot: names,
          } as any)
          .select()
          .single();
        planId = (ins as any)?.id;
      }

      if (planId) {
        await supabase.from("domains").update({ planned_inbox_count: built.totalInboxes } as any).eq("id", domain.id);
        const rows = built.inboxes.map((ib) => ({
          user_id: userId,
          domain_id: domain.id,
          plan_id: planId!,
          subdomain_prefix: ib.subdomainPrefix,
          subdomain_fqdn: ib.subdomainFqdn,
          local_part: ib.localPart,
          email: ib.email,
          person_name: ib.personName,
          format: ib.format,
          status: "planned",
        }));
        if (rows.length) await supabase.from("planned_inboxes").insert(rows as any);
      }

      qc.invalidateQueries({ queryKey: ["plan", domain.id] });
      qc.invalidateQueries({ queryKey: ["plan-inboxes", domain.id] });
      qc.invalidateQueries({ queryKey: ["domain", domain.id] });
      toast.success(`Regenerated · ${built.subdomainCount} subdomain(s), ${built.inboxes.length} inbox(es)`);
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setRegenerating(false);
    }
  };

  // suppress unused-var lint for parseList import (kept for future use)
  void parseList;

  const requested = (domain as any).planned_inbox_count ?? plan?.total_inboxes ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" /> Inbox plan
            </CardTitle>
            <CardDescription>
              {plan
                ? `${plan.total_inboxes} inbox(es) across ${plan.subdomain_count} subdomain(s)`
                : "No plan yet — generate one below"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Total inboxes</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                placeholder={String(requested || 25)}
                value={overrideTotal}
                onChange={(e) => {
                  const v = e.target.value;
                  setOverrideTotal(v === "" ? "" : parseInt(v, 10));
                }}
                className="w-24"
              />
            </div>
            <Button onClick={regenerate} disabled={regenerating}>
              <Shuffle className="mr-2 h-4 w-4" />
              {regenerating ? "Generating…" : plan ? "Regenerate" : "Generate plan"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(!inboxes || inboxes.length === 0) && (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No planned inboxes. Click "Generate plan".
          </div>
        )}
        {grouped.map(([fqdn, list]) => (
          <div key={fqdn} className="overflow-hidden rounded-md border">
            <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
              <div className="font-mono text-sm">{fqdn}</div>
              <Badge variant="secondary">{list.length} inbox{list.length === 1 ? "" : "es"}</Badge>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Person</th>
                  <th className="px-3 py-2 text-left">Format</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((ib) => (
                  <tr key={ib.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{ib.email}</td>
                    <td className="px-3 py-2 text-xs">{ib.person_name ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{ib.format ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{ib.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
