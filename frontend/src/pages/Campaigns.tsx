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
  ChevronDown,
  ChevronUp,
  Folder,
  Users,
  Building,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  ArrowRight,
  Trash2,
  Video,
  Play,
  Save,
  MessageSquare
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCampaignStore } from "../store/campaignStore";
import { useLeadStore, Lead } from "../store/schoolStore";
import { toast } from "sonner";
import { countryCodes } from "../utils/countryCodes";
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

interface Note {
  _id: string;
  content: string;
  type: 'note' | 'status_change' | 'email' | 'meeting' | 'call';
  metadata?: any;
  createdAt: string;
}

interface FollowUp {
  _id: string;
  date_time: string;
  notes: string;
  type: string;
  priority: string;
  status: string;
}


const Campaigns = () => {
  const navigate = useNavigate();
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
  const [campaignSearchIndex, setCampaignSearchIndex] = useState(-1);
  const [leadSearchIndex, setLeadSearchIndex] = useState(-1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusLabels, setStatusLabels] = useState<string[]>([]);
  const [noteContent, setNoteContent] = useState("");

  useEffect(() => {
    setCampaignSearchIndex(-1);
  }, [campaignSearch]);

  useEffect(() => {
    setLeadSearchIndex(-1);
  }, [leadSearch, statusFilter]);

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
    website: "",
    // Primary Contact Person
    contact_title: "",
    contact_department: "",
    contact_direct_phone: "",
    contact_extension: "",
    contact_email: "",
    contact_best_time: "",
    contact_preferred_method: "",
    // Secondary Contact
    secondary_contact_name: "",
    secondary_contact_title: "",
    secondary_contact_phone: "",
    secondary_contact_extension: "",
    secondary_contact_email: "",
    // Prefixes
    contact_phone_prefix: "+1",
    secondary_phone_prefix: "+1",
    telephone_prefix: "+1",
  });
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callOutcome, setCallOutcome] = useState("Answered - Interested");
  const [callNotes, setCallNotes] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [selectedContactForCall, setSelectedContactForCall] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSecondary, setShowSecondary] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [secondaryCustomTitle, setSecondaryCustomTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("self");
  const [customAssignedTo, setCustomAssignedTo] = useState("");
  const [fuErrors, setFuErrors] = useState<Record<string, string>>({});
  const [campaignError, setCampaignError] = useState("");

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [importResult, setImportResult] = useState<any>(null);

  // Follow-up Modal
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpType, setFollowUpType] = useState("Task");
  const [followUpPriority, setFollowUpPriority] = useState("Medium");
  const [followUpNotes, setFollowUpNotes] = useState("");

  // Confirmation Modals
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const [isConfirmDoneOpen, setIsConfirmDoneOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<string | null>(null);

  // --- Data Fetching ---

  const [searchParams] = useSearchParams();
  const urlCampaignId = searchParams.get("campaignId");

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const r = await api.get("/campaigns");
      setCampaigns(r.data);
      
      // Auto-select from URL if present
      if (urlCampaignId) {
        const found = r.data.find((c: Campaign) => c._id === urlCampaignId);
        if (found) setSelectedCampaign(found);
      }
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

  const fetchDetails = useCallback(async (leadId: string, silent = false) => {
    if (!silent) setLoadingDetails(true);
    try {
      const [notesRes, followUpsRes, leadRes] = await Promise.all([
        api.get(`/notes/${leadId}`),
        api.get(`/followups/lead/${leadId}`),
        api.get(`/leads/${leadId}`)
      ]);
      setNotes(notesRes.data);
      setFollowUps(followUpsRes.data);
      // Update the selected lead with the one that has contacts
      setSelectedLead(leadRes.data);
    } catch { }
    if (!silent) setLoadingDetails(false);
  }, [setSelectedLead]);

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
      
      // Auto-poll for new notes/recordings every 10 seconds
      const pollInterval = setInterval(() => {
        fetchDetails(selectedLead._id, true); // true for silent load
      }, 10000);
      
      return () => clearInterval(pollInterval);
    }
  }, [selectedLead?._id, fetchDetails]);

  // --- Handlers ---

  const createCampaign = async () => {
    const trimmedName = newCampaignName.trim();
    if (!trimmedName) {
      setCampaignError("Campaign name is required");
      return;
    }

    if (campaigns.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setCampaignError("A campaign with this name already exists");
      return;
    }

    try {
      const res = await api.post("/campaigns", { name: trimmedName });
      toast.success("Campaign created");
      setNewCampaignName("");
      setCampaignError("");
      setIsCreateCampaignOpen(false);
      await fetchCampaigns();
      setSelectedCampaign(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create campaign");
    }
  };

  const validateLeadForm = () => {
    const newErrors: Record<string, string> = {};
    if (!leadFormData.name.trim()) newErrors.name = "Organization / School name is required";
    
    // Primary Contact Person Validation
    if (!leadFormData.main_contact_name.trim()) newErrors.main_contact_name = "Primary contact name is required";
    if (!leadFormData.contact_title) {
        newErrors.contact_title = "Please select a title / role";
    } else if (leadFormData.contact_title === "Other" && !customTitle.trim()) {
        newErrors.contact_title = "Please specify the custom title";
    }
    if (!leadFormData.contact_department.trim()) newErrors.contact_department = "Department name is required";
    if (!leadFormData.contact_direct_phone.trim()) newErrors.contact_direct_phone = "Direct phone number is required";
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!leadFormData.contact_email.trim()) {
        newErrors.contact_email = "Primary contact email is required";
    } else if (!emailRegex.test(leadFormData.contact_email)) {
        newErrors.contact_email = "Please enter a valid email address";
    }

    if (!leadFormData.contact_best_time) newErrors.contact_best_time = "Please select the best time to call";
    if (!leadFormData.contact_preferred_method) newErrors.contact_preferred_method = "Please select a preferred contact method";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRadioChange = (field: string, value: string) => {
    setLeadFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleLeadFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLeadFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const createLead = async () => {
    if (!selectedCampaign) return;
    if (!validateLeadForm()) {
        toast.error("Please fill in all required fields marked with *");
        return;
    }

    try {
      const finalTitle = leadFormData.contact_title === "Other" ? customTitle.trim() : leadFormData.contact_title;
      const finalSecondaryTitle = leadFormData.secondary_contact_title === "Other" ? secondaryCustomTitle.trim() : leadFormData.secondary_contact_title;

      const payload = {
        ...leadFormData,
        campaign_id: selectedCampaign._id,
        contact_direct_phone: leadFormData.contact_phone_prefix + leadFormData.contact_direct_phone.replace(/\D/g, ''),
        secondary_contact_phone: leadFormData.secondary_contact_phone ? (leadFormData.secondary_phone_prefix + leadFormData.secondary_contact_phone.replace(/\D/g, '')) : "",
        telephone: leadFormData.telephone ? (leadFormData.telephone_prefix + leadFormData.telephone.replace(/\D/g, '')) : "",
        contact_title: finalTitle,
        secondary_contact_title: finalSecondaryTitle
      };

      const res = await api.post("/leads", payload);
      toast.success("Lead created");
      setIsCreateLeadOpen(false);
      setLeadFormData({
        name: "", type: "", category_group: "", main_contact_name: "", main_contact_email: "",
        telephone: "", city: "", state: "", address: "", address_number: "", zip: "", website: "",
        contact_title: "", contact_department: "", contact_direct_phone: "", contact_extension: "",
        contact_email: "", contact_best_time: "", contact_preferred_method: "",
        secondary_contact_name: "", secondary_contact_title: "", secondary_contact_phone: "",
        secondary_contact_extension: "", secondary_contact_email: "",
        contact_phone_prefix: "+1", secondary_phone_prefix: "+1", telephone_prefix: "+1"
      });
      setErrors({});
      setCustomTitle("");
      setSecondaryCustomTitle("");
      setShowSecondary(false);
      await fetchLeads(selectedCampaign._id);
      setSelectedLead(res.data);
    } catch (err: any) {
        toast.error(err.response?.data?.error || "Failed to create lead");
    }
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

  const deleteNote = async (id: string) => {
    try {
      await api.delete(`/notes/${id}`);
      toast.success("Note deleted");
      if (selectedLead) {
        const r = await api.get(`/notes/${selectedLead._id}`);
        setNotes(r.data);
      }
    } catch { }
  };

  const deleteAllNotes = async () => {
    if (!selectedLead) return;
    try {
      await api.delete(`/notes/lead/${selectedLead._id}`);
      toast.success("All notes deleted");
      setNotes([]);
      setIsDeleteAllConfirmOpen(false);
    } catch { }
  };

  const submitFollowUp = async (force = false) => {
    const newErrors: Record<string, string> = {};
    const now = new Date();
    
    if (!followUpDate) {
        newErrors.date = "Date & Time is required";
    } else if (new Date(followUpDate) < now) {
        newErrors.date = "Date & Time cannot be in the past";
    }

    if (!followUpNotes.trim()) {
        newErrors.notes = "Please provide a reason or notes for the follow-up";
    }

    if (assignedTo === "other" && !customAssignedTo.trim()) {
        newErrors.assignedTo = "Please specify who this is assigned to";
    }

    if (Object.keys(newErrors).length > 0) {
        setFuErrors(newErrors);
        toast.error("Please fix the errors before scheduling");
        return;
    }

    if (!selectedLead) return;

    try {
      await api.post(`/followups/${selectedLead._id}`, {
        date_time: followUpDate,
        type: followUpType,
        priority: followUpPriority,
        notes: followUpNotes,
        assigned_user: assignedTo === "self" ? "self" : customAssignedTo,
        force
      });
      toast.success("Follow-up scheduled");
      setIsFollowUpModalOpen(false);
      setFollowUpDate("");
      setFollowUpNotes("");
      setFollowUpType("Task");
      setFollowUpPriority("Medium");
      setFuErrors({});

      const r = await api.get(`/followups/lead/${selectedLead._id}`);
      setFollowUps(r.data);
    } catch (err: any) {
      if (err.response?.status === 409) {
          if (window.confirm("Conflict detected: Another follow-up is scheduled at this time. Schedule anyway?")) {
              submitFollowUp(true);
          }
      } else {
          toast.error(err.response?.data?.message || "Failed to schedule follow-up");
      }
    }
  };

  const markFollowupDone = async (fuId: string) => {
    setTaskToComplete(fuId);
    setIsConfirmDoneOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!taskToComplete || !selectedLead) return;
    try {
      await api.put(`/followups/${taskToComplete}/complete`);
      toast.success("Follow-up completed");
      setIsConfirmDoneOpen(false);
      setTaskToComplete(null);

      const [fuRes, leadRes] = await Promise.all([
        api.get(`/followups/lead/${selectedLead._id}`),
        api.get(`/leads/${selectedLead._id}`)
      ]);
      setFollowUps(fuRes.data);
      setSelectedLead(leadRes.data);
      setLeads(prev => prev.map(s => s._id === leadRes.data._id ? leadRes.data : s));
    } catch { }
  };

  const handleOpenFollowUpModal = () => {
    setFollowUpDate("");
    setFollowUpNotes("");
    setFollowUpType("Call");
    setFollowUpPriority("Medium");
    setAssignedTo("self");
    setCustomAssignedTo("");
    setFuErrors({});
    setIsFollowUpModalOpen(true);
  };

  const initiateCall = (lead: any, contact?: any) => {
    setSelectedContactForCall(contact || null);
    const phone = contact?.direct_phone || lead.telephone;
    if (phone) {
      const cleanPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
      window.open(`https://app.justcall.io/dialer?numbers=${encodeURIComponent(cleanPhone)}&ticket_id=${lead._id}&custom_field=${lead._id}&notes=${encodeURIComponent('CRM Lead ID: ' + lead._id)}`, "JustCallDialer", "fullscreen=yes,location=no,width=385,height=665");
    }
    setCallOutcome("Answered - Interested");
    setIsCallModalOpen(true);
    toast.info(`Calling ${contact?.name || lead.name}...`);
  };

  const logCall = async () => {
    if (!selectedLead) return;
    try {
      const res = await api.post(`/justcall/log-call`, { 
        lead_id: selectedLead._id,
        outcome: callOutcome,
        notes: callNotes,
        duration: callDuration,
        contact_name: selectedContactForCall?.name || selectedLead.name || 'Unknown'
      });
      toast.success("Call logged");
      setIsCallModalOpen(false);
      setCallNotes("");
      setCallDuration("");
      
      // Refresh details
      const [notesRes, leadRes, fuRes] = await Promise.all([
        api.get(`/notes/${selectedLead._id}`),
        api.get(`/leads/${selectedLead._id}`),
        api.get(`/followups/lead/${selectedLead._id}`)
      ]);
      setNotes(notesRes.data);
      setSelectedLead(leadRes.data);
      setFollowUps(fuRes.data);
      setLeads(prev => prev.map(s => s._id === leadRes.data._id ? leadRes.data : s));
      
      if (res.data.followup_needed) {
        handleOpenFollowUpModal();
      }
    } catch { 
      toast.error("Failed to log call");
    }
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
      <div className="h-auto xl:h-[calc(100vh-100px)] flex flex-col xl:flex-row gap-4 overflow-y-auto xl:overflow-hidden p-1">

        {/* --- PANEL 1: Campaigns --- */}
        <div className="w-full xl:w-60 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden shrink-0">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Campaigns</h2>
              <button
                onClick={() => setIsCreateCampaignOpen(true)}
                className="p-1 hover:bg-accent rounded text-primary transition-colors"
                title="Create New Campaign"
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
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCampaignSearchIndex(prev => Math.min(prev + 1, filteredCampaigns.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCampaignSearchIndex(prev => Math.max(prev - 1, -1));
                  } else if (e.key === 'Enter' && campaignSearchIndex >= 0) {
                    setSelectedCampaign(filteredCampaigns[campaignSearchIndex]);
                  }
                }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingCampaigns ? (
              <div className="p-4 text-center text-[10px] text-muted-foreground animate-pulse">Loading...</div>
            ) : filteredCampaigns.map((c, index) => (
              <button
                key={c._id}
                onClick={() => setSelectedCampaign(c)}
                className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all mb-1 ${selectedCampaign?._id === c._id ? "bg-primary text-primary-foreground shadow-md" : index === campaignSearchIndex ? "bg-accent border-l-4 border-l-primary" : "hover:bg-accent text-foreground"}`}
              >
                <Folder size={16} className={selectedCampaign?._id === c._id ? "text-primary-foreground" : "text-primary"} />
                <span className="text-xs font-medium truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --- PANEL 2: Leads --- */}
        <div className="w-full xl:w-72 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden shrink-0">
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
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setLeadSearchIndex(prev => Math.min(prev + 1, filteredLeads.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setLeadSearchIndex(prev => Math.max(prev - 1, -1));
                      } else if (e.key === 'Enter' && leadSearchIndex >= 0) {
                        setSelectedLead(filteredLeads[leadSearchIndex]);
                      }
                    }}
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
              <div className="flex-1 overflow-y-auto divide-y divide-border/50 max-h-[300px] xl:max-h-none">
                {loadingLeads ? (
                  <div className="p-8 text-center text-[10px] text-muted-foreground animate-pulse">Loading leads...</div>
                ) : filteredLeads.length === 0 ? (
                  <div className="p-8 text-center text-[10px] text-muted-foreground">No leads found.</div>
                ) : (
                  filteredLeads.map((s, index) => (
                    <button
                      key={s._id}
                      onClick={() => setSelectedLead(s)}
                      className={`w-full text-left p-3.5 hover:bg-gray-50 dark:hover:bg-accent/20 cursor-pointer transition-all duration-200 border-l-2 ${selectedLead?._id === s._id ? "bg-accent border-primary" : index === leadSearchIndex ? "bg-accent/50 border-l-4 border-l-primary" : "border-transparent"}`}
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
        <div className="flex-1 flex flex-col min-w-0 min-h-[600px] xl:min-h-0">
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
              <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-[500px] xl:min-h-0">
                <div className="bg-card border rounded-xl p-4 shadow-sm shrink-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-foreground leading-tight truncate">{selectedLead.name}</h1>
                        <button
                          onClick={() => navigate(`/lead/${selectedLead._id}`)}
                          className="p-1.5 hover:bg-accent rounded-lg text-primary transition-all shrink-0"
                          title="View Full Profile"
                        >
                          <ExternalLink size={18} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Info size={12} /> {selectedLead.type || "Lead"}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} /> {selectedLead.city}</span>
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => initiateCall(selectedLead)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                          >
                            <Phone size={12} /> Call Now
                          </button>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsFollowUpModalOpen(true)} 
                      className="p-1 hover:bg-accent rounded text-primary transition-colors"
                      title="Schedule Follow-up"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
                  <div className="p-3 border-b bg-accent/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-primary" />
                      <h2 className="font-bold text-xs uppercase tracking-wider">Activity Feed</h2>
                    </div>
                    {notes.length > 0 && (
                      <button 
                        onClick={() => setIsDeleteAllConfirmOpen(true)}
                        className="text-[10px] text-destructive font-bold uppercase hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete All
                      </button>
                    )}
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
                        <button onClick={() => addNote()} disabled={!noteContent.trim()} className="btn-primary px-3 text-[10px] disabled:opacity-50">Post Note</button>
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
                             <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-card flex items-center justify-center">
                               {n.type === 'email' ? <Mail size={6} className="text-white" /> :
                                n.type === 'meeting' ? <Video size={6} className="text-white" /> :
                                n.type === 'call' ? <Phone size={6} className="text-white" /> :
                                null}
                            </div>
                            <div className="bg-white dark:bg-card shadow-sm border rounded-lg p-2.5 group relative">
                              <button 
                                onClick={() => deleteNote(n._id)}
                                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                              <p className="text-xs text-foreground leading-relaxed pr-6">{n.content}</p>
                              {n.type === 'email' && n.metadata?.subject && (
                                <p className="text-[10px] text-muted-foreground mt-1 italic">Subject: {n.metadata.subject}</p>
                              )}
                              {n.type === 'call' && n.metadata?.recording_url && (
                                <div className="mt-3 p-2.5 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3 group/audio max-w-sm">
                                  <button 
                                    onClick={(e) => {
                                      const audio = e.currentTarget.nextElementSibling as HTMLAudioElement;
                                      if (audio.paused) {
                                        audio.play();
                                        e.currentTarget.classList.add('bg-primary', 'text-white');
                                      } else {
                                        audio.pause();
                                        e.currentTarget.classList.remove('bg-primary', 'text-white');
                                      }
                                    }}
                                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-card border shadow-sm text-primary hover:scale-105 transition-all"
                                  >
                                    <Play size={14} className="ml-0.5 group-data-[playing=true]:hidden" />
                                  </button>
                                  <audio 
                                    src={n.metadata.recording_url} 
                                    onPlay={(e) => e.currentTarget.previousElementSibling?.setAttribute('data-playing', 'true')}
                                    onPause={(e) => e.currentTarget.previousElementSibling?.setAttribute('data-playing', 'false')}
                                    onEnded={(e) => e.currentTarget.previousElementSibling?.setAttribute('data-playing', 'false')}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-tight text-primary/70">Call Recording</p>
                                    <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                                      {n.metadata.duration ? (
                                        <span className="flex items-center gap-1"><Clock size={10} /> {Math.floor(n.metadata.duration / 60)}:{(n.metadata.duration % 60).toString().padStart(2, '0')}</span>
                                      ) : "Audio Recording"}
                                    </p>
                                  </div>
                                  <a 
                                    href={n.metadata.recording_url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                                    title="Open recording in new tab"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              )}
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
              <div className="w-full lg:w-64 xl:w-72 2xl:w-80 flex flex-col gap-4 overflow-y-auto shrink-0 pb-6 xl:pb-0">
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
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground"><Globe size={14} /></div>
                      {selectedLead.website ? <a href={selectedLead.website} target="_blank" className="text-primary hover:underline truncate">Website</a> : <span>N/A</span>}
                    </div>
                    <div className="flex items-start gap-3 text-xs">
                      <div className="p-1.5 bg-accent dark:bg-accent/10 rounded text-muted-foreground shrink-0"><MapPin size={14} /></div>
                      <span className="leading-tight">{selectedLead.address_number} {selectedLead.address}<br />{selectedLead.city}, {selectedLead.state} {selectedLead.zip}</span>
                    </div>
                  </div>
                </div>

                {/* Contacts Section */}
                <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Contacts</h3>
                  <div className="space-y-4">
                    {(!selectedLead.contacts || selectedLead.contacts.length === 0) ? (
                      <p className="text-[10px] text-muted-foreground italic">No contacts added.</p>
                    ) : (
                      selectedLead.contacts.map((contact: any) => (
                        <div key={contact._id} className={`p-3 rounded-lg border ${contact.is_primary ? 'border-primary/20 bg-primary/5' : 'border-border bg-accent/5'}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground truncate">{contact.name}</span>
                            {contact.is_primary ? (
                              <span className="text-[9px] uppercase font-black bg-primary text-white px-1.5 py-0.5 rounded-sm">Primary</span>
                            ) : (
                              <span className="text-[9px] uppercase font-black bg-orange-500/80 text-white px-1.5 py-0.5 rounded-sm">Secondary</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{contact.title || "No Title"} {contact.department ? `• ${contact.department}` : ''}</p>
                          
                          <div className="mt-2.5 space-y-1.5">
                            {contact.direct_phone && (
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <Phone size={12} strokeWidth={2.5} className="text-slate-600" />
                                  <span className="text-foreground font-medium">{contact.direct_phone}</span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    initiateCall(selectedLead, contact);
                                  }}
                                  className="p-1 hover:bg-orange-500 hover:text-white rounded transition-colors text-orange-500"
                                  title="Call Contact"
                                >
                                  <Phone size={10} />
                                </button>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2 text-xs">
                                <Mail size={12} strokeWidth={2.5} className="text-slate-600" />
                                <a href={`mailto:${contact.email}`} className="text-primary hover:underline truncate font-medium">{contact.email}</a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-card border rounded-xl p-4 shadow-sm mb-4">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Tasks</h3>
                  <div className="space-y-2">
                    {followUps.filter(f => f.status === 'pending').length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">None.</p>
                    ) : (
                      followUps.filter(f => f.status === 'pending').map(f => {
                        const getStatusStyles = (dateStr: string) => {
                          const d = new Date(dateStr);
                          const now = new Date();
                          const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                          const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          if (dDate < nowDate) return "border-l-destructive bg-destructive/5";
                          if (dDate.getTime() === nowDate.getTime()) return "border-l-warning bg-warning/5";
                          return "border-l-success bg-success/5";
                        };
                        return (
                          <div 
                            key={f._id} 
                            title={`${f.type}: ${f.notes || "No notes"}`}
                            className={`p-2 border rounded-lg border-l-4 transition-all group ${getStatusStyles(f.date_time)}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] uppercase tracking-widest font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">{f.type || 'Task'}</span>
                                <span className="text-[9px] font-bold text-foreground">{new Date(f.date_time).toLocaleString()}</span>
                              </div>
                              <button onClick={() => markFollowupDone(f._id)} className="text-[8px] text-muted-foreground hover:text-success opacity-0 group-hover:opacity-100 transition-all">Done</button>
                            </div>
                            <p className="text-[10px] text-foreground/80 mt-1 line-clamp-1">{f.notes || "No notes"}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Dialog open={isCreateCampaignOpen} onOpenChange={(open) => {
        setIsCreateCampaignOpen(open);
        if (!open) {
          setNewCampaignName("");
          setCampaignError("");
        }
      }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">New Campaign</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">Campaign Name *</label>
            <input
              placeholder="e.g. Summer Outreach"
              className={`input-field ${campaignError ? "border-destructive focus:ring-destructive/20" : ""}`}
              value={newCampaignName}
              onChange={e => {
                setNewCampaignName(e.target.value);
                if (campaignError) setCampaignError("");
              }}
              autoFocus
            />
            {campaignError && <p className="text-[10px] text-destructive font-medium">{campaignError}</p>}
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsCreateCampaignOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => createCampaign()}>Create</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFollowUpModalOpen} onOpenChange={(open) => {
        setIsFollowUpModalOpen(open);
        if (!open) setFuErrors({});
      }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Schedule Follow-up</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Date & Time *</label>
              <input 
                type="datetime-local" 
                className={`input-field dark:color-scheme-dark ${fuErrors.date ? "border-destructive focus:ring-destructive/20" : ""}`} 
                value={followUpDate} 
                onChange={e => {
                  setFollowUpDate(e.target.value);
                  if (fuErrors.date) setFuErrors(prev => ({ ...prev, date: "" }));
                }} 
              />
              {fuErrors.date && <p className="text-[10px] text-destructive font-medium">{fuErrors.date}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                <select className="input-field dark:bg-card" value={followUpType} onChange={e => setFollowUpType(e.target.value)}>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Task">Task</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Priority</label>
                <select className="input-field dark:bg-card" value={followUpPriority} onChange={e => setFollowUpPriority(e.target.value)}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Notes *</label>
              <textarea 
                placeholder="Reason for follow-up" 
                className={`input-field min-h-[80px] ${fuErrors.notes ? "border-destructive focus:ring-destructive/20" : ""}`} 
                value={followUpNotes} 
                onChange={e => {
                  setFollowUpNotes(e.target.value);
                  if (fuErrors.notes) setFuErrors(prev => ({ ...prev, notes: "" }));
                }} 
              />
              {fuErrors.notes && <p className="text-[10px] text-destructive font-medium">{fuErrors.notes}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Assigned User</label>
              <select 
                className="input-field dark:bg-card"
                value={assignedTo}
                onChange={e => {
                  setAssignedTo(e.target.value);
                  if (fuErrors.assignedTo) setFuErrors(prev => ({ ...prev, assignedTo: "" }));
                }}
              >
                <option value="self">Assign to Me</option>
                <option value="other">Other</option>
              </select>
              {assignedTo === "other" && (
                <div className="space-y-1">
                  <input
                    className={`input-field mt-2 ${fuErrors.assignedTo ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="Enter name..."
                    value={customAssignedTo}
                    onChange={(e) => {
                      setCustomAssignedTo(e.target.value);
                      if (fuErrors.assignedTo) setFuErrors(prev => ({ ...prev, assignedTo: "" }));
                    }}
                  />
                  {fuErrors.assignedTo && <p className="text-[10px] text-destructive font-medium">{fuErrors.assignedTo}</p>}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => { setIsFollowUpModalOpen(false); setFuErrors({}); }}>Cancel</button>
            <button className="btn-primary" onClick={() => submitFollowUp()}>Schedule</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateLeadOpen} onOpenChange={setIsCreateLeadOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-3xl dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">Add Lead to {selectedCampaign?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-6 py-2 overflow-y-auto max-h-[75vh] p-1 pr-3">
            
            {/* Primary Contact Person */}
            <div className="space-y-4 border-b pb-6">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Users size={16} className="text-primary" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Primary Contact Person</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Contact Full Name *</label>
                  <input
                    name="main_contact_name"
                    className={`input-field ${errors.main_contact_name ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="e.g. Davina Midgette"
                    value={leadFormData.main_contact_name}
                    onChange={handleLeadFormChange}
                  />
                  {errors.main_contact_name && <p className="text-[10px] text-destructive">{errors.main_contact_name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Title / Role *</label>
                  <select
                    name="contact_title"
                    className={`input-field ${errors.contact_title ? "border-destructive focus:ring-destructive/20" : ""}`}
                    value={leadFormData.contact_title}
                    onChange={handleLeadFormChange}
                  >
                    <option value="">Select title...</option>
                    <option>Principal</option>
                    <option>Assistant Principal</option>
                    <option>Athletic Director</option>
                    <option>After-School Coordinator</option>
                    <option>Front Office Administrator</option>
                    <option>PTA/PTO Contact</option>
                    <option>Other</option>
                  </select>
                  {errors.contact_title && <p className="text-[10px] text-destructive">{errors.contact_title}</p>}
                  {leadFormData.contact_title === "Other" && (
                    <input
                      className="input-field mt-2"
                      placeholder="Specify title..."
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Department *</label>
                  <input
                    name="contact_department"
                    className={`input-field ${errors.contact_department ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="e.g. Administration"
                    value={leadFormData.contact_department}
                    onChange={handleLeadFormChange}
                  />
                  {errors.contact_department && <p className="text-[10px] text-destructive">{errors.contact_department}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Direct Phone *</label>
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                        {leadFormData.contact_phone_prefix}
                      </div>
                      <select 
                        className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                        style={{ 
                          backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === leadFormData.contact_phone_prefix)?.code || 'US').toLowerCase()}.png)`,
                          backgroundPosition: 'left 0.5rem center'
                        }}
                        value={leadFormData.contact_phone_prefix}
                        onChange={(e) => setLeadFormData({...leadFormData, contact_phone_prefix: e.target.value})}
                      >
                        {countryCodes.map(c => (
                          <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                            {c.name} ({c.dialCode})
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <ChevronDown size={12} />
                      </div>
                    </div>
                    <input
                      name="contact_direct_phone"
                      className={`input-field flex-1 ${errors.contact_direct_phone ? "border-destructive focus:ring-destructive/20" : ""}`}
                      placeholder="Phone"
                      value={leadFormData.contact_direct_phone}
                      onChange={handleLeadFormChange}
                    />
                    <input
                      name="contact_extension"
                      className="input-field w-20"
                      placeholder="Ext."
                      value={leadFormData.contact_extension}
                      onChange={handleLeadFormChange}
                    />
                  </div>
                  {errors.contact_direct_phone && <p className="text-[10px] text-destructive">{errors.contact_direct_phone}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Email Address *</label>
                  <input
                    name="contact_email"
                    type="email"
                    className={`input-field ${errors.contact_email ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="email@example.com"
                    value={leadFormData.contact_email}
                    onChange={handleLeadFormChange}
                  />
                  {errors.contact_email && <p className="text-[10px] text-destructive">{errors.contact_email}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Best Time to Call *</label>
                  <select
                    name="contact_best_time"
                    className={`input-field ${errors.contact_best_time ? "border-destructive focus:ring-destructive/20" : ""}`}
                    value={leadFormData.contact_best_time}
                    onChange={handleLeadFormChange}
                  >
                    <option value="">Select time...</option>
                    <option>Morning (8am–11am)</option>
                    <option>Midday (11am–1pm)</option>
                    <option>Afternoon (1pm–4pm)</option>
                    <option>Late Afternoon (4pm–6pm)</option>
                    <option>Anytime</option>
                  </select>
                  {errors.contact_best_time && <p className="text-[10px] text-destructive">{errors.contact_best_time}</p>}
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-medium">Preferred Contact Method *</label>
                  <div className="flex gap-4">
                    {["Call", "Email", "Text"].map(method => (
                      <label key={method} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="radio"
                          name="contact_preferred_method"
                          value={method}
                          checked={leadFormData.contact_preferred_method === method}
                          onChange={() => handleRadioChange("contact_preferred_method", method)}
                        />
                        {method}
                      </label>
                    ))}
                  </div>
                  {errors.contact_preferred_method && <p className="text-[10px] text-destructive">{errors.contact_preferred_method}</p>}
                </div>
              </div>
            </div>

            {/* Secondary Contact */}
            <div className="space-y-4 border-b pb-6">
              <button
                type="button"
                onClick={() => setShowSecondary(!showSecondary)}
                className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSecondary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Add Secondary Contact (Optional)
              </button>
              
              {showSecondary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Secondary Name</label>
                    <input
                      name="secondary_contact_name"
                      className="input-field"
                      placeholder="Name"
                      value={leadFormData.secondary_contact_name}
                      onChange={handleLeadFormChange}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Secondary Title</label>
                    <select
                      name="secondary_contact_title"
                      className="input-field"
                      value={leadFormData.secondary_contact_title}
                      onChange={handleLeadFormChange}
                    >
                      <option value="">Select title...</option>
                      <option>Principal</option>
                      <option>Assistant Principal</option>
                      <option>Athletic Director</option>
                      <option>After-School Coordinator</option>
                      <option>Front Office Administrator</option>
                      <option>PTA/PTO Contact</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Secondary Phone</label>
                    <div className="flex gap-2">
                      <div className="relative w-28 shrink-0">
                        <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                          {leadFormData.secondary_phone_prefix}
                        </div>
                        <select 
                          className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                          style={{ 
                            backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === leadFormData.secondary_phone_prefix)?.code || 'US').toLowerCase()}.png)`,
                            backgroundPosition: 'left 0.5rem center'
                          }}
                          value={leadFormData.secondary_phone_prefix}
                          onChange={(e) => setLeadFormData({...leadFormData, secondary_phone_prefix: e.target.value})}
                        >
                          {countryCodes.map(c => (
                            <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                              {c.name} ({c.dialCode})
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                          <ChevronDown size={12} />
                        </div>
                      </div>
                      <input
                        name="secondary_contact_phone"
                        className="input-field flex-1"
                        placeholder="Phone"
                        value={leadFormData.secondary_contact_phone}
                        onChange={handleLeadFormChange}
                      />
                      <input
                        name="secondary_contact_extension"
                        className="input-field w-20"
                        placeholder="Ext."
                        value={leadFormData.secondary_contact_extension}
                        onChange={handleLeadFormChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Secondary Email</label>
                    <input
                      name="secondary_contact_email"
                      type="email"
                      className="input-field"
                      placeholder="email@example.com"
                      value={leadFormData.secondary_contact_email}
                      onChange={handleLeadFormChange}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Lead / Organization Details */}
            <div className="space-y-4 border-b pb-6">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Building size={16} className="text-primary" /> Organization Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium">Name / Organization *</label>
                  <input
                    name="name"
                    className={`input-field ${errors.name ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="Lead Name"
                    value={leadFormData.name}
                    onChange={handleLeadFormChange}
                  />
                  {errors.name && <p className="text-[10px] text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Type</label>
                  <select
                    name="type"
                    className="input-field"
                    value={leadFormData.type}
                    onChange={handleLeadFormChange}
                  >
                    <option value="">Select type...</option>
                    <option>Public</option>
                    <option>Private</option>
                    <option>Parent</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Category / Group</label>
                  <input
                    name="category_group"
                    className="input-field"
                    placeholder="Category"
                    value={leadFormData.category_group}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Main Phone</label>
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                        {leadFormData.telephone_prefix}
                      </div>
                      <select 
                        className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                        style={{ 
                          backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === leadFormData.telephone_prefix)?.code || 'US').toLowerCase()}.png)`,
                          backgroundPosition: 'left 0.5rem center'
                        }}
                        value={leadFormData.telephone_prefix}
                        onChange={(e) => setLeadFormData({...leadFormData, telephone_prefix: e.target.value})}
                      >
                        {countryCodes.map(c => (
                          <option key={`${c.code}-${c.dialCode}`} value={c.dialCode} className="text-foreground">
                            {c.name} ({c.dialCode})
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <ChevronDown size={12} />
                      </div>
                    </div>
                    <input
                      name="telephone"
                      className="input-field flex-1"
                      placeholder="Phone"
                      value={leadFormData.telephone}
                      onChange={handleLeadFormChange}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Website</label>
                  <input
                    name="website"
                    className="input-field"
                    placeholder="https://..."
                    value={leadFormData.website}
                    onChange={handleLeadFormChange}
                  />
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="space-y-4 pb-4">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <MapPin size={16} className="text-primary" /> Address Details
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-1">
                  <label className="text-xs font-medium">Number</label>
                  <input
                    name="address_number"
                    className="input-field"
                    placeholder="123"
                    value={leadFormData.address_number}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-xs font-medium">Street</label>
                  <input
                    name="address"
                    className="input-field"
                    placeholder="Street Address"
                    value={leadFormData.address}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium">City</label>
                  <input
                    name="city"
                    className="input-field"
                    placeholder="City"
                    value={leadFormData.city}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="text-xs font-medium">State</label>
                  <input
                    name="state"
                    className="input-field"
                    placeholder="ST"
                    value={leadFormData.state}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <label className="text-xs font-medium">Zip</label>
                  <input
                    name="zip"
                    className="input-field"
                    placeholder="Zip"
                    value={leadFormData.zip}
                    onChange={handleLeadFormChange}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => { setIsCreateLeadOpen(false); setErrors({}); }}>Cancel</button>
            <button className="btn-primary" onClick={() => createLead()}>Create Lead</button>
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
        <DialogContent aria-describedby={undefined} className="sm:max-w-md dark:bg-card">
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

      {/* Delete All Confirmation Dialog */}
      <Dialog open={isDeleteAllConfirmOpen} onOpenChange={setIsDeleteAllConfirmOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md dark:bg-card border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle size={20} />
              Confirm Bulk Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to <span className="font-bold text-foreground">delete all notes</span> for this lead? This action is permanent and cannot be reversed.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button className="btn-secondary" onClick={() => setIsDeleteAllConfirmOpen(false)}>No, Keep Them</button>
            <button className="bg-destructive text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-destructive/90 transition-colors shadow-sm" onClick={() => deleteAllNotes()}>Yes, Delete Everything</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Mark Done Confirmation Modal */}
      <Dialog open={isConfirmDoneOpen} onOpenChange={setIsConfirmDoneOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-center">Confirm Completion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">
              Are you sure you want to mark this follow-up task as completed?
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <button className="btn-secondary flex-1" onClick={() => setIsConfirmDoneOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1 bg-success hover:bg-success/90" onClick={handleConfirmDone}>Yes, Mark Done</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Outcome Modal */}
      <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Log Call Outcome</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Calling: {selectedLead?.name || "Unknown"}</p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Outcome</label>
              <select className="input-field dark:bg-card" value={callOutcome} onChange={e => setCallOutcome(e.target.value)}>
                <option>Answered - Interested</option>
                <option>Answered - Not Interested</option>
                <option>Answered - Follow-Up Needed</option>
                <option>Left Voicemail</option>
                <option>No Answer</option>
                <option>Wrong Number</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Duration (optional)</label>
              <input 
                className="input-field dark:bg-card" 
                placeholder="e.g. 5 mins" 
                value={callDuration} 
                onChange={e => setCallDuration(e.target.value)} 
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Call Notes</label>
              <textarea className="input-field min-h-[100px]" placeholder="Briefly summarize the conversation..." value={callNotes} onChange={e => setCallNotes(e.target.value)} />
            </div>
            <div className="mt-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
              <p className="text-[10px] font-medium text-center">
                <span className="font-bold uppercase mr-1">Important:</span>
                Ensure you click <strong>'Save'</strong> in the JustCall dialer and <strong>'Log & Close'</strong> here to sync activity.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setIsCallModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => logCall()}>Log & Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Campaigns;
