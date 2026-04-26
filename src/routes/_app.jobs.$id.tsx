import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getBatchDetails } from "@/server/domains";
import { Globe, FolderGit2, ArrowLeft, Loader2, Mail, Send, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    const headers = ["Domain", "Email", "Local Part", "Name", "Format"];
    const rows = inboxes.map((ib: any) => [
      ib.subdomainFqdn,
      ib.email,
      ib.localPart,
      ib.personName,
      ib.format
    ]);
    
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

      <div className="grid gap-6 md:grid-cols-3">
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500" /> Domains in Job
          </h2>
          <div className="flex flex-col gap-2 max-h-[400px] overflow-auto pr-2 scrollbar-thin">
            {domains.map((d: any) => (
              <Link
                key={d.id}
                to="/domains/$id"
                params={{ id: d.id }}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 border border-gray-100 hover:border-[#4DB584]/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-gray-900">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400">{d.plannedInboxCount} inboxes</span>
                  <ArrowLeft className="h-4 w-4 text-gray-300 rotate-180 group-hover:text-[#4DB584]" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-gray-500" /> Inbox Sample
          </h2>
          <div className="flex flex-col gap-2">
            {inboxes.slice(0, 8).map((ib: any) => (
              <div key={ib.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2 border border-slate-100">
                <div className="text-xs font-medium text-gray-700">{ib.email}</div>
                <div className="text-[10px] text-gray-400 font-mono">{ib.subdomainPrefix}</div>
              </div>
            ))}
            {inboxes.length > 8 && (
              <div className="text-center py-2 text-xs text-gray-400 italic">
                + {inboxes.length - 8} more inboxes planned
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 flex flex-col gap-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5 text-gray-500" /> All Planned Inboxes
        </h2>
        <div className="overflow-hidden rounded-2xl border border-gray-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-3">Domain</th>
                <th className="px-6 py-3">Email Address</th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Format</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inboxes.map((ib: any) => (
                <tr key={ib.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-blue-600">{ib.subdomainFqdn}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{ib.email}</td>
                  <td className="px-6 py-4 text-gray-600">{ib.personName}</td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">
                      {ib.format}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
