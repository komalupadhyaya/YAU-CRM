import { useEffect, useState, useCallback } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
  Search,
  MapPin,
  Plus,
  Filter,
  Phone,
  Mail,
  Globe,
  Clock,
  Calendar,
  History,
  Info,
  ExternalLink,
  ChevronRight,
  Folder,
  Users,
  Building,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { useCampaignStore } from "../store/campaignStore";
import { useLeadStore } from "../store/schoolStore";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// --- Types ---
interface Campaign {
  _id: string;
  name: string;
  createdAt: string;
}

interface Lead {
  _id: string;
  name: string;
  type?: string;
  category_group?: string; // was grades
  main_contact_name?: string; // was principal_name
  main_contact_email?: string; // was principal_email
  telephone?: string;
  start_time?: string;
  end_time?: string;
  address_number?: string; // new
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  website?: string;
  status: string;
  last_contacted: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Note {
  _id: string;
  content: string;
  createdAt: string;
}

interface FollowUp {
  _id: string;
  follow_up_date: string;
  reason: string;
  status: string;
}


const Campaigns = () => {
  const { selectedCampaign, setSelectedCampaign } = useCampaignStore();
  const { selectedLead, setSelectedLead } = useLeadStore();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [campaignSearch, setCampaignSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusLabels, setStatusLabels] = useState<string[]>([]);
  const [noteContent, setNoteContent] = useState("");

  // Create Campaign Modal
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");

  // Create Lead Modal
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    name: "",
    type: "",
    category_group: "",
    main_contact_name: "",
    main_contact_email: "",
    telephone: "",
    city: "",
    state: "",
    address: "",
    address_number: "",
    zip: "",
    website: ""
  });

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [importResult, setImportResult] = useState<any>(null);

  // Follow-up Modal
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");

  // --- Data Fetching ---

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const r = await api.get("/campaigns");
      setCampaigns(r.data);
    } catch { }
    setLoadingCampaigns(false);
  };

  const fetchLeads = useCallback(async (compId: string) => {
    setLoadingLeads(true);
    try {
      const r = await api.get(`/leads/campaign/${compId}`);
      setLeads(r.data);
      // Deselect lead if it's not in the new campaign
      if (selectedLead && !r.data.find((s: Lead) => s._id === selectedLead._id)) {
        setSelectedLead(null);
      }
    } catch { }
    setLoadingLeads(false);
  }, [selectedLead, setSelectedLead]);

  const fetchDetails = useCallback(async (leadId: string) => {
    setLoadingDetails(true);
    try {
      const [notesRes, followUpsRes] = await Promise.all([
        api.get(`/notes/${leadId}`),
        api.get(`/followups/lead/${leadId}`),
      ]);
      setNotes(notesRes.data);
      setFollowUps(followUpsRes.data);
    } catch { }
    setLoadingDetails(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
    api.get("/settings").then(res => setStatusLabels(res.data.statusLabels || []));
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      fetchLeads(selectedCampaign._id);
    } else {
      setLeads([]);
      setSelectedLead(null);
    }
  }, [selectedCampaign?._id]);

  useEffect(() => {
    if (selectedLead) {
      fetchDetails(selectedLead._id);
    }
  }, [selectedLead?._id, fetchDetails]);

  // --- Handlers ---

  const createCampaign = async () => {
    if (!newCampaignName.trim()) return;
    try {
      const res = await api.post("/campaigns", { name: newCampaignName });
      toast.success("Campaign created");
      setNewCampaignName("");
      setIsCreateCampaignOpen(false);
      await fetchCampaigns();
      setSelectedCampaign(res.data);
    } catch { }
  };

  const createLead = async () => {
    if (!selectedCampaign || !leadFormData.name.trim()) return;
    try {
      const res = await api.post("/leads", {
        ...leadFormData,
        campaign_id: selectedCampaign._id
      });
      toast.success("Lead created");
      setIsCreateLeadOpen(false);
      setLeadFormData({
        name: "", type: "", category_group: "", main_contact_name: "", main_contact_email: "",
        telephone: "", city: "", state: "", address: "", address_number: "", zip: "", website: ""
      });
      await fetchLeads(selectedCampaign._id);
      setSelectedLead(res.data);
    } catch { }
  };

  const handleImport = async () => {
    if (!importFile || !selectedCampaign) return;
    const formData = new FormData();
    formData.append("file", importFile);
    
    setImportStatus("uploading");
    try {
      const res = await api.post(`/campaigns/${selectedCampaign._id}/import`, formData);
      setImportResult(res.data);
      setImportStatus("success");
      toast.success("Import successful");
      await fetchLeads(selectedCampaign._id);
    } catch {
      setImportStatus("error");
      toast.error("Import failed");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedLead) return;
    try {
      const res = await api.patch(`/leads/${selectedLead._id}`, { status: newStatus });
      setSelectedLead(res.data);
      setLeads(prev => prev.map(s => s._id === res.data._id ? res.data : s));
      toast.success(`Status updated to ${newStatus}`);
    } catch { }
  };

  const addNote = async () => {
    if (!selectedLead || !noteContent.trim()) return;
    try {
      await api.post(`/notes/${selectedLead._id}`, { content: noteContent });
      toast.success("Note added");
      setNoteContent("");

      const [notesRes, leadRes] = await Promise.all([
        api.get(`/notes/${selectedLead._id}`),
        api.get(`/leads/${selectedLead._id}`)
      ]);
      setNotes(notesRes.data);
      setSelectedLead(leadRes.data);
      setLeads(prev => prev.map(s => s._id === leadRes.data._id ? leadRes.data : s));
    } catch { }
  };

  const submitFollowUp = async () => {
    if (!selectedLead || !followUpDate) return;
    try {
      await api.post(`/followups/${selectedLead._id}`, {
        follow_up_date: followUpDate,
        reason: followUpReason
      });
      toast.success("Follow-up scheduled");
      setIsFollowUpModalOpen(false);
      setFollowUpDate("");
      setFollowUpReason("");

      const r = await api.get(`/followups/lead/${selectedLead._id}`);
      setFollowUps(r.data);
    } catch { }
  };

  const markFollowupDone = async (fuId: string) => {
    if (!selectedLead) return;
    try {
      await api.put(`/followups/${fuId}/complete`);
      toast.success("Follow-up completed");

      const [fuRes, leadRes] = await Promise.all([
        api.get(`/followups/lead/${selectedLead._id}`),
        api.get(`/leads/${selectedLead._id}`)
      ]);
      setFollowUps(fuRes.data);
      setSelectedLead(leadRes.data);
      setLeads(prev => prev.map(s => s._id === leadRes.data._id ? leadRes.data : s));
    } catch { }
  };

  // --- Filters ---     
  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  const filteredLeads = leads.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      s.city?.toLowerCase().includes(leadSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout>
      <div className="h-auto md:h-[calc(100vh-100px)] flex flex-col md:flex-row gap-4 overflow-y-auto md:overflow-hidden p-1">

        {/* --- PANEL 1: Campaigns --- */}
        <div className="w-full md:w-64 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden shrink-0">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Campaigns</h2>
              <button
                onClick={() => setIsCreateCampaignOpen(true)}
                className="p-1 hover:bg-accent rounded text-primary transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
              <input
                placeholder="Search..."
                className="w-full bg-accent/50 border-none rounded-lg pl-8 pr-2 py-1.5 text-xs focus:ring-1 ring-primary outline-none"
                value={campaignSearch}
                onChange={e => setCampaignSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingCampaigns ? (
              <div className="p-4 text-center text-[10px] text-muted-foreground animate-pulse">Loading...</div>
            ) : filteredCampaigns.map(c => (
              <button
                key={c._id}
                onClick={() => setSelectedCampaign(c)}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all mb-1 ${selectedCampaign?._id === c._id ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent text-foreground"}`}
              >
                <Folder size={16} className={selectedCampaign?._id === c._id ? "text-primary-foreground" : "text-primary"} />
                <span className="text-xs font-medium truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --- PANEL 2: Leads --- */}
        <div className="w-full md:w-80 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden shrink-0">
          {!selectedCampaign ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground transition-all duration-300 ease-in-out">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center mb-3">
                <ChevronRight size={24} />
              </div>
              <p className="text-xs font-medium">Select a campaign to view leads</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm truncate">{selectedCampaign.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded-full font-bold text-muted-foreground">{filteredLeads.length}</span>
                    <button
                      onClick={() => setIsImportOpen(true)}
                      className="p-1 hover:bg-accent rounded text-primary transition-colors"
                      title="Import Excel/CSV"
                    >
                      <Upload size={16} />
                    </button>
                    <button
                      onClick={() => setIsCreateLeadOpen(true)}
                      className="p-1 hover:bg-accent rounded text-primary transition-colors"
                      title="Add Lead"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                  <input
                    placeholder="Search leads..."
                    className="w-full bg-accent/50 border-none rounded-lg pl-8 pr-2 py-1.5 text-xs focus:ring-1 ring-primary outline-none"
                    value={leadSearch}
                    onChange={e => setLeadSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={12} className="text-muted-foreground" />
                  <select
                    className="text-[10px] bg-transparent border-none focus:ring-0 outline-none font-medium cursor-pointer"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option className="dark:bg-accent" value="all">All Statuses</option>
                    {statusLabels.map(opt => <option className="dark:bg-accent" key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/50 max-h-[400px] md:max-h-none">
                {loadingLeads ? (
                  <div className="p-8 text-center text-[10px] text-muted-foreground animate-pulse">Loading leads...</div>
                ) : filteredLeads.length === 0 ? (
                  <div className="p-8 text-center text-[10px] text-muted-foreground">No leads found.</div>
                ) : (
                  filteredLeads.map(s => (
                    <button
                      key={s._id}
                      onClick={() => setSelectedLead(s)}
                      className={`w-full text-left p-3.5 hover:bg-gray-50 dark:hover:bg-accent/20 cursor-pointer transition-all duration-200 border-l-2 ${selectedLead?._id === s._id ? "bg-accent border-primary" : "border-transparent"}`}
                    >
                      <div className="font-semibold text-xs truncate">{s.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <MapPin size={8} /> {s.city || "Unknown"}
                        </span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${s.status === 'Active' ? 'bg-success/10 text-success' :
                          s.status === 'Not Contacted' ? 'bg-muted text-muted-foreground' : 'bg-warning/10 text-warning'
                          }`}>
                          {s.status}
                        </span>
                      </div>
                      {s.last_contacted && (
                        <div className="text-xs text-gray-400 mt-1">
                          Last contacted: {new Date(s.last_contacted).toLocaleDateString()}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* --- PANEL 3: Details & News --- */}
        <div className="flex-1 flex flex-col min-w-0 min-h-[500px] md:min-h-0">
          {!selectedLead ? (
            <div className="flex-1 bg-card border rounded-xl shadow-sm flex flex-col items-center justify-center text-muted-foreground p-12 text-center transition-all duration-300 ease-in-out">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Building size={32} />
              </div>
              <h3 className="font-bold text-foreground">No Lead Selected</h3>
              <p className="text-xs max-w-xs mt-2">Select a lead to view profile and notes</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
              {/* Activity Feed (Middle) */}
              <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-[500px] md:min-h-0">
                <div className="bg-card border rounded-xl p-4 shadow-sm shrink-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-foreground leading-tight">{selectedLead.name}</h1>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Info size={12} /> {selectedLead.type || "Lead"}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} /> {selectedLead.city}</span>
                      </div>
                    </div>
                    <button onClick={() => setIsFollowUpModalOpen(true)} className="p-1 hover:bg-accent rounded text-primary transition-colors"><Plus size={14} /></button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
                  <div className="p-3 border-b bg-accent/5 flex items-center gap-2">
                    <History size={16} className="text-primary" />
                    <h2 className="font-bold text-xs uppercase tracking-wider">Activity Feed</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    <div className="bg-accent/10 dark:bg-accent/5 rounded-xl p-3 border border-dashed border-primary/20">
                      <textarea
                        placeholder="Add a note..."
                        className="w-full bg-transparent border-none text-xs outline-none resize-none min-h-[50px] dark:text-foreground"
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                      />
                      <div className="flex justify-end mt-1">
                        <button onClick={addNote} disabled={!noteContent.trim()} className="btn-primary px-3 text-[10px] disabled:opacity-50">Post Note</button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {loadingDetails ? (
                        <div className="text-center py-4 animate-pulse text-[10px] text-muted-foreground">Loading feed...</div>
                      ) : notes.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          <p className="font-medium">No notes yet</p>
                          <p className="text-[10px] mt-1">Add your first outreach note</p>
                        </div>
                      ) : (
                        notes.map(n => (
                          <div key={n._id} className="relative pl-5 before:absolute before:left-[6px] before:top-2 before:bottom-[-20px] before:w-[1.5px] before:bg-border last:before:hidden">
                            <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                            <div className="bg-white dark:bg-card shadow-sm border rounded-lg p-2.5">
                              <p className="text-xs text-foreground leading-relaxed">{n.content}</p>
                              <p className="text-[9px] text-muted-foreground mt-2">{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Details (Right) */}
              <div className="w-full lg:w-72 flex flex-col gap-4 overflow-y-auto shrink-0 pb-6 md:pb-0">
                <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Relationship</h3>
                  <div className="space-y-3">
                    <Select value={selectedLead.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="h-8 text-xs md:w-full dark:bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusLabels.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedLead.last_contacted && (
                      <div className="text-xs text-gray-400 flex items-center gap-1.5 bg-accent/20 dark:bg-accent/10 p-2 rounded-lg">
                        <Clock size={12} /> Last contacted: {new Date(selectedLead.last_contacted).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Info</h3>
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground"><Phone size={14} /></div>
                      <span className="truncate">{selectedLead.telephone || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground"><Mail size={14} /></div>
                      <span className="truncate">{selectedLead.main_contact_email || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground"><Globe size={14} /></div>
                      {selectedLead.website ? <a href={selectedLead.website} target="_blank" className="text-primary hover:underline truncate">Website</a> : <span>N/A</span>}
                    </div>
                    <div className="flex items-start gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground shrink-0"><MapPin size={14} /></div>
                      <span className="leading-tight">{selectedLead.address_number} {selectedLead.address}<br />{selectedLead.city}, {selectedLead.state} {selectedLead.zip}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-card border rounded-xl p-4 shadow-sm mb-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Tasks</h3>
                  <div className="space-y-2">
                    {followUps.filter(f => f.status === 'pending').length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">None.</p>
                    ) : (
                      followUps.filter(f => f.status === 'pending').map(f => (
                        <div key={f._id} className="p-2 border rounded-lg bg-accent/5 dark:bg-accent/5 group">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-primary">{f.follow_up_date}</span>
                            <button onClick={() => markFollowupDone(f._id)} className="text-[8px] text-muted-foreground hover:text-success opacity-0 group-hover:opacity-100 transition-all">Done</button>
                          </div>
                          <p className="text-[10px] text-foreground/80 mt-1 line-clamp-1">{f.reason}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Dialog open={isCreateCampaignOpen} onOpenChange={setIsCreateCampaignOpen}>
        <DialogContent className="sm:max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">New Campaign</DialogTitle></DialogHeader>
          <div className="py-2">
            <input
              placeholder="e.g. Summer Outreach"
              className="input-field"
              value={newCampaignName}
              onChange={e => setNewCampaignName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsCreateCampaignOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={createCampaign}>Create</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFollowUpModalOpen} onOpenChange={setIsFollowUpModalOpen}>
        <DialogContent className="sm:max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Schedule Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Date</label>
              <input type="date" className="input-field dark:color-scheme-dark" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Task Details</label>
              <textarea placeholder="Reason for follow-up" className="input-field min-h-[80px]" value={followUpReason} onChange={e => setFollowUpReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsFollowUpModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={submitFollowUp}>Schedule</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateLeadOpen} onOpenChange={setIsCreateLeadOpen}>
        <DialogContent className="sm:max-w-2xl dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Add Lead to {selectedCampaign?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 overflow-y-auto max-h-[70vh] p-1">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-medium">Name / Organization *</label>
              <input
                className="input-field"
                placeholder="Name"
                value={leadFormData.name}
                onChange={e => setLeadFormData({ ...leadFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Type</label>
              <input
                className="input-field"
                placeholder="Public/Private"
                value={leadFormData.type}
                onChange={e => setLeadFormData({ ...leadFormData, type: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Category / Group</label>
              <input
                className="input-field"
                placeholder="Category"
                value={leadFormData.category_group}
                onChange={e => setLeadFormData({ ...leadFormData, category_group: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Main Contact Name</label>
              <input
                className="input-field"
                placeholder="John Doe"
                value={leadFormData.main_contact_name}
                onChange={e => setLeadFormData({ ...leadFormData, main_contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Main Contact Email</label>
              <input
                className="input-field"
                placeholder="email@example.com"
                value={leadFormData.main_contact_email}
                onChange={e => setLeadFormData({ ...leadFormData, main_contact_email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Phone Number</label>
              <input
                className="input-field"
                placeholder="(555) 000-0000"
                value={leadFormData.telephone}
                onChange={e => setLeadFormData({ ...leadFormData, telephone: e.target.value })}
              />
            </div>
            <div className="col-span-2 grid grid-cols-4 gap-2">
              <div className="col-span-1 space-y-1">
                <label className="text-xs font-medium">Number</label>
                <input
                  className="input-field"
                  placeholder="123"
                  value={leadFormData.address_number}
                  onChange={e => setLeadFormData({ ...leadFormData, address_number: e.target.value })}
                />
              </div>
              <div className="col-span-3 space-y-1">
                <label className="text-xs font-medium">Address</label>
                <input
                  className="input-field"
                  placeholder="Street"
                  value={leadFormData.address}
                  onChange={e => setLeadFormData({ ...leadFormData, address: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">City</label>
              <input
                className="input-field"
                placeholder="City"
                value={leadFormData.city}
                onChange={e => setLeadFormData({ ...leadFormData, city: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">State</label>
              <input
                className="input-field"
                placeholder="ST"
                value={leadFormData.state}
                onChange={e => setLeadFormData({ ...leadFormData, state: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Zip</label>
              <input
                className="input-field"
                placeholder="12345"
                value={leadFormData.zip}
                onChange={e => setLeadFormData({ ...leadFormData, zip: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Website</label>
              <input
                className="input-field"
                placeholder="https://example.com"
                value={leadFormData.website}
                onChange={e => setLeadFormData({ ...leadFormData, website: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsCreateLeadOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!leadFormData.name.trim()} onClick={createLead}>Create Lead</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={isImportOpen} onOpenChange={(open) => {
        setIsImportOpen(open);
        if (!open) {
          setImportFile(null);
          setImportStatus("idle");
          setImportResult(null);
        }
      }}>
        <DialogContent className="sm:max-w-md dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Import Leads to {selectedCampaign?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {importStatus === "success" ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
                  <ArrowRight size={24} />
                </div>
                <div>
                  <p className="font-bold">Import Successful!</p>
                  <p className="text-xs text-muted-foreground mt-1">Processed {importResult?.totalRows} rows</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="p-4 bg-background rounded-xl border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Leads</p>
                    <p className="text-2xl font-bold">{importResult?.imported}</p>
                  </div>
                  <div className="p-2 bg-accent/5 rounded-lg">
                    <p className="text-lg font-bold text-warning">{importResult?.duplicates}</p>
                    <p className="text-[8px] uppercase font-bold text-muted-foreground">Skipped</p>
                  </div>
                  <div className="p-2 bg-accent/5 rounded-lg">
                    <p className="text-lg font-bold text-destructive">{importResult?.skipped}</p>
                    <p className="text-[8px] uppercase font-bold text-muted-foreground">Errors</p>
                  </div>
                </div>
                {importResult?.errors?.length > 0 && (
                  <div className="text-left text-[10px] bg-destructive/5 p-2 rounded max-h-[100px] overflow-y-auto">
                    {importResult.errors.map((e: any, i: number) => (
                      <p key={i} className="text-destructive font-medium">Row {e.row}: {e.reason}</p>
                    ))}
                  </div>
                )}
                <button className="btn-primary w-full" onClick={() => setIsImportOpen(false)}>Done</button>
              </div>
            ) : (
              <>
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${importFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  onClick={() => document.getElementById('import-input')?.click()}
                >
                  <input 
                    id="import-input"
                    type="file" 
                    className="hidden" 
                    accept=".xlsx,.csv" 
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="text-muted-foreground" size={24} />
                  </div>
                  {importFile ? (
                    <div>
                      <p className="text-sm font-bold truncate px-4">{importFile.name}</p>
                      <button className="text-[10px] text-destructive font-bold uppercase mt-2" onClick={(e) => { e.stopPropagation(); setImportFile(null); }}>Remove</button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold">Click to upload spreadsheet</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports .xlsx and .csv</p>
                    </div>
                  )}
                </div>
                <div className="bg-accent/5 p-3 rounded-lg border">
                  <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Supported Columns</h4>
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    Name/Organization, Type, Category/Group, Main Contact Name, Main Contact Email, Telephone, Start Time, End Time, Number, Address, City, Zip, Website, Contacted Status, Notes
                  </p>
                </div>
                <DialogFooter>
                  <button className="btn-secondary" onClick={() => setIsImportOpen(false)}>Cancel</button>
                  <button 
                    className="btn-primary" 
                    disabled={!importFile || importStatus === "uploading"}
                    onClick={handleImport}
                  >
                    {importStatus === "uploading" ? (
                      <><RefreshCw size={14} className="animate-spin mr-2" /> Working...</>
                    ) : "Start Import"}
                  </button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
};

export default Campaigns;
