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
  const [domainList, setDomainList] = useState("");
  
  // Per-domain rows (populated in step 2)
  const [domainRows, setDomainRows] = useState<any[]>([]);

  // Global settings
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
    setDomainList("");
    setDomainRows([]);
  };

  const handleNext = () => {
    if (step === 1) {
      const domains = parseList(domainList);
      if (domains.length === 0) {
        toast.error("Please enter at least one domain");
        return;
      }
      // Populate rows with defaults if they don't exist
      setDomainRows(domains.map(d => ({
        domain: d,
        ipAddress: servers[0]?.ipAddress || "1.2.3.4",
        sshUser: servers[0]?.sshUser || "root",
        inboxCount: 50
      })));
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const updateRow = (index: number, field: string, value: any) => {
    setDomainRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const prefixes = parseList(prefixesText);
    const names = parseList(namesText);

    addMutation.mutate({
      batchName: batchName || `Batch ${new Date().toLocaleDateString()}`,
      templateId: "default",
      rows: domainRows,
      prefixes,
      names,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-[#23242A] text-white">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#4DB584] text-white">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Add Domains Wizard</DialogTitle>
                <p className="text-xs text-gray-400 mt-1">Step {step} of 3</p>
              </div>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${s <= step ? 'bg-[#4DB584]' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="bg-white min-h-[400px] flex flex-col">
          {step === 1 && (
            <div className="p-8 flex flex-col gap-6 flex-1">
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
                <Label className="text-gray-700 font-semibold">Domains (one per line)</Label>
                <Textarea
                  placeholder="example.com\nanother.net\nthird.io"
                  value={domainList}
                  onChange={(e) => setDomainList(e.target.value)}
                  className="min-h-[200px] rounded-2xl border-gray-100 bg-gray-50 focus:bg-white transition-colors resize-none"
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-8 flex flex-col gap-4 flex-1 overflow-auto max-h-[500px]">
              <div className="grid grid-cols-[1fr,150px,100px,100px] gap-4 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                <div>Domain</div>
                <div>IP Address</div>
                <div>SSH User</div>
                <div>Inboxes</div>
              </div>
              {domainRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr,150px,100px,100px] gap-4 items-center bg-gray-50 p-3 rounded-2xl ring-1 ring-black/5">
                  <div className="font-medium text-gray-900 truncate">{row.domain}</div>
                  <Input 
                    value={row.ipAddress} 
                    onChange={(e) => updateRow(i, 'ipAddress', e.target.value)}
                    className="h-9 rounded-xl border-none bg-white shadow-sm text-xs"
                  />
                  <Input 
                    value={row.sshUser} 
                    onChange={(e) => updateRow(i, 'sshUser', e.target.value)}
                    className="h-9 rounded-xl border-none bg-white shadow-sm text-xs"
                  />
                  <Input 
                    type="number"
                    value={row.inboxCount} 
                    onChange={(e) => updateRow(i, 'inboxCount', Number(e.target.value))}
                    className="h-9 rounded-xl border-none bg-white shadow-sm text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="p-8 flex flex-col gap-6 flex-1">
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <Label className="text-gray-700 font-semibold text-xs uppercase tracking-wider">Subdomain Prefixes</Label>
                  <Textarea
                    value={prefixesText}
                    onChange={(e) => setPrefixesText(e.target.value)}
                    className="text-xs h-40 rounded-2xl border-gray-100 bg-gray-50 p-4 leading-relaxed"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-gray-700 font-semibold text-xs uppercase tracking-wider">Person Names</Label>
                  <Textarea
                    value={namesText}
                    onChange={(e) => setNamesText(e.target.value)}
                    className="text-xs h-40 rounded-2xl border-gray-100 bg-gray-50 p-4 leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-8 border-t border-gray-50 bg-gray-50/50">
            <Button
              type="button"
              variant="ghost"
              onClick={() => step === 1 ? onOpenChange(false) : setStep(step - 1)}
              className="rounded-2xl text-gray-500"
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            
            {step < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="bg-[#23242A] hover:bg-black text-white rounded-2xl px-8 gap-2 shadow-lg"
              >
                Next Step
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="bg-[#4DB584] hover:bg-[#3da070] rounded-2xl px-8 gap-2 shadow-lg shadow-[#4DB584]/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Batch
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
