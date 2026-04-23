import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Plus, Globe, Trash2, ChevronRight, ArrowLeft, Info, Shuffle } from "lucide-react";
import { seedMailcowRecords, VPS_SETUP_STEPS } from "@/lib/mailcow-defaults";
import { parseList, planDomain } from "@/lib/planning";

export const Route = createFileRoute("/_app/domains")({
  component: DomainsPage,
});

const domainNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Invalid domain");

const vpsSchema = z.object({
  ip_address: z.string().trim().regex(/^[0-9a-fA-F:.]{3,45}$/, "Invalid IP"),
  ssh_user: z.string().trim().min(1).max(32),
});

type Domain = { id: string; name: string; status: string; cf_zone_id: string | null; server_id: string | null };

type WizardRow = {
  domain: string;
  ip_address: string;
  ssh_user: string;
  inbox_count: number;
};

function DomainsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domains")
        .select("id, name, status, cf_zone_id, server_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Domain[];
    },
  });

  const onDelete = async (id: string) => {
    if (!confirm("Delete this domain and its DNS records?")) return;
    const { error } = await supabase.from("domains").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["domains"] });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
          <p className="mt-1 text-muted-foreground">
            Paste your domains, set the VPS for each, choose how many inboxes you want — we plan subdomains and
            addresses automatically.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add domains
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <AddDomainsWizard
              onClose={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["domains"] });
                qc.invalidateQueries({ queryKey: ["overview-stats"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {domains && domains.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
            <Globe className="h-10 w-10 opacity-40" />
            <div>No domains yet.</div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {domains?.map((d) => (
          <Card key={d.id} className="transition-colors hover:bg-accent/30">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <Link to={"/domains/$id" as "/"} params={{ id: d.id } as any} className="flex flex-1 items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.cf_zone_id ? "Zone linked" : "No CF zone"} · {d.status}
                  </div>
                </div>
              </Link>
              <Badge variant="secondary">{d.status}</Badge>
              <Button variant="ghost" size="icon" onClick={() => onDelete(d.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Link to={"/domains/$id" as "/"} params={{ id: d.id } as any}>
                <Button variant="ghost" size="icon">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AddDomainsWizard({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<WizardRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Step 3: planning lists (pre-filled from user_secrets)
  const [prefixesText, setPrefixesText] = useState("");
  const [namesText, setNamesText] = useState("");

  // Range randomizer (step 2 helper)
  const [rangeMin, setRangeMin] = useState<number>(20);
  const [rangeMax, setRangeMax] = useState<number>(40);

  const { data: defaults } = useQuery({
    queryKey: ["user_secrets"],
    queryFn: async () => {
      const { data } = await supabase.from("user_secrets").select("*").maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!defaults) return;
    const p = ((defaults as any).subdomain_prefixes ?? []) as string[];
    const n = ((defaults as any).person_names ?? []) as string[];
    setPrefixesText((cur) => (cur ? cur : p.join("\n")));
    setNamesText((cur) => (cur ? cur : n.join("\n")));
  }, [defaults]);

  const parsedDomains = useMemo(() => {
    const lines = paste
      .split(/[\s,;\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(lines));
  }, [paste]);

  const goToStep2 = () => {
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const d of parsedDomains) {
      if (domainNameSchema.safeParse(d).success) valid.push(d);
      else invalid.push(d);
    }
    if (invalid.length) {
      toast.error(`Invalid: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}`);
      return;
    }
    if (valid.length === 0) {
      toast.error("Add at least one domain");
      return;
    }
    setRows(valid.map((d) => ({ domain: d, ip_address: "", ssh_user: "root", inbox_count: 25 })));
    setStep(2);
  };

  const updateRow = (i: number, patch: Partial<WizardRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const applyVpsToAll = () => {
    if (rows.length === 0) return;
    const first = rows[0];
    setRows(rows.map((r) => ({ ...r, ip_address: first.ip_address, ssh_user: first.ssh_user })));
    toast.success("Applied first row's VPS to all");
  };

  const randomizeInboxCounts = () => {
    if (rangeMin < 1 || rangeMax < rangeMin) {
      toast.error("Invalid range");
      return;
    }
    setRows((prev) =>
      prev.map((r) => ({ ...r, inbox_count: Math.floor(Math.random() * (rangeMax - rangeMin + 1)) + rangeMin })),
    );
    toast.success(`Randomized between ${rangeMin}–${rangeMax}`);
  };

  const goToStep3 = () => {
    for (const [i, r] of rows.entries()) {
      const parsed = vpsSchema.safeParse({ ip_address: r.ip_address, ssh_user: r.ssh_user });
      if (!parsed.success) {
        toast.error(`Row ${i + 1} (${r.domain}): ${parsed.error.errors[0].message}`);
        return;
      }
      if (!Number.isInteger(r.inbox_count) || r.inbox_count < 1 || r.inbox_count > 1000) {
        toast.error(`Row ${i + 1} (${r.domain}): inbox count must be 1–1000`);
        return;
      }
    }
    setStep(3);
  };

  const submit = async () => {
    if (!user) return;
    const prefixes = parseList(prefixesText);
    const names = parseList(namesText);
    if (prefixes.length < 1) { toast.error("Add at least one subdomain prefix"); return; }
    if (names.length < 1) { toast.error("Add at least one name"); return; }

    setSubmitting(true);
    try {
      let okCount = 0;
      let inboxTotal = 0;
      for (const r of rows) {
        // 1. Server (one per domain)
        const { data: srv, error: srvErr } = await supabase
          .from("servers")
          .insert({
            user_id: user.id,
            label: `mail.${r.domain}`,
            hostname: `mail.${r.domain}`,
            ip_address: r.ip_address,
            ssh_user: r.ssh_user,
            status: "configuring",
            setup_steps: VPS_SETUP_STEPS.map((s) => ({ id: s.id, done: false })),
          })
          .select()
          .single();
        if (srvErr || !srv) {
          toast.error(`${r.domain}: ${srvErr?.message ?? "server insert failed"}`);
          continue;
        }

        // 2. Domain
        const { data: dom, error: domErr } = await supabase
          .from("domains")
          .insert({
            user_id: user.id,
            name: r.domain,
            server_id: srv.id,
            mailcow_hostname: `mail.${r.domain}`,
            status: "planning",
            planned_inbox_count: r.inbox_count,
          } as any)
          .select()
          .single();
        if (domErr || !dom) {
          toast.error(`${r.domain}: ${domErr?.message ?? "domain insert failed"}`);
          continue;
        }

        // 3. DNS seed
        const seed = seedMailcowRecords(r.domain, r.ip_address).map((rec) => ({
          user_id: user.id,
          domain_id: dom.id,
          type: rec.type,
          name: rec.name,
          content: rec.content,
          ttl: rec.ttl ?? 1,
          priority: rec.priority ?? null,
          proxied: false,
          status: "pending",
        }));
        const { error: dnsErr } = await supabase.from("dns_records").insert(seed);
        if (dnsErr) toast.warning(`${r.domain}: DNS seed failed: ${dnsErr.message}`);

        // 4. Build plan
        try {
          const plan = planDomain(r.domain, { totalInboxes: r.inbox_count, prefixes, names });
          const { data: planRow, error: planErr } = await supabase
            .from("domain_plans")
            .insert({
              user_id: user.id,
              domain_id: dom.id,
              total_inboxes: plan.totalInboxes,
              subdomain_count: plan.subdomainCount,
              status: "planned",
              prefixes_snapshot: prefixes,
              names_snapshot: names,
            } as any)
            .select()
            .single();
          if (planErr || !planRow) throw new Error(planErr?.message ?? "plan insert failed");

          const inboxRows = plan.inboxes.map((ib) => ({
            user_id: user.id,
            domain_id: dom.id,
            plan_id: (planRow as any).id,
            subdomain_prefix: ib.subdomainPrefix,
            subdomain_fqdn: ib.subdomainFqdn,
            local_part: ib.localPart,
            email: ib.email,
            person_name: ib.personName,
            format: ib.format,
            status: "planned",
          }));
          if (inboxRows.length) {
            const { error: ibErr } = await supabase.from("planned_inboxes").insert(inboxRows as any);
            if (ibErr) throw new Error(ibErr.message);
          }
          inboxTotal += plan.inboxes.length;
        } catch (e: any) {
          toast.error(`${r.domain}: planning failed — ${e?.message ?? e}`);
        }

        okCount += 1;
      }
      if (okCount > 0) toast.success(`${okCount} domain(s) added · ${inboxTotal} inbox(es) planned`);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- STEP 1 ---------- */
  if (step === 1) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Step 1 of 3 · Paste domains</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="paste">Domains (one per line)</Label>
            <Textarea
              id="paste"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={8}
              placeholder={"example.com\nclient-domain.io\nanother.net"}
              className="font-mono text-sm"
            />
            <div className="text-xs text-muted-foreground">
              {parsedDomains.length} domain{parsedDomains.length === 1 ? "" : "s"} detected.
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={goToStep2} disabled={parsedDomains.length === 0}>Next</Button>
        </DialogFooter>
      </>
    );
  }

  /* ---------- STEP 2 ---------- */
  if (step === 2) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Step 2 of 3 · VPS &amp; inbox count per domain</DialogTitle>
        </DialogHeader>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            We only store the IP and SSH user. <strong>Passwords and SSH keys are never stored.</strong> You'll log in
            yourself (PuTTY, Terminal, etc.) and run the setup commands shown after creation.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Random inbox range</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={rangeMin}
                onChange={(e) => setRangeMin(parseInt(e.target.value || "0", 10))}
                min={1}
                max={1000}
                className="w-20"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                value={rangeMax}
                onChange={(e) => setRangeMax(parseInt(e.target.value || "0", 10))}
                min={1}
                max={1000}
                className="w-20"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={randomizeInboxCounts}>
            <Shuffle className="mr-2 h-4 w-4" /> Randomize all
          </Button>
          {rows.length > 1 && (
            <Button variant="outline" size="sm" onClick={applyVpsToAll}>
              Apply row 1 VPS to all
            </Button>
          )}
        </div>

        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div key={r.domain} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">{r.domain}</div>
                <div className="text-xs text-muted-foreground">mail.{r.domain}</div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor={`ip-${i}`} className="text-xs">VPS IP address</Label>
                  <Input
                    id={`ip-${i}`}
                    value={r.ip_address}
                    onChange={(e) => updateRow(i, { ip_address: e.target.value })}
                    placeholder="203.0.113.10"
                    maxLength={45}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`user-${i}`} className="text-xs">SSH user</Label>
                  <Input
                    id={`user-${i}`}
                    value={r.ssh_user}
                    onChange={(e) => updateRow(i, { ssh_user: e.target.value })}
                    placeholder="root"
                    maxLength={32}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`inbox-${i}`} className="text-xs">Inboxes</Label>
                  <Input
                    id={`inbox-${i}`}
                    type="number"
                    min={1}
                    max={1000}
                    value={r.inbox_count}
                    onChange={(e) => updateRow(i, { inbox_count: parseInt(e.target.value || "0", 10) })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button onClick={goToStep3}>Next</Button>
        </DialogFooter>
      </>
    );
  }

  /* ---------- STEP 3 ---------- */
  const totalInboxes = rows.reduce((s, r) => s + r.inbox_count, 0);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Step 3 of 3 · Subdomain prefixes &amp; names</DialogTitle>
      </DialogHeader>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Pre-filled from your Settings defaults. Edit here to override for this batch only. We'll randomly choose
          subdomains and distribute the {totalInboxes} inbox{totalInboxes === 1 ? "" : "es"} across them.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wiz-prefixes">Subdomain prefixes</Label>
          <Textarea
            id="wiz-prefixes"
            value={prefixesText}
            onChange={(e) => setPrefixesText(e.target.value)}
            rows={9}
            placeholder={"mail\ncontact\nhello\nteam\nsupport"}
            className="font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground">{parseList(prefixesText).length} unique</div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wiz-names">People names</Label>
          <Textarea
            id="wiz-names"
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            rows={9}
            placeholder={"Alice Johnson\nJohn Doe\nMarco\nSofia Rossi"}
            className="font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground">{parseList(namesText).length} unique</div>
        </div>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" size="sm" onClick={() => setStep(2)} disabled={submitting}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Creating…" : `Create ${rows.length} domain${rows.length === 1 ? "" : "s"} & plan ${totalInboxes} inbox${totalInboxes === 1 ? "" : "es"}`}
        </Button>
      </DialogFooter>
    </>
  );
}
