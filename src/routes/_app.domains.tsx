import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Globe, Trash2, ChevronRight } from "lucide-react";
import { seedMailcowRecords } from "@/lib/mailcow-defaults";

export const Route = createFileRoute("/_app/domains")({
  component: DomainsPage,
});

const domainSchema = z.object({
  name: z.string().trim().toLowerCase().min(3).max(253).regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Invalid domain"),
  server_id: z.string().uuid().optional().or(z.literal("")),
});

type Domain = { id: string; name: string; status: string; cf_zone_id: string | null; server_id: string | null };
type Server = { id: string; label: string; ip_address: string };

function DomainsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: domains } = useQuery({
    queryKey: ["domains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("domains").select("id, name, status, cf_zone_id, server_id").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Domain[];
    },
  });

  const { data: servers } = useQuery({
    queryKey: ["servers-light"],
    queryFn: async () => {
      const { data } = await supabase.from("servers").select("id, label, ip_address").order("created_at");
      return (data ?? []) as Server[];
    },
  });

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = domainSchema.safeParse({
      name: fd.get("name"),
      server_id: fd.get("server_id"),
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }

    const serverId = parsed.data.server_id || null;
    const server = serverId ? servers?.find((s) => s.id === serverId) : null;
    const ip = server?.ip_address ?? "0.0.0.0";

    const { data: dom, error } = await supabase.from("domains").insert({
      user_id: user.id,
      name: parsed.data.name,
      server_id: serverId,
      mailcow_hostname: `mail.${parsed.data.name}`,
      status: "pending",
    }).select().single();
    if (error || !dom) { toast.error(error?.message ?? "Failed"); return; }

    // Auto-seed records
    const seed = seedMailcowRecords(parsed.data.name, ip).map((r) => ({
      user_id: user.id,
      domain_id: dom.id,
      type: r.type,
      name: r.name,
      content: r.content,
      ttl: r.ttl ?? 1,
      priority: r.priority ?? null,
      proxied: false,
      status: "pending",
    }));
    const { error: dnsErr } = await supabase.from("dns_records").insert(seed);
    if (dnsErr) toast.error(`Domain created but DNS seed failed: ${dnsErr.message}`);

    toast.success("Domain added with default DNS records");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["domains"] });
    qc.invalidateQueries({ queryKey: ["overview-stats"] });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this domain and its DNS records?")) return;
    const { error } = await supabase.from("domains").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["domains"] }); }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
          <p className="mt-1 text-muted-foreground">Each domain auto-seeds the standard Mailcow DNS record set.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add domain</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add domain</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="name">Domain</Label><Input id="name" name="name" required maxLength={253} placeholder="example.com" /></div>
              <div className="space-y-2">
                <Label htmlFor="server_id">VPS server <span className="text-muted-foreground">(optional, sets mail.* IP)</span></Label>
                <Select name="server_id">
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {servers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.label} ({s.ip_address})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit">Create</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {domains && domains.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
          <Globe className="h-10 w-10 opacity-40" /><div>No domains yet.</div>
        </CardContent></Card>
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
              <Button variant="ghost" size="icon" onClick={() => onDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              <Link to={"/domains/$id" as "/"} params={{ id: d.id } as any}>
                <Button variant="ghost" size="icon"><ChevronRight className="h-4 w-4" /></Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
