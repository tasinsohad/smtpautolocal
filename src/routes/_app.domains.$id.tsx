import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDomainDetails, pushDnsToCloudflare } from "@/server/domains";
import { provisionServer } from "@/server/provisioning";
import { setupMailcowDomain, fetchDkimAndSync } from "@/server/mailcow";
import { Globe, Server, AlertCircle, Loader2, ArrowLeft, Send, Zap, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/domains/$id")({
  component: DomainDetailsPage,
});

function DomainDetailsPage() {
  const qc = useQueryClient();
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["domain", id],
    queryFn: () => getDomainDetails({ data: { id } }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domain = (data as any)?.domain;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.records ?? [];

  const pushDnsMutation = useMutation({
    mutationFn: () => pushDnsToCloudflare({ data: { domainId: id } }),
    onSuccess: (res: any) => {
      if (res.error) toast.error(res.error);
      else toast.success("DNS records pushed successfully");
      qc.invalidateQueries({ queryKey: ["domain", id] });
    },
  });

  const provisionMutation = useMutation({
    mutationFn: () => provisionServer({ data: { domainId: id } }),
    onSuccess: (res: any) => {
      if (res.error) toast.error(res.error);
      else toast.success("Server provisioned successfully");
      qc.invalidateQueries({ queryKey: ["domain", id] });
    },
  });

  const setupMailcowMutation = useMutation({
    mutationFn: () => setupMailcowDomain({ data: { domainId: id } }),
    onSuccess: (res: any) => {
      if (res.error) toast.error(res.error);
      else toast.success("Mailcow domain and mailboxes created");
    },
  });

  const syncDkimMutation = useMutation({
    mutationFn: () => fetchDkimAndSync({ data: { domainId: id } }),
    onSuccess: (res: any) => {
      if (res.error) toast.error(res.error);
      else toast.success("DKIM keys synced to Cloudflare");
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!domain) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Domain not found</h2>
        <Link to="/domains" className="text-blue-500 hover:underline mt-2">
          Back to Domains
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/domains">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </div>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{domain.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${domain.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {domain.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 bg-white p-2 rounded-[1.5rem] shadow-sm ring-1 ring-black/5">
          <Button
            onClick={() => pushDnsMutation.mutate()}
            disabled={pushDnsMutation.isPending}
            className="rounded-xl h-10 gap-2 bg-blue-500 hover:bg-blue-600 text-white"
          >
            {pushDnsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Push DNS
          </Button>
          <Button
            onClick={() => provisionMutation.mutate()}
            disabled={provisionMutation.isPending}
            className="rounded-xl h-10 gap-2 bg-purple-500 hover:bg-purple-600 text-white"
          >
            {provisionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Provision
          </Button>
          <Button
            onClick={() => setupMailcowMutation.mutate()}
            disabled={setupMailcowMutation.isPending}
            className="rounded-xl h-10 gap-2 bg-[#4DB584] hover:bg-[#3da070] text-white"
          >
            {setupMailcowMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Setup Mailcow
          </Button>
          <Button
            onClick={() => syncDkimMutation.mutate()}
            disabled={syncDkimMutation.isPending}
            className="rounded-xl h-10 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
          >
            {syncDkimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Sync DKIM
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5 text-gray-500" /> Assigned Server
          </h2>
          {domain.server ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100">
                <Server className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">{domain.server.label}</div>
                <div className="text-sm text-gray-500">{domain.server.ipAddress}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">No server assigned yet.</div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500" /> DNS Records
          </h2>
          {records.length > 0 ? (
            <div className="space-y-3">
              {records.map((record: any) => (
                <div
                  key={record.id}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2"
                >
                  <div className="text-sm font-medium text-slate-600">{record.type}</div>
                  <div className="font-mono text-sm">
                    {record.name === "@" ? domain.name : `${record.name}.${domain.name}`}
                  </div>
                  <div className="ml-auto text-sm text-slate-500 truncate max-w-[200px]">{record.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">No DNS records generated yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
