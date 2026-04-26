import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBatchDetails } from "@/server/domains";
import { Globe, FolderGit2, ArrowLeft, Loader2, Mail, Send, Server, ShieldCheck, ChevronDown, ChevronRight, Network, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/_app/jobs/$id")({
  component: JobDetailsPage,
});

function JobDetailsPage() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["batch", id],
    queryFn: () => getBatchDetails({ data: { id } }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const batch = (data as any)?.batch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domains = (data as any)?.domains ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inboxes = (data as any)?.inboxes ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (data as any)?.records ?? [];

  // Group inboxes by domain then subdomain
  const inboxesByDomain = inboxes.reduce((acc: any, ib: any) => {
    if (!acc[ib.domainId]) acc[ib.domainId] = {};
    if (!acc[ib.domainId][ib.subdomainPrefix]) {
      acc[ib.domainId][ib.subdomainPrefix] = [];
    }
    acc[ib.domainId][ib.subdomainPrefix].push(ib);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FolderGit2 className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold">Job not found</h2>
        <Link to="/jobs" className="text-blue-500 hover:underline mt-2">
          Back to Jobs
        </Link>
      </div>
    );
  }

  const exportCsv = () => {
    if (!inboxes.length) return;
    
    const headers = ["Domain", "Subdomain Prefix", "Subdomain FQDN", "Email Address", "Local Part", "Person Name", "Format", "IP Address", "SSH User"];
    const rows = inboxes.map((ib: any) => {
      const domain = domains.find((d: any) => d.id === ib.domainId);
      return [
        domain?.name || "",
        ib.subdomainPrefix || "",
        ib.subdomainFqdn || "",
        ib.email || "",
        ib.localPart || "",
        ib.personName || "",
        ib.format || "",
        domain?.ipAddress || "",
        domain?.sshUser || ""
      ];
    });
    
    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `job_${batch.name}_all_inboxes.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/jobs">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </div>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{batch.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Started on {new Date(batch.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={!inboxes.length}
          className="rounded-2xl h-11 gap-2 border-gray-200 shadow-sm"
        >
          <Send className="h-4 w-4" /> Export All Inboxes (CSV)
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-2">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Domains</div>
          <div className="text-3xl font-black text-blue-500">{domains.length}</div>
          <div className="text-[10px] text-gray-500">In this batch</div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-2">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Inboxes</div>
          <div className="text-3xl font-black text-[#4DB584]">{inboxes.length}</div>
          <div className="text-[10px] text-gray-500">Planned for deployment</div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-2">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">DNS Records</div>
          <div className="text-3xl font-black text-purple-500">{records.length}</div>
          <div className="text-[10px] text-gray-500">To be pushed to Cloudflare</div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-2">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Random Subdomains</div>
          <div className="text-3xl font-black text-orange-500">{Object.keys(inboxesByDomain).reduce((total, domainId) => total + Object.keys(inboxesByDomain[domainId] || {}).length, 0)}</div>
          <div className="text-[10px] text-gray-500">Random distribution</div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FolderGit2 className="h-5 w-5 text-gray-500" /> Planned Infrastructure
        </h2>
        <p className="text-sm text-gray-500">
          Each domain shows its subdomains and mailboxes. Click to expand.
        </p>
        
        <div className="flex flex-col gap-3">
          {domains.map((domain: any) => (
            <DomainSection 
              key={domain.id} 
              domain={domain} 
              subdomains={inboxesByDomain[domain.id] || {}} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DomainSection({ domain, subdomains }: { domain: any; subdomains: Record<string, any[]> }) {
  const [expanded, setExpanded] = useState(false);
  const subdomainList = Object.entries(subdomains);
  const totalInboxes = Object.values(subdomains).flat().length;

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
          <Globe className="h-5 w-5 text-blue-500" />
          <div>
            <div className="font-semibold text-gray-900">{domain.name}</div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                {domain.ipAddress || "No IP"}
              </span>
              <span className="flex items-center gap-1">
                <Key className="h-3 w-3" />
                {domain.sshUser || "root"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold text-gray-900">{subdomainList.length} subdomains</div>
            <div className="text-xs text-[#4DB584]">{totalInboxes} inboxes</div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/30 p-4 flex flex-col gap-3">
          {subdomainList.map(([prefix, inboxes]: [string, any[]]) => (
            <SubdomainSection 
              key={prefix} 
              prefix={prefix} 
              domain={domain.name} 
              inboxes={inboxes} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubdomainSection({ prefix, domain, inboxes }: { prefix: string; domain: string; inboxes: any[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <Network className="h-4 w-4 text-purple-500" />
          <div>
            <div className="font-medium text-gray-800 text-sm">{prefix}.{domain}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                <div 
                  className="h-full bg-[#4DB584] rounded-full" 
                  style={{ width: `${Math.min(100, inboxes.length * 5)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 font-medium">{inboxes.length} mailboxes</div>
            </div>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/30 p-3">
          <div className="flex flex-col gap-1 max-h-[300px] overflow-auto">
            {inboxes.map((ib: any) => (
              <div 
                key={ib.id} 
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-100/50 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-[#4DB584]" />
                  <span className="font-medium text-gray-700">{ib.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{ib.personName}</span>
                  <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">
                    {ib.format}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}