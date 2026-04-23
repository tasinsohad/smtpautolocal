import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cfVerifyToken, cfListZones } from "@/server/cloudflare.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, KeyRound, RefreshCcw, ListTree } from "lucide-react";
import { parseList } from "@/lib/planning";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const tokenSchema = z.object({
  cf_api_token: z.string().trim().min(20, "Token looks too short").max(200),
  cf_account_id: z.string().trim().max(64).optional().or(z.literal("")),
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const verify = useServerFn(cfVerifyToken);
  const listZones = useServerFn(cfListZones);
  const [saving, setSaving] = useState(false);
  const [verifyState, setVerifyState] = useState<"idle" | "ok" | "err">("idle");
  const [verifyMsg, setVerifyMsg] = useState<string>("");

  const { data: secret } = useQuery({
    queryKey: ["user_secrets"],
    queryFn: async () => {
      const { data } = await supabase.from("user_secrets").select("*").maybeSingle();
      return data;
    },
  });

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = tokenSchema.safeParse({
      cf_api_token: fd.get("cf_api_token"),
      cf_account_id: fd.get("cf_account_id"),
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setSaving(true);
    const { error } = await supabase.from("user_secrets").upsert({
      user_id: user.id,
      cf_api_token: parsed.data.cf_api_token,
      cf_account_id: parsed.data.cf_account_id || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["user_secrets"] }); qc.invalidateQueries({ queryKey: ["overview-stats"] }); }
  };

  const onVerify = async () => {
    setVerifyState("idle"); setVerifyMsg("");
    try {
      const r = await verify();
      setVerifyState("ok"); setVerifyMsg(`Token status: ${r.status}`);
    } catch (e: any) {
      setVerifyState("err"); setVerifyMsg(e?.message ?? String(e));
    }
  };

  const onSyncZones = async () => {
    try {
      const r = await listZones();
      toast.success(`Found ${r.zones.length} zone(s) in your Cloudflare account`);
      // Auto-fill cf_zone_id on matching domains
      for (const z of r.zones) {
        await supabase.from("domains").update({ cf_zone_id: z.id, cf_account_id: z.account_id ?? null }).eq("name", z.name);
      }
      qc.invalidateQueries({ queryKey: ["domains"] });
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Configure your Cloudflare API token used for DNS automation.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Cloudflare API token</CardTitle>
          <CardDescription>
            Create a token at <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer" className="underline">cloudflare.com/profile/api-tokens</a> with
            permissions <span className="font-mono text-xs">Zone &gt; Zone &gt; Read</span> and <span className="font-mono text-xs">Zone &gt; DNS &gt; Edit</span>. Stored encrypted at rest, accessible only by your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cf_api_token">API token</Label>
              <Input id="cf_api_token" name="cf_api_token" type="password" defaultValue={secret?.cf_api_token ?? ""} placeholder={secret?.cf_api_token ? "•••• (saved)" : "Paste token"} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf_account_id">Account ID <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="cf_account_id" name="cf_account_id" defaultValue={secret?.cf_account_id ?? ""} maxLength={64} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              <Button type="button" variant="outline" onClick={onVerify}>Verify token</Button>
              <Button type="button" variant="outline" onClick={onSyncZones}><RefreshCcw className="mr-2 h-4 w-4" />Sync zones</Button>
            </div>
            {verifyState !== "idle" && (
              <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${verifyState === "ok" ? "border-success/40 bg-success/10 text-foreground" : "border-destructive/40 bg-destructive/10 text-foreground"}`}>
                {verifyState === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />}
                <div>{verifyMsg}</div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <DefaultsCard
        userId={user?.id ?? ""}
        prefixes={(secret as any)?.subdomain_prefixes ?? []}
        names={(secret as any)?.person_names ?? []}
        onSaved={() => qc.invalidateQueries({ queryKey: ["user_secrets"] })}
      />
    </div>
  );
}

function DefaultsCard({
  userId,
  prefixes,
  names,
  onSaved,
}: {
  userId: string;
  prefixes: string[];
  names: string[];
  onSaved: () => void;
}) {
  const [prefixesText, setPrefixesText] = useState(prefixes.join("\n"));
  const [namesText, setNamesText] = useState(names.join("\n"));
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("user_secrets").upsert({
      user_id: userId,
      subdomain_prefixes: parseList(prefixesText),
      person_names: parseList(namesText),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Defaults saved");
      onSaved();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTree className="h-5 w-5" /> Planning defaults
        </CardTitle>
        <CardDescription>
          Global lists used to generate inbox plans. The Add-domains wizard pre-fills these but you can override per
          batch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prefixes">Subdomain prefixes (one per line)</Label>
            <Textarea
              id="prefixes"
              value={prefixesText}
              onChange={(e) => setPrefixesText(e.target.value)}
              rows={10}
              placeholder={"mail\ncontact\nhello\nteam\nsupport\ninfo"}
              className="font-mono text-sm"
            />
            <div className="text-xs text-muted-foreground">{parseList(prefixesText).length} unique</div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="names">People names (first or full)</Label>
            <Textarea
              id="names"
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              rows={10}
              placeholder={"Alice Johnson\nJohn Doe\nMarco\nSofia Rossi"}
              className="font-mono text-sm"
            />
            <div className="text-xs text-muted-foreground">{parseList(namesText).length} unique</div>
          </div>
        </div>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save defaults"}
        </Button>
      </CardContent>
    </Card>
  );
}
