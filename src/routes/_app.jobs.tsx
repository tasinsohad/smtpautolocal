import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listDomainBatches, listDomains } from "@/server/domains";
import { Loader2, Globe, FolderGit2, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState } from "react";

import { AddDomainWizard } from "@/components/AddDomainWizard";

export const Route = createFileRoute("/_app/jobs")({
  component: JobsPage,
});

function JobsPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["domain-batches"],
    queryFn: () => listDomainBatches(),
  });

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">Domain batches and provisioning runs</p>
        </div>
        <Button
          onClick={() => setWizardOpen(true)}
          className="bg-[#4DB584] hover:bg-[#3da070] rounded-2xl gap-2 shadow-lg shadow-[#4DB584]/20"
        >
          <Plus className="h-4 w-4" /> Add Domains
        </Button>
      </div>

      <AddDomainWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white p-16 text-center ring-1 ring-black/5">
          <FolderGit2 className="h-12 w-12 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">No jobs yet</p>
          <p className="text-sm text-gray-500">Click "Add Domains" to create your first batch.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {batches.map((b: any) => (
            <BatchCard key={b.id} batch={b} />
          ))}
        </div>
      )}
    </div>
  );
}

function BatchCard({ batch }: { batch: any }) {
  const { data: domains = [] } = useQuery({
    queryKey: ["domains", batch.id],
    queryFn: () => listDomains({ data: { batchId: batch.id } }),
  });

  return (
    <Link
      to="/jobs/$id"
      params={{ id: batch.id }}
      className="rounded-3xl bg-white p-6 ring-1 ring-black/5 shadow-sm flex flex-col gap-3 hover:ring-[#4DB584]/40 hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-100">
          <FolderGit2 className="h-5 w-5 text-[#4DB584]" />
        </div>
        <div>
          <div className="font-semibold text-gray-900">{batch.name}</div>
          <div className="text-xs text-gray-500">
            {new Date(batch.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Globe className="h-4 w-4" />
        <span>
          {domains.length} domain{domains.length !== 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
