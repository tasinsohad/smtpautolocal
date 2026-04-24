import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Server, Settings, Mail, Search, Activity, ChevronRight, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/")({
  component: Overview,
});

/** Returns the last N month labels + their UTC start/end timestamps */
function lastNMonths(n: number) {
  const months: { label: string; from: Date; to: Date }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    months.push({
      label: d.toLocaleString("default", { month: "short" }).toUpperCase(),
      from,
      to,
    });
  }
  return months;
}

function Overview() {
  const { data: stats } = useQuery({
    queryKey: ["overview-stats"],
    queryFn: async () => {
      const [d, s, r, sec, batches, inboxes] = await Promise.all([
        supabase.from("domains").select("id, status, created_at", { count: "exact" }),
        supabase.from("servers").select("id, status", { count: "exact" }),
        supabase.from("dns_records").select("id, status", { count: "exact" }),
        supabase.from("user_secrets").select("cf_api_token").maybeSingle(),
        supabase.from("domain_batches").select("id", { count: "exact" }),
        supabase.from("planned_inboxes").select("id", { count: "exact" }),
      ]);
      return {
        domains: d.count ?? 0,
        domainRows: (d.data ?? []) as { id: string; created_at: string }[],
        servers: s.count ?? 0,
        records: r.count ?? 0,
        hasCfToken: Boolean(sec.data?.cf_api_token),
        jobs: batches.count ?? 0,
        inboxes: inboxes.count ?? 0,
      };
    },
  });

  // Build real chart data: domains created per month over the last 7 months
  const chartData = useMemo(() => {
    const months = lastNMonths(7);
    const rows = stats?.domainRows ?? [];
    return months.map((m) => {
      const count = rows.filter((r) => {
        const d = new Date(r.created_at);
        return d >= m.from && d <= m.to;
      }).length;
      return { label: m.label, count };
    });
  }, [stats]);

  const chartMax = useMemo(() => Math.max(...chartData.map((d) => d.count), 1), [chartData]);

  // Compute progress bar percentages from real totals (cap at 100)
  const domainPct = Math.min(100, Math.round((stats?.domains ?? 0) / Math.max(stats?.domains ?? 1, 50) * 100));
  const serverPct = Math.min(100, Math.round((stats?.servers ?? 0) / Math.max(stats?.servers ?? 1, 10) * 100));
  const jobsPct   = Math.min(100, Math.round((stats?.jobs ?? 0)    / Math.max(stats?.jobs ?? 1, 20) * 100));
  const inboxPct  = Math.min(100, Math.round((stats?.inboxes ?? 0) / Math.max(stats?.inboxes ?? 1, 1000) * 100));

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Overview</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            className="pl-10 rounded-full bg-white border-0 shadow-sm shadow-black/5 focus-visible:ring-[#4DB584]"
          />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Domains"
          value={stats?.domains ?? "—"}
          percent={domainPct}
          icon={Globe}
          iconBg="bg-[#EAF6F0]"
          iconColor="text-[#4DB584]"
          barColor="bg-[#4DB584]"
        />
        <StatCard
          label="Active Servers"
          value={stats?.servers ?? "—"}
          percent={serverPct}
          icon={Server}
          iconBg="bg-[#FCEAEA]"
          iconColor="text-[#FC6B6B]"
          barColor="bg-[#FC6B6B]"
        />
        <StatCard
          label="Domain Jobs"
          value={stats?.jobs ?? "—"}
          percent={jobsPct}
          icon={Activity}
          iconBg="bg-[#FEF5E7]"
          iconColor="text-[#F5A623]"
          barColor="bg-[#F5A623]"
        />
        <StatCard
          label="Planned Inboxes"
          value={stats?.inboxes ?? "—"}
          percent={inboxPct}
          icon={Mail}
          iconBg="bg-[#EFEAF6]"
          iconColor="text-[#8D58B5]"
          barColor="bg-[#8D58B5]"
        />
      </div>

      {/* Middle Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Domains added per month chart */}
        <div className="rounded-[24px] bg-white p-6 shadow-xl shadow-black/[0.03] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Domains Added</h2>
              <p className="text-xs text-gray-400 mt-0.5">Per month, last 7 months</p>
            </div>
          </div>
          {chartData.every((d) => d.count === 0) ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400 italic h-48">
              No domains added yet — add your first domain to see activity!
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2 h-48 pb-2 px-2">
              {chartData.map((d, i) => {
                const heightPct = chartMax > 0 ? Math.max(4, Math.round((d.count / chartMax) * 100)) : 4;
                return (
                  <div key={i} className="flex flex-col items-center gap-2 w-full group cursor-default">
                    <span className={`text-xs font-bold text-gray-700 transition-opacity ${d.count > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}>
                      {d.count > 0 ? d.count : ""}
                    </span>
                    <div
                      className="w-full max-w-[18px] rounded-full transition-all duration-500 group-hover:opacity-80"
                      style={{
                        height: `${heightPct}%`,
                        background: d.count > 0 ? "#FC6B6B" : "#E5E7EB",
                      }}
                    />
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{d.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Setup Steps List */}
        <div className="rounded-[24px] bg-white p-6 shadow-xl shadow-black/[0.03]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-800">Setup Checklist</h2>
            <span className="text-xs font-bold text-gray-400">
              {[stats?.hasCfToken, stats?.servers, stats?.domains].filter(Boolean).length} / 4 done
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold text-gray-400 uppercase pb-3 border-b border-gray-100">
              <span className="flex-1">Task</span>
              <span className="w-24 text-right">Status</span>
            </div>

            <StepRow title="Add Cloudflare Token" status={stats?.hasCfToken ? "Done" : "Pending"} active={stats?.hasCfToken} href="/settings" />
            <StepRow title="Add VPS Server" status={stats?.servers ? "Done" : "Pending"} active={!!stats?.servers} href="/servers" />
            <StepRow title="Add Domains" status={stats?.domains ? "Done" : "Pending"} active={!!stats?.domains} href="/domains" />
            <StepRow title="Create Job & Plan" status={stats?.jobs ? "Done" : "Pending"} active={!!stats?.jobs} href="/jobs" />
          </div>

          {/* Progress bar for overall setup */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
              <span>Overall progress</span>
              <span>{Math.round(([stats?.hasCfToken, stats?.servers, stats?.domains, stats?.jobs].filter(Boolean).length / 4) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#4DB584] transition-all duration-700"
                style={{ width: `${([stats?.hasCfToken, stats?.servers, stats?.domains, stats?.jobs].filter(Boolean).length / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid gap-6 sm:grid-cols-3 pb-4">
        <ActionCard title="Manage Domains" desc="Provision new domains" icon={Globe} bg="bg-[#3D404A]" hoverBg="hover:bg-[#2B2E35]" href="/domains" />
        <ActionCard title="Add Server" desc="Configure a new VPS" icon={Server} bg="bg-[#FC6B6B]" hoverBg="hover:bg-[#E85B5B]" href="/servers" />
        <ActionCard title="Settings" desc="API Tokens & Templates" icon={Settings} bg="bg-[#4DB584]" hoverBg="hover:bg-[#3EA073]" href="/settings" />
      </div>
    </div>
  );
}

function StatCard({ label, value, percent, icon: Icon, iconBg, iconColor, barColor }: any) {
  return (
    <div className="rounded-[24px] bg-white p-6 shadow-xl shadow-black/[0.03] flex flex-col justify-between h-36 transform transition-transform hover:-translate-y-1">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-3xl font-extrabold text-gray-800 tracking-tight">{value}</div>
          <div className="text-sm font-semibold text-gray-400 mt-1">{label}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-xs font-bold text-gray-400 mb-2">{percent}%</div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

function StepRow({ title, status, active, href }: any) {
  return (
    <Link to={href} className="flex justify-between items-center py-3 group cursor-pointer border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 flex-1">
        <div className={`h-2 w-2 rounded-full ${active ? "bg-[#4DB584]" : "bg-gray-200"}`} />
        <span className={`font-semibold text-sm ${active ? "text-gray-800" : "text-gray-500"} group-hover:text-[#4DB584] transition-colors`}>
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold ${active ? "text-[#4DB584]" : "text-gray-300"}`}>{status}</span>
        {active && <CheckCircle2 className="h-4 w-4 text-[#4DB584]" />}
      </div>
    </Link>
  );
}

function ActionCard({ title, desc, icon: Icon, bg, hoverBg, href }: any) {
  return (
    <Link to={href} className={`rounded-[24px] p-6 flex items-center gap-4 ${bg} ${hoverBg} transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/10">
        <Icon className="h-6 w-6 text-white opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
      </div>
      <div className="flex-1">
        <div className="text-lg font-bold text-white tracking-wide">{title}</div>
        <div className="text-sm font-medium text-white/70">{desc}</div>
      </div>
      <ChevronRight className="h-5 w-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
    </Link>
  );
}

