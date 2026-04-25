import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getSecrets, saveSecrets } from "@/server/secrets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ cfApiToken: "", cfAccountId: "" });

  const { data: secrets, isLoading } = useQuery({
    queryKey: ["secrets"],
    queryFn: () => getSecrets(),
  });

  useEffect(() => {
    if (secrets) {
      setForm({
        cfApiToken: secrets.cfApiToken || "",
        cfAccountId: secrets.cfAccountId || "",
      });
    }
  }, [secrets]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => saveSecrets({ data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secrets"] }); toast.success("Settings saved successfully"); },
    onError: () => toast.error("Failed to save settings"),
  });

  return (
    <div className="flex flex-col gap-8 p-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your API integrations</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 flex flex-col gap-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F48120]/10">
                <Cloud className="h-5 w-5 text-[#F48120]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cloudflare Integration</h2>
                <p className="text-xs text-gray-500">Required for automated DNS management</p>
              </div>
            </div>

            <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-gray-400" /> API Token
                </Label>
                <Input 
                  type="password" 
                  placeholder="Cloudflare API Token with DNS Edit permissions" 
                  value={form.cfApiToken} 
                  onChange={e => setForm(f => ({ ...f, cfApiToken: e.target.value }))} 
                  className="rounded-xl font-mono" 
                />
                <p className="text-xs text-gray-500 ml-1">Must have Zone:Read and DNS:Edit permissions.</p>
              </div>

              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-gray-400" /> Account ID
                </Label>
                <Input 
                  placeholder="Cloudflare Account ID (optional)" 
                  value={form.cfAccountId} 
                  onChange={e => setForm(f => ({ ...f, cfAccountId: e.target.value }))} 
                  className="rounded-xl font-mono" 
                />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={saveMutation.isPending} className="bg-[#4DB584] hover:bg-[#3da070] rounded-xl w-32">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
