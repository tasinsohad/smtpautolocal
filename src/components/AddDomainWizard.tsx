import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDomainsWizardAction, listDomainBatches } from "@/server/domains";
import { listServers } from "@/server/servers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { parseList } from "@/lib/planning";

interface AddDomainWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDomainWizard({ open, onOpenChange }: AddDomainWizardProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [batchName, setBatchName] = useState("");
  const [serverId, setServerId] = useState("");
  const [domainList, setDomainList] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [sshUser, setSshUser] = useState("root");
  const [inboxCount, setInboxCount] = useState(50);
  const [prefixesText, setPrefixesText] = useState("mail,web,app,dev,api,shop,blog,news,info,support,cloud,portal");
  const [namesText, setNamesText] = useState("John,Michael,David,Chris,James,Robert,Emily,Sarah,Jessica,Emma,Linda,Mary");

  const { data: servers = [] } = useQuery({
    queryKey: ["servers"],
    queryFn: () => listServers(),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => addDomainsWizardAction({ data }),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Successfully added ${res.okCount} domains!`);
        qc.invalidateQueries({ queryKey: ["domain-batches"] });
        qc.invalidateQueries({ queryKey: ["domains"] });
        onOpenChange(false);
        resetForm();
      }
    },
    onError: (err) => {
      toast.error("Failed to add domains: " + String(err));
    },
    onSettled: () => setLoading(false),
  });

  const resetForm = () => {
    setStep(1);
    setBatchName("");
    setServerId("");
    setDomainList("");
    setIpAddress("");
    setSshUser("root");
    setInboxCount(50);
  };

  const handleServerChange = (id: string) => {
    setServerId(id);
    const server = servers.find((s: any) => s.id === id);
    if (server) {
      setIpAddress(server.ipAddress);
      setSshUser(server.sshUser);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const domains = parseList(domainList);
    const prefixes = parseList(prefixesText);
    const names = parseList(namesText);

    if (domains.length === 0) {
      toast.error("Please enter at least one domain");
      setLoading(false);
      return;
    }

    addMutation.mutate({
      batchName: batchName || `Batch ${new Date().toLocaleDateString()}`,
      templateId: "default",
      rows: domains.map((d) => ({
        domain: d,
        ipAddress,
        sshUser,
        inboxCount: Number(inboxCount),
      })),
      prefixes,
      names,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-[#23242A] text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4DB584] text-white">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Add Domains Wizard</DialogTitle>
              <p className="text-xs text-gray-400 mt-1">Configure and provision a new batch of domains</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 bg-white flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 font-semibold">Batch Name</Label>
              <Input
                placeholder="e.g. Winter Campaign 2024"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 font-semibold">Target Server (Optional)</Label>
              <Select value={serverId} onValueChange={handleServerChange}>
                <SelectTrigger className="rounded-2xl border-gray-100 bg-gray-50">
                  <SelectValue placeholder="Select a server" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-xl">
                  {servers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label} ({s.ipAddress})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-gray-700 font-semibold">Domains (one per line)</Label>
            <Textarea
              placeholder="example.com\nanother.net\nthird.io"
              value={domainList}
              onChange={(e) => setDomainList(e.target.value)}
              className="min-h-[120px] rounded-2xl border-gray-100 bg-gray-50 focus:bg-white transition-colors resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 font-semibold">Default IP</Label>
              <Input
                placeholder="1.2.3.4"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="rounded-2xl border-gray-100 bg-gray-50"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 font-semibold">SSH User</Label>
              <Input
                placeholder="root"
                value={sshUser}
                onChange={(e) => setSshUser(e.target.value)}
                className="rounded-2xl border-gray-100 bg-gray-50"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 font-semibold">Inboxes per Domain</Label>
              <Input
                type="number"
                value={inboxCount}
                onChange={(e) => setInboxCount(Number(e.target.value))}
                className="rounded-2xl border-gray-100 bg-gray-50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 font-semibold text-xs uppercase tracking-wider">Subdomain Prefixes</Label>
              <Textarea
                value={prefixesText}
                onChange={(e) => setPrefixesText(e.target.value)}
                className="text-xs h-20 rounded-2xl border-gray-100 bg-gray-50 p-3 leading-relaxed"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-gray-700 font-semibold text-xs uppercase tracking-wider">Person Names</Label>
              <Textarea
                value={namesText}
                onChange={(e) => setNamesText(e.target.value)}
                className="text-xs h-20 rounded-2xl border-gray-100 bg-gray-50 p-3 leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl text-gray-500"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#4DB584] hover:bg-[#3da070] rounded-2xl px-8 gap-2 shadow-lg shadow-[#4DB584]/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Batch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
