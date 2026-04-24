import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, FolderGit2, ChevronRight, ListTree } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/jobs")({
  component: JobsPage,
});

type DomainBatch = {
  id: string;
  name: string;
  created_at: string;
  template: { name: string } | null;
  domains: { id: string }[];
};

function JobsPage() {
  const qc = useQueryClient();

  const { data: batches, isLoading } = useQuery({
    queryKey: ["domain_batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domain_batches")
        .select(`
          id, name, created_at,
          template:job_templates(name),
          domains(id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DomainBatch[];
    },
  });

  const onDelete = async (id: string) => {
    if (!confirm("Delete this Job? The domains inside will NOT be deleted, they will just be unlinked from this job.")) return;
    const { error } = await supabase.from("domain_batches").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Job deleted");
      qc.invalidateQueries({ queryKey: ["domain_batches"] });
      qc.invalidateQueries({ queryKey: ["domains"] });
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your domain creation batches.
          </p>
        </div>
        <Link to="/domains">
          <Button>
            Create New Job
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading jobs...</div>
      ) : batches?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
            <FolderGit2 className="h-10 w-10 opacity-40" />
            <div>No jobs found.</div>
            <p className="text-sm">Create a job when adding domains.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {batches?.map((b) => (
            <Card key={b.id} className="transition-colors hover:bg-accent/30">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex flex-1 items-center gap-4">
                  <FolderGit2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-lg">{b.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                      <span>Created {format(new Date(b.created_at), "MMM d, yyyy h:mm a")}</span>
                      <span>•</span>
                      <span>{b.domains.length} domain(s)</span>
                      {b.template && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <ListTree className="h-3 w-3" />
                            {b.template.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(b.id)} title="Delete Job">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <Link to="/domains" search={{ batch_id: b.id }}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    View Domains
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
