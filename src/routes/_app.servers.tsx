import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Server as ServerIcon, Copy, Trash2 } from "lucide-react";
import { VPS_SETUP_STEPS } from "@/lib/mailcow-defaults";

export const Route = createFileRoute("/_app/servers")({
  component: ServersPage,
});

const serverSchema = z.object({
  label: z.string().trim().min(1).max(100),
  hostname: z.string().trim().min(1).max(253),
  ip_address: z.string().trim().regex(/^[0-9a-fA-F:.]{3,45}$/, "Invalid IP"),
  ssh_user: z.string().trim().min(1).max(32).default("root"),
});

type Srv = {
  id: string; label: string; hostname: string; ip_address: string; ssh_user: string;
  status: string; setup_steps: { id: string; done: boolean }[];
};

function ServersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: servers, isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown) as Srv[];
    },
  });

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = serverSchema.safeParse({
      label: fd.get("label"),
      hostname: fd.get("hostname"),
      ip_address: fd.get("ip_address"),
      ssh_user: fd.get("ssh_user") || "root",
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    const { error } = await supabase.from("servers").insert({
      user_id: user.id,
      ...parsed.data,
      setup_steps: VPS_SETUP_STEPS.map((s) => ({ id: s.id, done: false })),
    });
    if (error) toast.error(error.message);
    else { toast.success("Server added"); setOpen(false); qc.invalidateQueries({ queryKey: ["servers"] }); }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this server?")) return;
    const { error } = await supabase.from("servers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["servers"] }); }
  };

  const toggleStep = async (srv: Srv, stepId: string, done: boolean) => {
    const steps = srv.setup_steps.map((s) => (s.id === stepId ? { ...s, done } : s));
    const allDone = steps.every((s) => s.done);
    const { error } = await supabase.from("servers").update({
      setup_steps: steps,
      status: allDone ? "ready" : "configuring",
    }).eq("id", srv.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["servers"] });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Servers</h1>
          <p className="mt-1 text-muted-foreground">VPS hosts where Mailcow runs. Mark each setup step as complete after running it on the box.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add server</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add VPS</DialogTitle></DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="label">Label</Label><Input id="label" name="label" required maxLength={100} placeholder="mail-eu-1" /></div>
              <div className="space-y-2"><Label htmlFor="hostname">Hostname</Label><Input id="hostname" name="hostname" required maxLength={253} placeholder="mail.example.com" /></div>
              <div className="space-y-2"><Label htmlFor="ip_address">IP address</Label><Input id="ip_address" name="ip_address" required maxLength={45} placeholder="203.0.113.10" /></div>
              <div className="space-y-2"><Label htmlFor="ssh_user">SSH user</Label><Input id="ssh_user" name="ssh_user" defaultValue="root" maxLength={32} /></div>
              <DialogFooter><Button type="submit">Create</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {servers && servers.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
          <ServerIcon className="h-10 w-10 opacity-40" /><div>No servers yet. Add one to get started.</div>
        </CardContent></Card>
      )}

      <div className="space-y-4">
        {servers?.map((srv) => (
          <ServerCard key={srv.id} srv={srv} onDelete={() => onDelete(srv.id)} onToggleStep={(id, done) => toggleStep(srv, id, done)} />
        ))}
      </div>
    </div>
  );
}

function ServerCard({ srv, onDelete, onToggleStep }: { srv: Srv; onDelete: () => void; onToggleStep: (id: string, done: boolean) => void }) {
  const stepDone = (id: string) => srv.setup_steps.find((s) => s.id === id)?.done ?? false;
  const completedCount = srv.setup_steps.filter((s) => s.done).length;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {srv.label}
              <Badge variant={srv.status === "ready" ? "default" : "secondary"}>{srv.status}</Badge>
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">{srv.ssh_user}@{srv.hostname} · {srv.ip_address}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{completedCount}/{VPS_SETUP_STEPS.length}</span>
            <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {VPS_SETUP_STEPS.map((step, i) => {
          const cmd = step.command.replaceAll("<your-domain>", srv.hostname.replace(/^mail\./, ""));
          return (
            <div key={step.id} className="rounded-md border bg-card">
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-3">
                  <Checkbox checked={stepDone(step.id)} onCheckedChange={(v) => onToggleStep(step.id, Boolean(v))} />
                  <div>
                    <div className="text-sm font-medium">Step {i + 1}: {step.title}</div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <pre className="overflow-x-auto rounded-b-md bg-terminal p-3 font-mono text-xs leading-relaxed text-terminal-foreground">{cmd}</pre>
                <Button
                  variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7 text-terminal-foreground/70 hover:text-terminal-foreground hover:bg-white/10"
                  onClick={() => { navigator.clipboard.writeText(cmd); toast.success("Copied"); }}
                ><Copy className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
