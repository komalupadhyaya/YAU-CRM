import { useState, useEffect } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { Upload, CheckCircle2, AlertCircle, School, ArrowRight, RefreshCw, Plus, X, Check, FileSpreadsheet } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Campaign {
  _id: string;
  name: string;
}

export default function Import() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");

  useEffect(() => {
    api.get("/campaigns").then((r) => setCampaigns(r.data));
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Invalid file type. Please upload an .xlsx file.");
      return;
    }
    setFile(selectedFile);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    multiple: false,
    disabled: status === "uploading" || !selectedCampaign,
  });

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      toast.error("Campaign name cannot be empty.");
      return;
    }
    try {
      const res = await api.post("/campaigns", { name: newCampaignName });
      setCampaigns([...campaigns, res.data]);
      setSelectedCampaign(String(res.data._id));
      setIsCreatingCampaign(false);
      setNewCampaignName("");
      toast.success("Campaign created successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create campaign.");
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedCampaign) {
      toast.error("Please select a file and a target campaign.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("campaign_id", selectedCampaign);

    setStatus("uploading");
    try {
      const res = await api.post("/import", formData);
      setResult(res.data);
      setStatus("success");
      toast.success("Import processed successfully!");
    } catch {
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setResult(null);
  };


  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Import Schools</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload an Excel (.xlsx) file to batch add schools to a campaign.</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="page-card">
          <h2 className="font-semibold text-foreground mb-4">1. Select Target Campaign</h2>
          {isCreatingCampaign ? (
            <div className="flex gap-2">
              <input
                autoFocus
                className="input-field flex-grow"
                placeholder="Enter new campaign name..."
                value={newCampaignName}
                onChange={e => setNewCampaignName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateCampaign())}
              />
              <button type="button" onClick={handleCreateCampaign} className="p-2 bg-primary text-white rounded-xl">
                <Check size={20} />
              </button>
              <button type="button" onClick={() => setIsCreatingCampaign(false)} className="p-2 bg-accent rounded-xl">
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <select
                className="input-field pr-10"
                value={selectedCampaign}
                onChange={(e) => {
                  if (e.target.value === "new") {
                    setIsCreatingCampaign(true);
                  } else {
                    setSelectedCampaign(e.target.value);
                  }
                }}
              >
                <option value="">-- Choose Campaign --</option>
                {campaigns.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
                <option value="new" className="font-bold text-primary">+ Create New Campaign</option>
              </select>
            </div>
          )}
        </div>

        <div className="page-card">
          <h2 className="font-semibold text-foreground mb-4">2. Upload Excel File</h2>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${isDragActive ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-border hover:border-primary/50 hover:bg-accent/50"
              } ${!selectedCampaign ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="text-muted-foreground" size={32} />
            </div>
            {file ? (
              <div className="flex flex-col items-center">
                <FileSpreadsheet className="text-success mb-2" size={32} />
                <p className="font-semibold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="mt-4 text-xs font-bold text-destructive hover:underline uppercase tracking-widest"
                >
                  Remove File
                </button>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-foreground">Click or drag file here</p>
                <p className="text-sm text-muted-foreground mt-1">Only .xlsx files are supported</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleUpload}
            disabled={!file || !selectedCampaign || status === "uploading"}
            className="btn-primary w-full py-4 text-lg font-bold flex items-center justify-center gap-3 active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 transition-all shadow-xl shadow-primary/20"
          >
            {status === "uploading" ? (
              <>
                <RefreshCw size={24} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowRight size={24} />
                Finish Import
              </>
            )}
          </button>

          {status === "error" && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-center flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle size={20} />
                <span>Upload Failed</span>
              </div>
              <p className="text-sm">There was an error processing your file. Please check the format and try again.</p>
              <button
                onClick={() => setStatus("idle")}
                className="text-xs font-bold uppercase tracking-widest bg-destructive text-white px-4 py-2 rounded-lg hover:bg-destructive/90 transition-colors mt-1"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
      <Dialog open={status === "success"} onOpenChange={(open) => !open && reset()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-success" size={20} />
              Import Successful
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-6">
              Finished processing for <strong>{campaigns.find(c => String(c._id) === selectedCampaign)?.name || "Campaign"}</strong>.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 bg-accent/30 border rounded-xl">
                <p className="text-xl font-bold text-success">{result?.added || result?.countAdded || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Added</p>
              </div>
              <div className="p-3 bg-accent/30 border rounded-xl">
                <p className="text-xl font-bold text-primary">{result?.updated || result?.countUpdated || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Updated</p>
              </div>
              <div className="p-3 bg-accent/30 border rounded-xl">
                <p className="text-xl font-bold text-warning">{result?.skipped || result?.countSkipped || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Skipped</p>
              </div>
            </div>

            {(result?.errors && result.errors.length > 0) && (
              <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-4 text-left max-h-[150px] overflow-y-auto mb-6">
                <h4 className="text-destructive font-bold text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertCircle size={12} /> Row-Level Issues
                </h4>
                {result.errors.map((err: any, idx: number) => (
                  <p key={idx} className="text-xs text-destructive/80 mb-1 last:mb-0">
                    <span className="font-bold">Row {err.row}:</span> {err.reason || err.error}
                  </p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                const id = selectedCampaign;
                reset();
                navigate(`/schools?campaignId=${id}`);
              }}
              className="btn-primary w-full sm:flex-1"
            >
              View Schools
            </button>
            <button
              onClick={reset}
              className="btn-secondary w-full sm:flex-1"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
