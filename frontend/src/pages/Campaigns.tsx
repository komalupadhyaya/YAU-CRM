import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
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
  Download,
  RefreshCw,
  ArrowRight,
  Trash2,
  Video,
  Play,
  Pause,
  Save,
  MessageSquare,
  Send,
  X,
  CalendarPlus,
  Zap,
  FileText,
  CheckCircle2,
  Edit
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";

const formatNoteContent = (content: string) => {
  if (!content) return "";
  return content.split('\n').filter(line => !line.trim().startsWith('Contact:')).join('\n');
};

const RecordingPlayer = ({ url, duration }: { url?: string, duration?: number }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  if (!url) return null;

  const togglePlay = () => {
    if (audioRef.current?.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time) || time === Infinity) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const safeDuration = totalDuration === Infinity || isNaN(totalDuration) ? 0 : totalDuration;
  const progressPercent = safeDuration ? (currentTime / safeDuration) * 100 : 0;

  return (
    <div className="mt-3 p-3 bg-accent/30 dark:bg-accent/10 rounded-2xl border border-primary/20 flex flex-col gap-3 group/audio max-w-full shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-primary text-white shadow-lg hover:scale-105 transition-all shrink-0"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-0.5">Call Recording</p>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground">{formatTime(currentTime)}</span>
            <span className="text-[10px] font-medium text-muted-foreground">{formatTime(safeDuration)}</span>
          </div>
        </div>

        <a href={url} target="_blank" rel="noreferrer" className="p-2 text-muted-foreground hover:text-primary transition-colors bg-card rounded-lg border shadow-sm">
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-primary transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />
        <input
            id="input-range-3"
            name="input-range-3"
        
          type="range"
          min="0"
          max={safeDuration || 0}
          step="0.1"
          value={currentTime}
          onChange={(e) => {
            const time = parseFloat(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = time;
            setCurrentTime(time);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
        />
      </div>

      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && d !== Infinity && !isNaN(d)) {
            setTotalDuration(d);
          }
        }}
        onDurationChange={() => {
          const d = audioRef.current?.duration;
          if (d && d !== Infinity && !isNaN(d)) {
            setTotalDuration(d);
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
};

import { useCampaignStore, Campaign } from "../store/campaignStore";
import { useLeadStore, Lead, Contact } from "../store/schoolStore";
import { useDialerStore } from "../store/dialerStore";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { toESTDate } from "../utils/timezoneHelper";

// --- Helpers ---
const formatTimeForInput = (timeStr?: string) => {
  if (!timeStr) return "";
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (match) {
    const [_, hours, mins, ampm] = match;
    let h = parseInt(hours);
    if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
    if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${mins.padStart(2, '0')}`;
  }
  return timeStr;
};

// --- Types ---

interface CRMError {
  response?: {
    data?: {
      message?: string;
      error?: string;
      conflicts?: Array<{ summary: string; start: string }>;
    };
    status?: number;
  };
  message?: string;
}
interface Note {
  _id: string;
  content: string;
  type: 'note' | 'status_change' | 'email' | 'meeting' | 'call' | 'sms';
  metadata?: { subject?: string; recording_url?: string; recording_duration?: number; duration?: number; [key: string]: unknown; };
  createdAt: string;
}

interface FollowUp {
  _id: string;
  title?: string;
  date_time: string;
  notes: string;
  type: string;
  priority: string;
  status: string;
}


interface ImportResult {
  totalRows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: Array<{ row: number; reason: string }>;
}


const Campaigns = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const { selectedCampaign, setSelectedCampaign, campaigns, setCampaigns, statusLabels, setStatusLabels } = useCampaignStore();
  const { selectedLead, setSelectedLead } = useLeadStore();
  const openDialer = useDialerStore(state => state.openDialer);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'recordings' | 'sms' | 'notes' | 'meetings' | 'emails'>('all');

  const filteredNotes = notes.filter(n => {
    if (activityFilter === 'recordings') {
      return n.type === 'call' && !!n.metadata?.recording_url;
    }
    if (activityFilter === 'sms') {
      return n.type === 'sms';
    }
    if (activityFilter === 'notes') {
      return n.type === 'note';
    }
    if (activityFilter === 'meetings') {
      return n.type === 'meeting';
    }
    if (activityFilter === 'emails') {
      return n.type === 'email';
    }
    return true; // 'all'
  });

  const [loadingCampaigns, setLoadingCampaigns] = useState(campaigns.length === 0);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [campaignSearch, setCampaignSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [campaignSearchIndex, setCampaignSearchIndex] = useState(-1);
  const [leadSearchIndex, setLeadSearchIndex] = useState(-1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteContent, setNoteContent] = useState("");

  useEffect(() => {
    setCampaignSearchIndex(-1);
  }, [campaignSearch]);

  useEffect(() => {
    if (leadSearchIndex >= 0) {
      const el = document.getElementById(`lead-item-${leadSearchIndex}`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [leadSearchIndex]);

  useEffect(() => {
    setLeadSearchIndex(-1);
  }, [leadSearch, statusFilter]);

  // Create Campaign Modal
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [customLeadType, setCustomLeadType] = useState("");
  const [newCampaignName, setNewCampaignName] = useState("");

  // Create Lead Modal
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    name: "",
    type: "",
    category_group: "",
    department: "",
    main_contact_name: "",
    main_contact_email: "",
    telephone: "",
    telephone_extension: "",
    city: "",
    state: "",
    address: "",
    address_number: "",
    zip: "",
    website: "",
    start_time: "",
    end_time: "",
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
    secondary_contact_department: "",
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
  const [selectedContactForCall, setSelectedContactForCall] = useState<Contact | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSecondary, setShowSecondary] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [secondaryCustomTitle, setSecondaryCustomTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("self");
  const [customAssignedTo, setCustomAssignedTo] = useState("");
  const [fuErrors, setFuErrors] = useState<Record<string, string>>({});
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [createFollowUpInCall, setCreateFollowUpInCall] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [campaignError, setCampaignError] = useState("");
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Follow-up Modal
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpType, setFollowUpType] = useState("Task");
  const [followUpPriority, setFollowUpPriority] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("pending");
  const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);

  // Confirmation Modals
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false);
  const [isDeleteLeadConfirmOpen, setIsDeleteLeadConfirmOpen] = useState(false);
  const [isConfirmDoneOpen, setIsConfirmDoneOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<string | null>(null);
  const [followUpToDelete, setFollowUpToDelete] = useState<string | null>(null);

  // Email Modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailData, setEmailData] = useState({ subject: "Following up", body: "", cc: [] as string[], to: "" });
  const [ccInput, setCcInput] = useState("");
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [verifiedDomains, setVerifiedDomains] = useState<Record<string, { valid: boolean; message?: string }>>({});

  const checkDomain = async (email: string) => {
    const domain = email.split('@')[1];
    if (!domain || verifiedDomains[domain]) return;
    try {
      const res = await api.get(`/emails/verify-domain?email=${email}`);
      setVerifiedDomains(prev => ({ ...prev, [domain]: { valid: res.data.valid, message: res.data.message } }));
    } catch (error) { console.error(error); }
  };

  // SMS Modal
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");

  // Meeting Modal
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingData, setMeetingData] = useState({ title: "", date_time: "", type: "Virtual", notes: "" });
  const [meetingErrors, setMeetingErrors] = useState<Record<string, string>>({});
  const [meetingCc, setMeetingCc] = useState<string[]>([]);
  const [meetingCcInput, setMeetingCcInput] = useState("");

  const truncateName = (name: string, limit: number) => {
    if (!name) return "";
    return name.length > limit ? name.substring(0, limit) + "..." : name;
  };

  // --- Data Fetching ---

  const [searchParams] = useSearchParams();
  const urlCampaignId = searchParams.get("campaignId");

  const fetchCampaigns = async () => {
    // Campaigns are now fetched globally in AppLayout, but we can keep this for manual refresh if needed
    setLoadingCampaigns(true);
    try {
      const r = await api.get("/campaigns");
      setCampaigns(r.data);
    } catch (error) { console.error(error); }
    setLoadingCampaigns(false);
  };


  const fetchLeads = useCallback(async (compId: string, silent = false) => {
    if (!silent) setLoadingLeads(true);
    try {
      const r = await api.get(`/leads/campaign/${compId}`);

      // Use functional update to check if the campaign we fetched is still the selected one
      setLeads(prevLeads => {
        // If the leads returned don't belong to the campaign currently in context, ignore them
        // (Assuming if array is not empty, we check the first lead's campaign_id)
        if (r.data.length > 0 && r.data[0].campaign_id !== compId) return prevLeads;

        // Only update if data is actually different to prevent unnecessary re-renders
        return JSON.stringify(prevLeads) === JSON.stringify(r.data) ? prevLeads : r.data;
      });
    } catch (error) { console.error(error); }
    if (!silent) setLoadingLeads(false);
  }, []); // Removed selectedLead dependency

  useEffect(() => {
    if (campaigns.length > 0 && urlCampaignId && !selectedCampaign) {
      const found = campaigns.find(c => c._id === urlCampaignId);
      if (found) setSelectedCampaign(found);
    }
  }, [campaigns, urlCampaignId, selectedCampaign, setSelectedCampaign]);

  const fetchDetails = useCallback(async (leadId: string, silent = false) => {
    if (!silent) setLoadingDetails(true);
    try {
      const [notesRes, followUpsRes, leadRes] = await Promise.all([
        api.get(`/notes/${leadId}`),
        api.get(`/followups/lead/${leadId}`),
        api.get(`/leads/${leadId}`)
      ]);

      // Update states only if they changed to prevent re-render loops
      setNotes(prev => JSON.stringify(prev) === JSON.stringify(notesRes.data) ? prev : notesRes.data);
      setFollowUps(prev => JSON.stringify(prev) === JSON.stringify(followUpsRes.data) ? prev : followUpsRes.data);

      // Use functional update to avoid dependency on selectedLead and prevent race conditions
      setSelectedLead((prev) => {
        const newData = leadRes.data as Lead;

        // Also update the middle leads list so the status/last_contacted matches
        setLeads(prevLeads => prevLeads.map(l => l._id === newData._id ? newData : l));

        // RACE CONDITION FIX: 
        // If the current selection (prev) has changed to a DIFFERENT lead while this request was pending,
        // we MUST NOT update the state with this stale data.
        if (prev && prev._id !== newData._id) {
          return prev; // Keep the newer selection
        }

        // If it's the same lead, update it only if the data has actually changed
        if (!prev) return newData;
        const res = JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData;

        return res;
      });
    } catch (error) { console.error(error); }
    if (!silent) setLoadingDetails(false);
  }, [setSelectedLead, setLeads]);

  useEffect(() => {
    // If campaigns are already in store, we are not loading
    if (campaigns.length > 0) {
      setLoadingCampaigns(false);
    } else {
      // Otherwise fetch them
      fetchCampaigns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns.length]); // Re-run if campaigns length changes


  useEffect(() => {
    if (selectedCampaign) {
      fetchLeads(selectedCampaign._id);
    } else {
      setLeads([]);
      setSelectedLead(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign?._id, statusLabels]);


  useEffect(() => {
    if (selectedLead?._id && window.innerWidth < 1280) {
      const timer = setTimeout(() => {
        const detailSection = document.getElementById('lead-detail-section');
        if (detailSection) {
          detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedLead?._id]);

  useEffect(() => {
    if (selectedLead?._id) {
      // Fetch details when lead changes or global status settings change
      fetchDetails(selectedLead._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?._id, statusLabels]);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      api.get("/team")
        .then(res => setTeamMembers(res.data))
        .catch(err => console.error("Failed to fetch team members in Campaigns:", err));
    }
  }, [currentUser]);


  // --- Handlers ---

  const createCampaign = async () => {
    if (isSubmitting) return;
    const trimmedName = newCampaignName.trim();
    if (!trimmedName) {
      setCampaignError("Campaign name is required");
      return;
    }

    if (campaigns.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setCampaignError("A campaign with this name already exists");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post("/campaigns", { name: trimmedName });
      toast.success("Campaign created");
      setNewCampaignName("");
      setCampaignError("");
      setIsCreateCampaignOpen(false);
      await fetchCampaigns();
      setSelectedCampaign(res.data);
    } catch (err: unknown) {
      toast.error((err as CRMError).response?.data?.message || "Failed to create campaign");
    } finally {
      setIsSubmitting(false);
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
    if (!selectedCampaign || isSubmittingLead) return;
    if (!validateLeadForm()) {
      toast.error("Please fill in all required fields marked with *");
      return;
    }

    setIsSubmittingLead(true);
    try {
      const finalTitle = leadFormData.contact_title === "Other" ? customTitle.trim() : leadFormData.contact_title;
      const finalSecondaryTitle = leadFormData.secondary_contact_title === "Other" ? secondaryCustomTitle.trim() : leadFormData.secondary_contact_title;

      const payload = {
        ...leadFormData,
        type: leadFormData.type === "Other" ? customLeadType : leadFormData.type,
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
        name: "", type: "", category_group: "", department: "", main_contact_name: "", main_contact_email: "",
        telephone: "", telephone_extension: "", city: "", state: "", address: "", address_number: "", zip: "", website: "",
        start_time: "", end_time: "",
        contact_title: "", contact_department: "", contact_direct_phone: "", contact_extension: "",
        contact_email: "", contact_best_time: "", contact_preferred_method: "",
        secondary_contact_name: "", secondary_contact_title: "", secondary_contact_department: "",
        secondary_contact_phone: "", secondary_contact_extension: "", secondary_contact_email: "",
        contact_phone_prefix: "+1", secondary_phone_prefix: "+1", telephone_prefix: "+1"
      });
      setErrors({});
      setCustomTitle("");
      setSecondaryCustomTitle("");
      setShowSecondary(false);
      setIsSubmittingLead(false);
      await fetchLeads(selectedCampaign._id);
      setSelectedLead(res.data);
    } catch (err: unknown) {
      toast.error((err as CRMError).response?.data?.error || "Failed to create lead");
      setIsSubmittingLead(false);
    }
  };

  const handleExport = async () => {
    if (!selectedCampaign) return;
    try {
      const response = await api.get(`/leads/campaign/${selectedCampaign._id}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_${selectedCampaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Export successful");
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
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
      await api.patch(`/leads/${selectedLead._id}`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);

      // Update local leads list to reflect new status immediately
      setLeads(prev => prev.map(l => l._id === selectedLead._id ? { ...l, status: newStatus } : l));

      fetchDetails(selectedLead._id, true);
    } catch (error) { console.error(error); }
  };

  const addNote = async () => {
    if (!selectedLead || !noteContent.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.post(`/notes/${selectedLead._id}`, { content: noteContent });
      toast.success("Note added");
      setNoteContent("");
      fetchDetails(selectedLead._id, true);
    } catch (error) { console.error(error); } finally {
      setIsSubmitting(false);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await api.delete(`/notes/${id}`);
      toast.success("Note deleted");
      if (selectedLead) {
        fetchDetails(selectedLead._id, true);
      }
    } catch (error) { console.error(error); }
  };

  const deleteAllNotes = async () => {
    if (!selectedLead) return;
    try {
      await api.delete(`/notes/lead/${selectedLead._id}`);
      toast.success("All notes deleted");
      setIsDeleteAllConfirmOpen(false);
      fetchDetails(selectedLead._id, true);
    } catch (error) { console.error(error); }
  };

  const handleOpenEditFollowUpModal = (fu: any) => {
    setEditingFollowUp(fu);
    setFollowUpTitle(fu.title || "");
    setFollowUpDate(fu.date_time ? new Date(new Date(fu.date_time).getTime() - new Date(fu.date_time).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
    setFollowUpNotes(fu.notes || "");
    setFollowUpType(fu.type || "Call");
    let p = fu.priority;
    if (!p || p === "None") {
      p = "";
    } else {
      p = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }
    setFollowUpPriority(p);
    setFollowUpStatus(fu.status || "pending");
    if (!fu.assigned_user) {
      setAssignedTo("self");
      setCustomAssignedTo("");
    } else {
      setAssignedTo("other");
      setCustomAssignedTo(fu.assigned_user);
    }
    setFuErrors({});
    setIsFollowUpModalOpen(true);
  };

  const handleDeleteFollowUp = (fuId: string) => {
    setFollowUpToDelete(fuId);
  };

  const confirmDeleteFollowUp = async () => {
    if (!followUpToDelete) return;
    try {
      await api.delete(`/followups/${followUpToDelete}`);
      toast.success("Follow-up deleted");
      if (selectedLead) {
        fetchDetails(selectedLead._id, true);
      }
    } catch (err) {
      toast.error("Failed to delete follow-up");
    } finally {
      setFollowUpToDelete(null);
    }
  };

  const handleDeleteLeadConfirm = async () => {
    if (!selectedLead) return;
    try {
      await api.delete("/leads/" + selectedLead._id);
      toast.success("Lead deleted successfully");
      setSelectedLead(null);
      if (selectedCampaign) {
        fetchLeads(selectedCampaign._id);
      }
    } catch (err) {
      toast.error("Failed to delete lead");
    } finally {
      setIsDeleteLeadConfirmOpen(false);
    }
  };

  const submitFollowUp = async (force = false) => {
    if (isSubmitting) return;
    const newErrors: Record<string, string> = {};
    const now = new Date();

    if (!followUpDate) {
      newErrors.date = "Date & Time is required";
    } else if (!editingFollowUp && new Date(followUpDate) < now) {
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

    setIsSubmitting(true);
    try {
      const payload = {
        title: followUpTitle.trim(),
        date_time: new Date(followUpDate).toISOString(),
        type: followUpType,
        priority: followUpPriority,
        notes: followUpNotes,
        assigned_user: assignedTo === "self" ? null : customAssignedTo,
        status: followUpStatus,
        force
      };

      if (editingFollowUp) {
        await api.put(`/followups/${editingFollowUp._id}`, payload);
        toast.success("Follow-up updated");
      } else {
        await api.post(`/followups/${selectedLead._id}`, payload);
        toast.success("Follow-up scheduled");
      }

      setIsFollowUpModalOpen(false);
      setFollowUpDate("");
      setFollowUpNotes("");
      setFollowUpType("Call");
      setFollowUpPriority("");
      setFollowUpTitle("");
      setEditingFollowUp(null);
      setFuErrors({});

      fetchDetails(selectedLead._id, true);
    } catch (err: unknown) {
      if ((err as CRMError).response?.status === 409) {
        if (window.confirm("Conflict detected: Another follow-up is scheduled at this time. Schedule anyway?")) {
          setIsSubmitting(false);
          submitFollowUp(true);
          return;
        } else {
          try {
            await api.post(`/notes/${selectedLead._id}`, {
              content: `The ${followUpType} scheduled for ${toESTDate(followUpDate).toLocaleString()} was CANCELED due to a calendar conflict.`
            });
            fetchDetails(selectedLead._id, true);
          } catch (noteErr) {
            console.error("Failed to log conflict cancellation:", noteErr);
          }
        }
      } else {
        toast.error((err as CRMError).response?.data?.message || "Failed to schedule/update follow-up");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const markFollowupDone = async (fuId: string) => {
    if (permissions.isReadOnly) return;
    setTaskToComplete(fuId);
    setIsConfirmDoneOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!taskToComplete || !selectedLead || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.put(`/followups/${taskToComplete}/complete`);
      toast.success("Follow-up completed");
      setIsConfirmDoneOpen(false);
      setTaskToComplete(null);
      fetchDetails(selectedLead._id, true);
    } catch (error) { console.error(error); } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFollowUpModal = () => {
    setEditingFollowUp(null);
    setFollowUpTitle("");
    setFollowUpDate("");
    setFollowUpNotes("");
    setFollowUpType("Call");
    setFollowUpPriority("");
    setAssignedTo("self");
    setCustomAssignedTo("");
    setFollowUpStatus("pending");
    setFuErrors({});
    setIsFollowUpModalOpen(true);
  };

  const initiateCall = (lead: Lead, contact?: Contact) => {
    if (permissions.isReadOnly) return;
    setSelectedContactForCall(contact || null);
    const phone = contact?.direct_phone || lead.telephone;
    if (phone) {
      const cleanPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
      openDialer(cleanPhone, lead._id, contact?.name || lead.name || 'Unknown', true);
    }
    setCallOutcome("Answered - Interested");
    setCallNotes("");
    setCreateFollowUpInCall(false);
    setFollowUpTitle("");
    setFollowUpDate("");
    setFollowUpNotes("");
    setFollowUpType("Call");
    setFollowUpPriority("");
    setAssignedTo("self");
    setCustomAssignedTo("");
    setFuErrors({});
    setIsCallModalOpen(true);
  };

  const logCall = async () => {
    if (!selectedLead || isSubmitting) return;

    // Validate follow-up details if the checkbox is checked
    const newErrors: Record<string, string> = {};
    if (createFollowUpInCall) {
      if (!followUpTitle.trim()) {
        newErrors.followUpTitle = "Follow-up Title is required";
      }
      if (!followUpDate) {
        newErrors.date = "Date & Time is required";
      } else if (new Date(followUpDate) < new Date()) {
        newErrors.date = "Date & Time cannot be in the past";
      }
      if (assignedTo === "other" && !customAssignedTo.trim()) {
        newErrors.assignedTo = "Please specify who this is assigned to";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFuErrors(newErrors);
      toast.error("Please fix the errors before scheduling");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/voice/log-call`, {
        lead_id: selectedLead._id,
        outcome: callOutcome,
        notes: callNotes,
        contact_name: selectedContactForCall?.name || selectedLead.name || 'Unknown',
        callSid: useDialerStore.getState().activeCallSid || null
      });
      toast.success("Call logged");
      setIsCallModalOpen(false);
      setCallNotes("");

      // Create Follow Up if enabled
      if (createFollowUpInCall) {
        try {
          await api.post(`/followups/${selectedLead._id}`, {
            title: followUpTitle,
            date_time: new Date(followUpDate).toISOString(),
            type: followUpType,
            priority: followUpPriority,
            notes: followUpNotes || `Call Follow-Up: ${followUpTitle}`,
            assigned_user: assignedTo === "self" ? "self" : (assignedTo === "other" ? customAssignedTo : assignedTo),
            force: true
          });
          toast.success("Follow-up scheduled!");
        } catch (fuErr: any) {
          toast.error(fuErr.response?.data?.message || "Failed to schedule follow-up");
        }
      }

      // Reset follow-up state
      setFollowUpTitle("");
      setFollowUpDate("");
      setFollowUpNotes("");
      setFollowUpType("Call");
      setFollowUpPriority("");
      setAssignedTo("self");
      setCustomAssignedTo("");
      setCreateFollowUpInCall(false);
      setFuErrors({});

      fetchDetails(selectedLead._id, true);
    } catch {
      toast.error("Failed to log call");
    } finally {
      setIsSubmitting(false);
    }
  };


  // --- Filters ---     

  const sendQuickEmail = async () => {
    const errors: Record<string, string> = {};
    if (!emailData.subject.trim()) errors.subject = "Subject is required";
    if (!emailData.body.trim()) errors.body = "Message body is required";
    const recipientEmail = emailData.to?.trim();
    if (!recipientEmail) errors.to = "Recipient email is required";
    if (Object.keys(errors).length > 0) { setEmailErrors(errors); toast.error("Please fill all details"); return; }
    setIsSubmitting(true);
    try {
      await api.post("/emails/send", { lead_id: selectedLead?._id, to: recipientEmail, cc: emailData.cc.join(", "), subject: emailData.subject, body: emailData.body });
      toast.success("Email sent!");
      setIsEmailModalOpen(false);
      setEmailData({ subject: "Following up", body: "", cc: [], to: "" });
      if (selectedLead) fetchDetails(selectedLead._id, true);
    } catch { toast.error("Failed to send email"); }
    finally { setIsSubmitting(false); }
  };

  const sendQuickSms = async () => {
    if (!smsMessage.trim()) { toast.error("Please enter a message"); return; }
    setIsSubmitting(true);
    try {
      const phone = (selectedLead as Lead)?.contacts?.[0]?.direct_phone || selectedLead?.telephone;
      if (!phone) { toast.error("No phone number found"); return; }
      await api.post("/sms/send-sms", { lead_id: selectedLead?._id, to: phone, message: smsMessage });
      toast.success("SMS sent!");
      setIsSmsModalOpen(false);
      setSmsMessage("");
      if (selectedLead) fetchDetails(selectedLead._id, true);
    } catch { toast.error("Failed to send SMS"); }
    finally { setIsSubmitting(false); }
  };

  const scheduleQuickMeeting = async (force = false) => {
    if (isSubmitting) return;
    const errors: Record<string, string> = {};
    if (!meetingData.title.trim()) errors.title = "Meeting title is required";
    if (!meetingData.date_time) errors.date_time = "Date and time are required";
    if (Object.keys(errors).length > 0) { setMeetingErrors(errors); return; }
    setIsSubmitting(true);
    try {
      await api.post("/followups/" + selectedLead?._id, {
        title: meetingData.title,
        date_time: new Date(meetingData.date_time).toISOString(),
        type: 'Meeting',
        priority: null,
        notes: meetingData.notes,
        contact_id: selectedLead?.contacts?.[0]?._id,
        cc_emails: meetingCc,
        force
      });
      toast.success("Meeting scheduled and invite sent!");
      setIsMeetingModalOpen(false);
      setMeetingData({ title: "", date_time: "", type: "Virtual", notes: "" });
      setMeetingCc([]);
      setMeetingCcInput("");
      setMeetingErrors({});
      if (selectedLead) fetchDetails(selectedLead._id, true);
    } catch (err: unknown) {
      if ((err as CRMError).response?.status === 409) {
        const conflict = (err as CRMError).response.data.conflicts[0];
        if (window.confirm(`Conflict detected: "${conflict.summary}" at ${new Date(conflict.start).toLocaleTimeString()}. Schedule anyway?`)) {
          setIsSubmitting(false);
          scheduleQuickMeeting(true);
          return;
        } else {
          try {
            await api.post("/notes/" + selectedLead?._id, {
              content: `The meeting "${meetingData.title}" scheduled for ${toESTDate(meetingData.date_time).toLocaleString()} was CANCELED due to a calendar conflict.`
            });
            if (selectedLead) fetchDetails(selectedLead._id, true);
          } catch (noteErr) {
            console.error("Failed to log conflict cancellation:", noteErr);
          }
        }
      } else {
        toast.error((err as CRMError).response?.data?.message || (err as CRMError).message || "Failed to schedule meeting");
      }
    }
    finally { setIsSubmitting(false); }
  };
  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    try {
      await api.delete(`/campaigns/${campaignToDelete._id}`);
      toast.success(`"${campaignToDelete.name}" deleted successfully`);
      if (selectedCampaign?._id === campaignToDelete._id) {
        setSelectedCampaign(null);
        setSelectedLead(null);
      }
      setCampaignToDelete(null);
      // Refresh campaigns list
      const res = await api.get('/campaigns');
      useCampaignStore.getState().setCampaigns(res.data);
    } catch {
      toast.error('Failed to delete campaign');
    }
  };

  const filteredLeads = leads.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      s.city?.toLowerCase().includes(leadSearch.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout>
      <div className="h-auto xl:h-[calc(100vh-100px)] flex flex-col xl:flex-row gap-4 overflow-y-auto xl:overflow-x-auto xl:overflow-y-hidden p-1 custom-scrollbar">

        {campaignToDelete && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-card p-6 rounded-xl shadow-xl w-full max-w-sm">
              <h3 className="font-bold text-lg mb-2">Delete Campaign</h3>
              <p className="text-sm text-muted-foreground mb-6">Are you sure you want to delete "{campaignToDelete.name}"? This action cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setCampaignToDelete(null)} className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-lg">Cancel</button>
                <button onClick={handleDeleteCampaign} className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* --- PANEL 1: Campaigns --- */}
        <div className="w-full xl:w-52 2xl:w-60 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden shrink-0">


          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm">Campaigns</h2>
              {permissions.manageCampaigns && (
              <button
                onClick={() => setIsCreateCampaignOpen(true)}
                className="p-1 hover:bg-accent rounded text-primary transition-colors"
                title="Create New Campaign"
              >
                <Plus size={16} />
              </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
              <input
                  id="search"
                  name="search"
              
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
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {loadingCampaigns ? (
              <div className="p-4 text-center text-[10px] text-muted-foreground animate-pulse">Loading...</div>
            ) : filteredCampaigns.map((c, index) => (
              <div
                key={c._id}
                className={`group relative w-full flex items-center rounded-lg mb-1 transition-all ${selectedCampaign?._id === c._id ? "bg-primary text-primary-foreground shadow-md" : index === campaignSearchIndex ? "bg-accent border-l-4 border-l-primary" : "hover:bg-accent text-foreground"}`}
              >
                <button
                  onClick={() => setSelectedCampaign(c)}
                  className="flex-1 text-left p-3 flex items-center gap-3 min-w-0"
                >
                  <Folder size={16} className={`flex-shrink-0 ${selectedCampaign?._id === c._id ? "text-primary-foreground" : "text-primary"}`} />
                  <span className="text-xs font-medium truncate">{c.name}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (!permissions.manageCampaigns) return; setCampaignToDelete(c); }}
                  disabled={!permissions.manageCampaigns}
                  className={`shrink-0 p-2 mr-1 rounded transition-all ${!permissions.manageCampaigns ? 'opacity-30 blur-[0.5px] cursor-not-allowed pointer-events-none' : 'opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive'} ${selectedCampaign?._id === c._id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                  title={!permissions.manageCampaigns ? 'Read-only access' : 'Delete campaign'}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* --- PANEL 2: Leads --- */}
        <div className="w-full xl:w-64 2xl:w-72 flex flex-col bg-card border rounded-xl shadow-sm overflow-hidden shrink-0">


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
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <h2 className="font-bold text-sm truncate max-w-[150px] sm:max-w-[200px]">{selectedCampaign.name}</h2>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded-full font-bold text-muted-foreground">{filteredLeads.length}</span>
                    {permissions.manageCampaigns && (
                    <button
                      onClick={() => setIsImportOpen(true)}
                      className="p-1 hover:bg-accent rounded text-primary transition-colors"
                      title="Import Excel/CSV"
                    >
                      <Upload size={16} />
                    </button>
                    )}
                    {/* <button
                      onClick={handleExport}
                      className="p-1 hover:bg-accent rounded text-primary transition-colors"
                      title="Export to Excel"
                    >
                      <Download size={16} />
                    </button> */}
                    {permissions.createEdit && (
                    <button
                      onClick={() => setIsCreateLeadOpen(true)}
                      className="p-1 hover:bg-accent rounded text-primary transition-colors"
                      title="Add Lead"
                    >
                      <Plus size={16} />
                    </button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                  <input
                      id="search-leads"
                      name="search-leads"
                  
                    placeholder="Search leads..."
                    className="w-full bg-accent/50 border-none rounded-lg pl-8 pr-2 py-1.5 text-xs focus:ring-1 ring-primary outline-none"
                    value={leadSearch}
                    onChange={e => setLeadSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setLeadSearchIndex(prev => (prev < filteredLeads.length - 1 ? prev + 1 : 0));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setLeadSearchIndex(prev => (prev > 0 ? prev - 1 : filteredLeads.length - 1));
                      } else if (e.key === 'Enter' && leadSearchIndex >= 0) {
                        setSelectedLead(filteredLeads[leadSearchIndex]);
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Filter size={12} className="text-muted-foreground" />
                  <select
                      id="status-filter"
                      name="status-filter"
                  
                    className="text-[10px] bg-transparent border-none focus:ring-0 outline-none font-medium cursor-pointer"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option className="dark:bg-accent" value="all">All Statuses</option>
                    {statusLabels.map(opt => <option className="dark:bg-accent" key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/50 max-h-[400px] xl:max-h-none custom-scrollbar">


                {loadingLeads ? (
                  <div className="p-8 text-center text-[10px] text-muted-foreground animate-pulse">Loading leads...</div>
                ) : filteredLeads.length === 0 ? (
                  <div className="p-8 text-center text-[10px] text-muted-foreground">No leads found.</div>
                ) : (
                  filteredLeads.map((s, index) => (
                    <button
                      key={s._id}
                      id={`lead-item-${index}`}
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
        <div className="flex-1 flex flex-col min-w-0 xl:min-w-[600px] h-auto xl:h-full">



          {!selectedLead ? (
            <div className="flex-1 bg-card border rounded-xl shadow-sm flex flex-col items-center justify-center text-muted-foreground p-12 text-center transition-all duration-300 ease-in-out">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Building size={32} />
              </div>
              <h3 className="font-bold text-foreground">No Lead Selected</h3>
              <p className="text-xs max-w-xs mt-2">Select a lead to view profile and notes</p>
            </div>
          ) : (
            <div id="lead-detail-section" className="flex-1 flex flex-col lg:flex-row gap-4 lg:overflow-hidden">

              {/* Activity Feed (Middle) */}
              <div className="flex-1 flex flex-col gap-4 min-h-0">


                <div className="bg-card border rounded-xl p-4 shadow-sm shrink-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-start gap-2 min-w-0">
                        <h1 className="text-xl font-bold text-foreground leading-tight truncate max-w-[180px] sm:max-w-[250px] xl:max-w-[350px]">{truncateName(selectedLead.name, 15)}</h1>
                        <button
                          onClick={() => navigate(`/lead/${selectedLead._id}`)}
                          className="p-1.5 hover:bg-accent rounded-lg text-primary transition-all shrink-0"
                          title="View Full Profile"
                        >
                          <ExternalLink size={18} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Info size={12} /> {selectedLead.type || "Lead Type"}</span>
                        {selectedLead.city && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} /> {selectedLead.city}</span>
                        )}
                        {/* Assignment Status */}
                        {selectedLead.assigned_to ? (
                          (() => {
                            const isMe = typeof selectedLead.assigned_to === 'object'
                              ? selectedLead.assigned_to._id === currentUser?._id
                              : selectedLead.assigned_to === currentUser?._id;
                            const name = typeof selectedLead.assigned_to === 'object'
                              ? selectedLead.assigned_to.name
                              : 'Assigned';
                            return (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                                isMe 
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                  : 'bg-blue-500/10 text-blue-500 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400'
                              }`}>
                                <Users size={10} />
                                {isMe ? 'Assigned to You' : `Assigned to: ${name}`}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 flex items-center gap-1.5 transition-all shadow-sm">
                            <Users size={10} />
                            Unassigned
                          </span>
                        )}

                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => setIsDeleteLeadConfirmOpen(true)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 dark:hover:text-rose-400 dark:hover:bg-rose-500/20 transition-all shrink-0 animate-in fade-in zoom-in duration-200"
                          title="Delete Lead"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => !permissions.isReadOnly && setIsFollowUpModalOpen(true)}
                        disabled={permissions.isReadOnly}
                        className={`p-1 hover:bg-accent rounded text-primary transition-colors ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                        title={permissions.isReadOnly ? undefined : "Schedule Follow-up"}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-card border rounded-xl p-3 shadow-sm shrink-0">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Quick Actions</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => { const el = document.querySelector('textarea[placeholder="Add a note..."]') as HTMLTextAreaElement; el?.focus(); el?.scrollIntoView({ behavior: 'smooth' }); }} 
                      disabled={permissions.isReadOnly}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-accent/50 hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all group ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                    >
                      <MessageSquare size={15} className="text-muted-foreground group-hover:text-primary" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary">Add Note</span>
                    </button>
                    <button 
                      onClick={() => !permissions.isReadOnly && initiateCall(selectedLead)} 
                      disabled={permissions.isReadOnly}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-[#fd6a02] hover:bg-[#e05d02] text-white border border-transparent transition-all shadow-sm ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                    >
                      <Phone size={15} className="text-white" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white">MAKE CALL</span>
                    </button>
                    <button 
                      onClick={() => { if (!permissions.isReadOnly) { setSmsMessage(""); setIsSmsModalOpen(true); } }} 
                      disabled={permissions.isReadOnly}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-accent/50 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all group ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                    >
                      <MessageSquare size={15} className="text-muted-foreground group-hover:text-blue-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-blue-500">Send SMS</span>
                    </button>
                    <button 
                      onClick={() => !permissions.isReadOnly && setIsFollowUpModalOpen(true)} 
                      disabled={permissions.isReadOnly}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-accent/50 hover:bg-green-500/10 border border-transparent hover:border-green-500/20 transition-all group ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                    >
                      <CalendarPlus size={15} className="text-muted-foreground group-hover:text-green-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-green-500">Follow-Up</span>
                    </button>
                    <button 
                      onClick={() => { if (!permissions.isReadOnly) { setMeetingData({ title: "", date_time: "", type: "Virtual", notes: "" }); setIsMeetingModalOpen(true); } }} 
                      disabled={permissions.isReadOnly}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-accent/50 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all group ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                    >
                      <Video size={15} className="text-muted-foreground group-hover:text-purple-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-purple-500">Meeting</span>
                    </button>
                    <button 
                      onClick={() => {
                        if (!permissions.isReadOnly) {
                          const contactEmail = (selectedLead as Lead).contacts?.[0]?.email || "";
                          setEmailData({ subject: "Following up", body: "", cc: [], to: contactEmail });
                          setIsEmailModalOpen(true);
                        }
                      }} 
                      disabled={permissions.isReadOnly}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-accent/50 hover:bg-sky-500/10 border border-transparent hover:border-sky-500/20 transition-all group ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                    >
                      <Mail size={15} className="text-muted-foreground group-hover:text-sky-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-sky-500">Email</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col bg-card border rounded-xl shadow-sm lg:overflow-hidden min-h-[400px] lg:min-h-0">

                  <div className="p-3 border-b bg-accent/5 flex items-center justify-between">
                    <div className="flex items-center justify-center gap-2">
                      <History size={16} className="text-primary" />
                      <Select value={activityFilter} onValueChange={(val: any) => setActivityFilter(val)}>
                        <SelectTrigger className="h-7 text-[10px] w-[130px] font-bold uppercase tracking-wider dark:bg-card border-none bg-transparent hover:bg-accent/50 focus:ring-0 focus:ring-offset-0 px-2">
                          <SelectValue placeholder="Activity Feed" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" className="text-[10px] font-semibold uppercase">Activity Feed</SelectItem>
                          <SelectItem value="sms" className="text-[10px] font-semibold uppercase">SMS</SelectItem>
                          <SelectItem value="recordings" className="text-[10px] font-semibold uppercase">Recordings</SelectItem>
                          <SelectItem value="notes" className="text-[10px] font-semibold uppercase">Notes</SelectItem>
                          <SelectItem value="meetings" className="text-[10px] font-semibold uppercase">Meetings</SelectItem>
                          <SelectItem value="emails" className="text-[10px] font-semibold uppercase">Emails</SelectItem>
                        </SelectContent>
                      </Select>

                      <button
                        onClick={() => selectedLead && fetchDetails(selectedLead._id, false)}
                        className="p-1 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-primary"
                        title="Refresh activity feed"
                      >
                        <RefreshCw size={12} className={loadingDetails ? "animate-spin" : ""} />
                      </button>

                      {notes.length > 0 && permissions.deleteRecords && (
                        <button
                          onClick={() => setIsDeleteAllConfirmOpen(true)}
                          className="text-[9px] text-destructive px-2.5 py-1 bg-destructive/5 hover:bg-destructive hover:text-white border border-destructive/20 rounded-lg font-bold uppercase transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Trash2 size={11} /> Delete All
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                    <div className={`bg-accent/10 dark:bg-accent/5 rounded-xl p-3 border border-dashed border-primary/20 ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none select-none' : ''}`}>
                      <textarea
                          id="note-content"
                          name="note-content"
                      
                        placeholder={permissions.isReadOnly ? 'Read-only access — cannot add notes' : 'Add a note...'}
                        className="w-full bg-transparent border-none text-xs outline-none resize-none min-h-[50px] dark:text-foreground"
                        value={noteContent}
                        onChange={e => !permissions.isReadOnly && setNoteContent(e.target.value)}
                        disabled={permissions.isReadOnly}
                        readOnly={permissions.isReadOnly}
                      />
                      <div className="flex justify-end mt-1">
                        <button
                          onClick={() => !permissions.isReadOnly && addNote()}
                          disabled={!noteContent.trim() || isSubmitting || permissions.isReadOnly}
                          className={`btn-primary px-3 text-[10px] ${(isSubmitting || !noteContent.trim() || permissions.isReadOnly) ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {isSubmitting ? "Posting..." : "Post Note"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {loadingDetails ? (
                        <div className="text-center py-4 animate-pulse text-[10px] text-muted-foreground">Loading feed...</div>
                      ) : filteredNotes.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                          <p className="font-semibold text-[11px] text-muted-foreground">
                            {activityFilter === 'recordings' ? 'NO RECORDINGS FOUND' :
                             activityFilter === 'sms' ? 'NO SMS RECORDS FOUND' :
                             activityFilter === 'notes' ? 'NO NOTES FOUND' :
                             activityFilter === 'meetings' ? 'NO MEETINGS FOUND' :
                             activityFilter === 'emails' ? 'NO EMAILS FOUND' :
                             'NO ACTIVITIES YET'}
                          </p>
                          <p className="text-[9px] text-muted-foreground/80 mt-0.5">
                            {activityFilter === 'all' ? 'Add your first outreach note' : 'Try changing the filter or refresh'}
                          </p>
                        </div>
                      ) : (
                        filteredNotes.map(n => (
                          <div key={n._id} className="relative pl-5 before:absolute before:left-[6px] before:top-2 before:bottom-[-20px] before:w-[1.5px] before:bg-border last:before:hidden">
                            <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-card flex items-center justify-center">
                              {n.type === 'email' ? <Mail size={7} className="text-white" /> :
                                n.type === 'meeting' ? <Video size={7} className="text-white" /> :
                                  n.type === 'call' ? <Phone size={7} className="text-white" /> :
                                    n.type === 'sms' ? <MessageSquare size={7} className="text-white" /> :
                                      n.type === 'status_change' ? <CheckCircle2 size={7} className="text-white" /> :
                                        <MessageSquare size={7} className="text-white" />}
                            </div>
                            <div className="bg-white dark:bg-card shadow-sm border rounded-lg p-2.5 group relative">
                              <button
                                onClick={() => !permissions.isReadOnly && deleteNote(n._id)}
                                disabled={permissions.isReadOnly}
                                className={`absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive transition-all ${permissions.isReadOnly ? 'opacity-30 blur-[0.5px] cursor-not-allowed pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                                title={permissions.isReadOnly ? 'Read-only access' : 'Delete note'}
                              >
                                <Trash2 size={12} />
                              </button>
                              <p className="text-xs text-foreground leading-relaxed pr-6 break-words whitespace-pre-wrap">{formatNoteContent(n.content)}</p>
                              {n.type === 'email' && n.metadata?.subject && (
                                <p className="text-[10px] text-muted-foreground mt-1 italic">Subject: {n.metadata.subject}</p>
                              )}
                              {n.type === 'call' && n.metadata?.recording_url && (
                                <RecordingPlayer
                                  url={n.metadata?.recording_url}
                                  duration={n.metadata?.recording_duration || n.metadata?.duration}
                                />
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
              <div className="w-full lg:w-full xl:w-64 2xl:w-80 flex flex-col gap-4 overflow-y-auto shrink-0 pb-6 xl:pb-0 custom-scrollbar">


                <div className={`bg-card border rounded-xl p-4 shadow-sm space-y-4 ${permissions.isReadOnly ? 'opacity-50 blur-[0.5px] pointer-events-none' : ''}`}>
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Relationship</h3>
                  <div className="space-y-3">
                    <Select value={selectedLead.status} onValueChange={handleStatusChange} disabled={permissions.isReadOnly}>
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
                      <span className="truncate">
                        {selectedLead.telephone || "N/A"}
                        {selectedLead.telephone_extension && ` x${selectedLead.telephone_extension}`}
                      </span>
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
                      selectedLead.contacts.map((contact: Contact) => (
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
                                <div className="flex items-center justify-start gap-2">
                                  <Phone size={12} strokeWidth={2.5} className="text-slate-600" />
                                  <span className="text-foreground font-medium">
                                    {contact.direct_phone}
                                    {contact.extension && ` x${contact.extension}`}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    !permissions.isReadOnly && initiateCall(selectedLead, contact);
                                  }}
                                  disabled={permissions.isReadOnly}
                                  className={`p-1 hover:bg-orange-500 hover:text-white rounded transition-colors text-orange-500 ${permissions.isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                                  title={permissions.isReadOnly ? undefined : "Call Contact"}
                                >
                                  <Phone size={10} />
                                </button>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center justify-start gap-2 text-xs">
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
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-[8px] uppercase tracking-widest font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">{f.type || 'Task'}</span>
                                <span className="text-[9px] font-bold text-foreground">{toESTDate(f.date_time).toLocaleString()}</span>
                              </div>
                              {!permissions.isReadOnly && (
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => markFollowupDone(f._id)}
                                    className="p-1 hover:bg-success/15 text-muted-foreground hover:text-success rounded transition-colors"
                                    title="Mark done"
                                  >
                                    <CheckCircle2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditFollowUpModal(f)}
                                    className="p-1 hover:bg-primary/15 text-muted-foreground hover:text-primary rounded transition-colors"
                                    title="Edit follow-up"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFollowUp(f._id)}
                                    className="p-1 hover:bg-destructive/15 text-muted-foreground hover:text-destructive rounded transition-colors"
                                    title="Delete follow-up"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                            {f.title && <h4 className="text-[10px] font-bold text-foreground mt-1">{f.title}</h4>}
                            <p className="text-[10px] text-foreground/80 mt-0.5 line-clamp-1">{f.notes || "No notes"}</p>
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
        <DialogContent aria-describedby={undefined} className="sm:max-w-md dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader><DialogTitle className="dark:text-foreground">New Campaign</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground">Campaign Name *</label>
            <input
                id="e-g-summer-outreach"
                name="e-g-summer-outreach"
            
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
            <button
              disabled={isSubmitting}
              className={`btn-primary ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => createCampaign()}
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Campaign Confirmation Dialog */}
      <Dialog open={!!campaignToDelete} onOpenChange={(open) => { if (!open) setCampaignToDelete(null); }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center justify-center gap-2">
              <Trash2 size={18} /> Delete Campaign
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-foreground">
              Are you sure you want to delete <span className="font-bold">"{campaignToDelete?.name}"</span>?
            </p>
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-xs text-destructive font-medium">⚠️ Warning: This will permanently delete the campaign and <strong>all associated leads</strong>. This action cannot be undone.</p>
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setCampaignToDelete(null)}>Cancel</button>
            <button
              className="btn-primary bg-destructive hover:bg-destructive/90 border-destructive"
              onClick={handleDeleteCampaign}
            >
              Yes, Delete Campaign
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFollowUpModalOpen} onOpenChange={(open) => {
        setIsFollowUpModalOpen(open);
        if (!open) {
          setFuErrors({});
          setEditingFollowUp(null);
        }
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] sm:max-w-lg dark:bg-card">
          <DialogHeader><DialogTitle className="dark:text-foreground">{editingFollowUp ? "Edit Follow-up" : "Schedule Follow-up"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Title</label>
              <input
                  id="e-g-discuss-proposal-details"
                  name="e-g-discuss-proposal-details"
              
                placeholder="e.g. Discuss proposal details"
                className="input-field"
                value={followUpTitle}
                onChange={e => setFollowUpTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Date & Time *</label>
              <DateTimePicker
                id="input-datetime-local-10"
                value={followUpDate || ""}
                onChange={val => {
                  setFollowUpDate(val);
                  if (fuErrors.date) setFuErrors(prev => ({ ...prev, date: "" }));
                }}
              />
              {fuErrors.date && <p className="text-[10px] text-destructive font-medium">{fuErrors.date}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                <select
                    id="follow-up-type"
                    name="follow-up-type" className="input-field dark:bg-card" value={followUpType} onChange={e => setFollowUpType(e.target.value)}>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Task">Task</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Priority (optional)</label>
                <select
                    id="select-field-12"
                    name="select-field-12" className="input-field dark:bg-card" value={followUpPriority || ""} onChange={e => setFollowUpPriority(e.target.value)}>
                  <option value="">NO</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
                {(!followUpPriority || followUpPriority === "") && (
                  <p className="text-xs text-muted-foreground mt-1">The Priority is not required</p>
                )}
              </div>
            </div>
            {editingFollowUp && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Status *</label>
                <select
                  name="status"
                  className="input-field dark:bg-card"
                  value={followUpStatus || ""}
                  onChange={e => setFollowUpStatus(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="done">Completed / Done</option>
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Notes *</label>
              <textarea
                  id="reason-for-follow-up"
                  name="reason-for-follow-up"
              
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

          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => { setIsFollowUpModalOpen(false); setFuErrors({}); setEditingFollowUp(null); }}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => submitFollowUp()}
            >
              {isSubmitting ? "Saving..." : editingFollowUp ? "Update Follow-up" : "Schedule"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Follow-up Confirmation Dialog */}
      <AlertDialog open={!!followUpToDelete} onOpenChange={(open) => !open && setFollowUpToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400 font-bold flex items-center gap-2">
              Confirm Permanent Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to permanently delete this follow-up? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep It</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFollowUp}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
            >
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreateLeadOpen} onOpenChange={setIsCreateLeadOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-3xl dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader><DialogTitle className="dark:text-foreground">Add Lead to {selectedCampaign?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-6 py-2 p-1 pr-3">

            {/* Primary Contact Person */}
            <div className="space-y-4 border-b pb-6">
              <div className="flex items-center justify-start gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Users size={16} className="text-primary" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Primary Contact Person</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="main_contact_name" className="text-xs font-medium">Contact Full Name *</label>
                  <input
                    id="main_contact_name"
                    name="main_contact_name"
                    autoComplete="name"
                    className={`input-field ${errors.main_contact_name ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="e.g. Davina Midgette"
                    value={leadFormData.main_contact_name}
                    onChange={handleLeadFormChange}
                  />
                  {errors.main_contact_name && <p className="text-[10px] text-destructive">{errors.main_contact_name}</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact_title" className="text-xs font-medium">Title / Role *</label>
                  <select
                    id="contact_title"
                    name="contact_title"
                    autoComplete="organization-title"
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
                      id="specify-title"
                      name="specify-title"
                      autoComplete="off"
                      className="input-field mt-2"
                      placeholder="Specify title..."
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact_department" className="text-xs font-medium">Department *</label>
                  <input
                    id="contact_department"
                    name="contact_department"
                    autoComplete="organization"
                    className={`input-field ${errors.contact_department ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="e.g. Administration"
                    value={leadFormData.contact_department}
                    onChange={handleLeadFormChange}
                  />
                  {errors.contact_department && <p className="text-[10px] text-destructive">{errors.contact_department}</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact_direct_phone" className="text-xs font-medium">Direct Phone *</label>
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                        {leadFormData.contact_phone_prefix}
                      </div>
                      <select
                        id="contact_phone_prefix"
                        name="select-field-15"
                        autoComplete="tel-country-code"
                        className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                        style={{
                          backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === leadFormData.contact_phone_prefix)?.code || 'US').toLowerCase()}.png)`,
                          backgroundPosition: 'left 0.5rem center'
                        }}
                        value={leadFormData.contact_phone_prefix}
                        onChange={(e) => setLeadFormData({ ...leadFormData, contact_phone_prefix: e.target.value })}
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
                      id="contact_direct_phone"
                      name="contact_direct_phone"
                      autoComplete="tel-national"
                      className={`input-field flex-1 ${errors.contact_direct_phone ? "border-destructive focus:ring-destructive/20" : ""}`}
                      placeholder="Phone"
                      value={leadFormData.contact_direct_phone}
                      onChange={handleLeadFormChange}
                    />
                    <input
                      id="contact_extension"
                      name="contact_extension"
                      autoComplete="off"
                      className="input-field w-20"
                      placeholder="Ext."
                      value={leadFormData.contact_extension}
                      onChange={handleLeadFormChange}
                    />
                  </div>
                  {errors.contact_direct_phone && <p className="text-[10px] text-destructive">{errors.contact_direct_phone}</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact_email" className="text-xs font-medium">Email Address *</label>
                  <input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    autoComplete="email"
                    className={`input-field ${errors.contact_email ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="email@example.com"
                    value={leadFormData.contact_email}
                    onChange={handleLeadFormChange}
                  />
                  {errors.contact_email && <p className="text-[10px] text-destructive">{errors.contact_email}</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="contact_best_time" className="text-xs font-medium">Best Time to Call *</label>
                  <select
                    id="contact_best_time"
                    name="contact_best_time"
                    autoComplete="off"
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
                  <span className="text-xs font-medium block">Preferred Contact Method *</span>
                  <div className="flex gap-4">
                    {["Call", "Email", "Text"].map(method => (
                      <label key={method} className="flex items-center justify-center gap-2 cursor-pointer text-xs">
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
                className="flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSecondary ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Add Secondary Contact (Optional)
              </button>

              {showSecondary && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1">
                    <label htmlFor="secondary_contact_name" className="text-xs font-medium">Secondary Name</label>
                    <input
                      id="secondary_contact_name"
                      name="secondary_contact_name"
                      autoComplete="name"
                      className="input-field"
                      placeholder="Name"
                      value={leadFormData.secondary_contact_name}
                      onChange={handleLeadFormChange}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="secondary_contact_title" className="text-xs font-medium">Secondary Title</label>
                    <select
                      id="secondary_contact_title"
                      name="secondary_contact_title"
                      autoComplete="organization-title"
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
                    <label htmlFor="secondary_contact_department" className="text-xs font-medium">Secondary Department</label>
                    <input
                      id="secondary_contact_department"
                      name="secondary_contact_department"
                      autoComplete="organization"
                      className="input-field"
                      placeholder="e.g. Administration"
                      value={leadFormData.secondary_contact_department}
                      onChange={handleLeadFormChange}
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="secondary_contact_phone" className="text-xs font-medium">Secondary Phone</label>
                    <div className="flex gap-2">
                      <div className="relative w-28 shrink-0">
                        <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                          {leadFormData.secondary_phone_prefix}
                        </div>
                        <select
                          id="secondary_phone_prefix"
                          name="select-field-16"
                          autoComplete="tel-country-code"
                          className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                          style={{
                            backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === leadFormData.secondary_phone_prefix)?.code || 'US').toLowerCase()}.png)`,
                            backgroundPosition: 'left 0.5rem center'
                          }}
                          value={leadFormData.secondary_phone_prefix}
                          onChange={(e) => setLeadFormData({ ...leadFormData, secondary_phone_prefix: e.target.value })}
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
                        id="secondary_contact_phone"
                        name="secondary_contact_phone"
                        autoComplete="tel-national"
                        className="input-field flex-1"
                        placeholder="Phone"
                        value={leadFormData.secondary_contact_phone}
                        onChange={handleLeadFormChange}
                      />
                      <input
                        id="secondary_contact_extension"
                        name="secondary_contact_extension"
                        autoComplete="off"
                        className="input-field w-20"
                        placeholder="Ext."
                        value={leadFormData.secondary_contact_extension}
                        onChange={handleLeadFormChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="secondary_contact_email" className="text-xs font-medium">Secondary Email</label>
                    <input
                      id="secondary_contact_email"
                      name="secondary_contact_email"
                      type="email"
                      autoComplete="email"
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
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center justify-start gap-2">
                <Building size={16} className="text-primary" /> Organization Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label htmlFor="lead_name" className="text-xs font-medium">Name / Organization *</label>
                  <input
                    id="lead_name"
                    name="name"
                    autoComplete="organization"
                    className={`input-field ${errors.name ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="Lead Name"
                    value={leadFormData.name}
                    onChange={handleLeadFormChange}
                  />
                  {errors.name && <p className="text-[10px] text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1">
                  <label htmlFor="lead_type" className="text-xs font-medium">Lead Type</label>
                  <select
                    id="lead_type"
                    name="type"
                    autoComplete="off"
                    className="input-field"
                    value={leadFormData.type}
                    onChange={handleLeadFormChange}
                  >
                    <option value="">Select type...</option>
                    <option>Public</option>
                    <option>Private</option>
                    <option>Parent</option>
                    <option>Other</option>
                  </select>
                  {leadFormData.type === "Other" && (
                    <input
                      id="specify-lead-type"
                      name="specify-lead-type"
                      autoComplete="off"
                      placeholder="Specify lead type..."
                      className="input-field mt-2 animate-in slide-in-from-top-1 duration-200"
                      value={customLeadType}
                      onChange={e => setCustomLeadType(e.target.value)}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <label htmlFor="category_group" className="text-xs font-medium">Category / Group</label>
                  <input
                    id="category_group"
                    name="category_group"
                    autoComplete="off"
                    className="input-field"
                    placeholder="Category"
                    value={leadFormData.category_group}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="lead_department" className="text-xs font-medium">Department</label>
                  <input
                    id="lead_department"
                    name="department"
                    autoComplete="organization"
                    className="input-field"
                    placeholder="e.g. Sales, Marketing"
                    value={leadFormData.department}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="telephone" className="text-xs font-medium">Main Phone</label>
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <div className="absolute inset-0 flex items-center pl-8 text-xs pointer-events-none font-medium">
                        {leadFormData.telephone_prefix}
                      </div>
                      <select
                        id="telephone_prefix"
                        name="select-field-18"
                        autoComplete="tel-country-code"
                        className="input-field w-full dark:bg-card px-2 text-transparent appearance-none bg-no-repeat"
                        style={{
                          backgroundImage: `url(https://flagcdn.com/w20/${(countryCodes.find(c => c.dialCode === leadFormData.telephone_prefix)?.code || 'US').toLowerCase()}.png)`,
                          backgroundPosition: 'left 0.5rem center'
                        }}
                        value={leadFormData.telephone_prefix}
                        onChange={(e) => setLeadFormData({ ...leadFormData, telephone_prefix: e.target.value })}
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
                      id="telephone"
                      name="telephone"
                      autoComplete="tel-national"
                      className="input-field flex-1"
                      placeholder="Phone"
                      value={leadFormData.telephone}
                      onChange={handleLeadFormChange}
                    />
                    <input
                      id="telephone_extension"
                      name="telephone_extension"
                      autoComplete="off"
                      className="input-field w-20"
                      placeholder="Ext."
                      value={leadFormData.telephone_extension}
                      onChange={handleLeadFormChange}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="website" className="text-xs font-medium">Website</label>
                  <input
                    id="website"
                    name="website"
                    autoComplete="url"
                    className="input-field"
                    placeholder="https://..."
                    value={leadFormData.website}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label htmlFor="start_time" className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Start Time</label>
                      <input
                        id="start_time"
                        name="start_time"
                        type="time"
                        autoComplete="off"
                        className="input-field w-full"
                        value={formatTimeForInput(leadFormData.start_time)}
                        onChange={handleLeadFormChange}
                      />
                    </div>
                    <span className="text-muted-foreground font-medium px-1 mt-5">to</span>
                    <div className="flex-1">
                      <label htmlFor="end_time" className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">End Time</label>
                      <input
                        id="end_time"
                        name="end_time"
                        type="time"
                        autoComplete="off"
                        className="input-field w-full"
                        value={formatTimeForInput(leadFormData.end_time)}
                        onChange={handleLeadFormChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="space-y-4 pb-4">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center justify-start gap-2">
                <MapPin size={16} className="text-primary" /> Address Details
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-1">
                  <label htmlFor="address_number" className="text-xs font-medium">Number</label>
                  <input
                    id="address_number"
                    name="address_number"
                    autoComplete="address-line2"
                    className="input-field"
                    placeholder="123"
                    value={leadFormData.address_number}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <label htmlFor="address_street" className="text-xs font-medium">Street</label>
                  <input
                    id="address_street"
                    name="address"
                    autoComplete="address-line1"
                    className="input-field"
                    placeholder="Street Address"
                    value={leadFormData.address}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label htmlFor="address_city" className="text-xs font-medium">City</label>
                  <input
                    id="address_city"
                    name="city"
                    autoComplete="address-level2"
                    className="input-field"
                    placeholder="City"
                    value={leadFormData.city}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <label htmlFor="address_state" className="text-xs font-medium">State</label>
                  <input
                    id="address_state"
                    name="state"
                    autoComplete="address-level1"
                    className="input-field"
                    placeholder="ST"
                    value={leadFormData.state}
                    onChange={handleLeadFormChange}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <label htmlFor="address_zip" className="text-xs font-medium">Zip</label>
                  <input
                    id="address_zip"
                    name="zip"
                    autoComplete="postal-code"
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
            <button
              disabled={isSubmittingLead}
              className={`btn-primary flex items-center justify-center gap-2 ${isSubmittingLead ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => createLead()}
            >
              {isSubmittingLead ? "Creating..." : "Create Lead"}
            </button>
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
        <DialogContent aria-describedby={undefined} className="sm:max-w-xl dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                {importResult?.errors && importResult.errors.length > 0 && (
                  <div className="text-left text-[10px] bg-destructive/5 p-2 rounded max-h-[100px] overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-destructive font-medium">Row {e.row}: {e.reason}</p>
                    ))}
                  </div>
                )}
                <button className="btn-primary w-full" onClick={() => {
                  setIsImportOpen(false);
                  setImportFile(null);
                  setImportStatus("idle");
                  setImportResult(null);
                }}>Done</button>
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
                <div className="bg-accent/30 rounded-xl border p-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-foreground mb-1">Excel Import Format</h4>
                    <p className="text-[10px] text-muted-foreground">Only <code className="bg-accent px-1 rounded">.xlsx</code> files are accepted (exported from Google Sheets).</p>
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-[220px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-[10px]">
                      <thead className="bg-accent/50 border-b">
                        <tr>
                          <th className="text-left p-2 font-bold uppercase tracking-wider text-muted-foreground">Column Name</th>
                          <th className="text-center p-2 font-bold uppercase tracking-wider text-muted-foreground">Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {[
                          { name: "Name/Organization", req: true },
                          { name: "Lead Type", req: false },
                          { name: "Category/Group", req: false },
                          { name: "Department", req: false },
                          { name: "Telephone", req: false },
                          { name: "Website", req: false },
                          { name: "Start Time", req: false },
                          { name: "End Time", req: false },
                          { name: "Primary Contact Name", req: false },
                          { name: "Primary Contact Title", req: false },
                          { name: "Primary Contact Department", req: false },
                          { name: "Primary Contact Email", req: false },
                          { name: "Primary Contact Phone", req: false },
                          { name: "Primary Best Time", req: false },
                          { name: "Primary Preferred Method", req: false },
                          { name: "Secondary Contact Name", req: false },
                          { name: "Secondary Contact Title", req: false },
                          { name: "Secondary Contact Department", req: false },
                          { name: "Secondary Contact Email", req: false },
                          { name: "Secondary Contact Phone", req: false },
                          { name: "Secondary Best Time", req: false },
                          { name: "Secondary Preferred Method", req: false },
                          { name: "Address Number", req: false },
                          { name: "Address", req: false },
                          { name: "City", req: false },
                          { name: "State", req: false },
                          { name: "Zip Code", req: false },
                        ].map((col) => (
                          <tr key={col.name} className="hover:bg-accent/20">
                            <td className="p-2 font-medium">{col.name}</td>
                            <td className="p-2 text-center">{col.req ? "✅" : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
        <DialogContent aria-describedby={undefined} className="sm:max-w-md dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-destructive">
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

      {/* Delete Lead Confirmation Dialog */}
      <AlertDialog open={isDeleteLeadConfirmOpen} onOpenChange={setIsDeleteLeadConfirmOpen}>
        <AlertDialogContent className="bg-background border border-border shadow-2xl rounded-2xl max-w-sm p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground flex items-center gap-2 text-destructive">
              <AlertCircle size={18} />
              Delete Lead?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete this lead? This will also delete all associated notes, calls, follow-ups, meetings, and contacts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex gap-2">
            <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border font-semibold px-3 py-1.5 rounded-lg text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLeadConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold px-3 py-1.5 rounded-lg text-xs border border-transparent"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Mark Done Confirmation Modal */}
      <Dialog open={isConfirmDoneOpen} onOpenChange={setIsConfirmDoneOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
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
            <button
              disabled={isSubmitting}
              className={`btn-primary flex-1 bg-success hover:bg-success/90 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={handleConfirmDone}
            >
              {isSubmitting ? "Processing..." : "Yes, Mark Done"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Outcome Modal */}
      <Dialog 
        open={isCallModalOpen} 
        onOpenChange={setIsCallModalOpen}
        modal={false}
      >
        <DialogContent 
          aria-describedby={undefined} 
          className="w-[95vw] max-w-xl dark:bg-card p-0 overflow-hidden flex flex-col max-h-[95vh] shadow-2xl border border-zinc-800"
          onPointerDownOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          hideOverlay={true}
        >
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="dark:text-foreground">Log Call Outcome</DialogTitle>
            <div className="text-sm text-muted-foreground mt-1 flex items-center flex-wrap gap-2">
              <span>Calling: <strong>{selectedLead?.name || "Unknown"}</strong></span>
              {selectedLead?.assigned_to ? (
                (() => {
                  const isMe = typeof selectedLead.assigned_to === 'object'
                    ? selectedLead.assigned_to._id === currentUser?._id
                    : selectedLead.assigned_to === currentUser?._id;
                  const name = typeof selectedLead.assigned_to === 'object'
                    ? selectedLead.assigned_to.name
                    : 'Assigned';
                  return (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isMe 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                    }`}>
                      {isMe ? 'Assigned to You' : `Assigned to: ${name}`}
                    </span>
                  );
                })()
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Unassigned
                </span>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="call-outcome" className="text-sm font-medium">Outcome</label>
                <select
                    id="call-outcome"
                    name="call-outcome" className="input-field dark:bg-card" value={callOutcome} onChange={e => setCallOutcome(e.target.value)}>
                  <option>Answered - Interested</option>
                  <option>Answered - Not Interested</option>
                  <option>Answered - Follow-Up Needed</option>
                  <option>Left Voicemail</option>
                  <option>No Answer</option>
                  <option>Wrong Number</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="call-notes" className="text-sm font-medium">Add Notes</label>
                <textarea
                    id="call-notes"
                    name="call-notes" className="input-field min-h-[80px]" placeholder="Briefly summarize the conversation..." value={callNotes} onChange={e => setCallNotes(e.target.value)} />
              </div>

              {/* Seamless Follow-up Checkbox */}
              <div className="flex items-center gap-2 py-2 border-t mt-2">
                <input
                  type="checkbox"
                  id="create-followup-checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                  checked={createFollowUpInCall}
                  onChange={e => setCreateFollowUpInCall(e.target.checked)}
                />
                <label htmlFor="create-followup-checkbox" className="text-sm font-bold text-foreground cursor-pointer select-none">
                  Schedule a follow-up task?
                </label>
              </div>

              {createFollowUpInCall && (
                <div className="space-y-4 p-4 rounded-xl border bg-accent/20 animate-in slide-in-from-top-2 duration-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Follow-up Task Details</h4>
                  
                  <div className="space-y-1.5">
                    <label htmlFor="e-g-call-to-finalize-contract" className="text-xs font-bold uppercase text-muted-foreground">Task Title *</label>
                    <input
                        id="e-g-call-to-finalize-contract"
                        name="e-g-call-to-finalize-contract"
                    
                      className={`input-field ${fuErrors.followUpTitle ? "border-destructive focus:ring-destructive/20" : ""}`}
                      placeholder="e.g. Call to finalize contract"
                      value={followUpTitle}
                      onChange={e => {
                        setFollowUpTitle(e.target.value);
                        if (fuErrors.followUpTitle) setFuErrors(prev => ({ ...prev, followUpTitle: "" }));
                      }}
                    />
                    {fuErrors.followUpTitle && <p className="text-[10px] text-destructive font-medium">{fuErrors.followUpTitle}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="input-datetime-local-22" className="text-xs font-bold uppercase text-muted-foreground">Date & Time *</label>
                    <DateTimePicker
                      id="input-datetime-local-22"
                      value={followUpDate || ""}
                      onChange={val => {
                        setFollowUpDate(val);
                        if (val) setFuErrors(prev => ({ ...prev, date: "" }));
                      }}
                      className={fuErrors.date ? "border-destructive focus:ring-destructive/20" : ""}
                    />
                    {fuErrors.date && <p className="text-[10px] text-destructive font-medium">{fuErrors.date}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4 items-start">
                    <div className="space-y-1.5">
                      <label htmlFor="follow-up-type" className="text-xs font-bold uppercase text-muted-foreground">Type</label>
                      <select
                          id="follow-up-type"
                          name="follow-up-type" className="input-field dark:bg-card" value={followUpType} onChange={e => setFollowUpType(e.target.value)}>
                        <option value="Call">Call</option>
                        <option value="Email">Email</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Task">Task</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="select-field-24" className="text-xs font-bold uppercase text-muted-foreground">Priority (optional)</label>
                      <select
                          id="select-field-24"
                          name="select-field-24" className="input-field dark:bg-card" value={followUpPriority || ""} onChange={e => setFollowUpPriority(e.target.value)}>
                        <option value="">NO</option>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                      {(!followUpPriority || followUpPriority === "") && (
                        <p className="text-xs text-muted-foreground mt-1">The Priority is not required</p>
                      )}
                    </div>
                  </div>



                  <div className="space-y-1.5">
                    <label htmlFor="reason-for-follow-up" className="text-xs font-bold uppercase text-muted-foreground">Follow-up Notes</label>
                    <textarea
                        id="reason-for-follow-up"
                        name="reason-for-follow-up"
                    
                      placeholder="Reason for follow-up"
                      className="input-field min-h-[60px]"
                      value={followUpNotes}
                      onChange={e => setFollowUpNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="mt-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
                <p className="text-[10px] font-medium text-center">
                  <span className="font-bold uppercase mr-1">Important:</span>
                  Ensure you click <strong>'Log & Close'</strong> here to sync activity and save the recording.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t">
            <button
              className="btn-secondary"
              onClick={() => {
                setIsCallModalOpen(false);
                if (selectedLead) {
                  fetchDetails(selectedLead._id, true);
                  setTimeout(() => {
                    fetchDetails(selectedLead._id, true);
                  }, 2500);
                }
              }}
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              className={`btn-primary ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => logCall()}
            >
              {isSubmitting ? "Logging..." : "Log & Close"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Email Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={(open) => {
        setIsEmailModalOpen(open);
        if (!open) setEmailErrors({});
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-2xl dark:bg-card p-0 overflow-hidden !flex !flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0"><DialogTitle className="dark:text-foreground">Send Email</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0">
            <div className="grid gap-4">
              <div className="grid gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">To <span className="text-destructive">*</span></label>
                <input
                    id="input-field-26"
                    name="input-field-26"
                
                  className={`input-field text-sm ${emailErrors.to ? "border-destructive focus:ring-destructive/20" : ""}`}
                  placeholder={!emailData.to ? "No email on file — type recipient email..." : "Recipient email..."}
                  value={emailData.to || ""}
                  onChange={e => setEmailData({ ...emailData, to: e.target.value })}
                  autoFocus={!!emailData.to}
                />
                {!emailData.to && (
                  <p className="text-[10px] text-amber-500 font-medium mt-1 flex items-center gap-1">
                    ⚠️ This contact has no email saved. You can enter one above.
                  </p>
                )}
                {emailErrors.to && <p className="text-[10px] text-destructive font-medium mt-1">{emailErrors.to}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">CC <span className="text-muted-foreground text-xs">(optional)</span></label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[42px] bg-background border rounded-lg focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  {emailData.cc.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailData({ ...emailData, cc: emailData.cc.filter((_, i) => i !== index) });
                        }}
                        className="hover:bg-black/5 rounded-full p-0.5 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <input
                      id="cc-input"
                      name="cc-input"
                  
                    className="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px] placeholder:text-muted-foreground/50"
                    placeholder={emailData.cc.length === 0 ? "Add email and press Enter..." : ""}
                    value={ccInput}
                    onChange={e => {
                      setCcInput(e.target.value);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = ccInput.trim().replace(/,$/, '');
                        if (val && !emailData.cc.includes(val)) {
                          setEmailData({ ...emailData, cc: [...emailData.cc, val] });
                          setCcInput("");
                        }
                      } else if (e.key === 'Backspace' && !ccInput && emailData.cc.length > 0) {
                        setEmailData({ ...emailData, cc: emailData.cc.slice(0, -1) });
                      }
                    }}
                    onBlur={() => {
                      const val = ccInput.trim().replace(/,$/, '');
                      if (val && !emailData.cc.includes(val)) {
                        setEmailData({ ...emailData, cc: [...emailData.cc, val] });
                        setCcInput("");
                      }
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Subject <span className="text-destructive">*</span></label>
                <input
                    id="following-up"
                    name="following-up"
                
                  className={`input-field ${emailErrors.subject ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                  placeholder="Following up"
                  value={emailData.subject}
                  onChange={e => {
                    setEmailData({ ...emailData, subject: e.target.value });
                    if (e.target.value.trim()) setEmailErrors({ ...emailErrors, subject: "" });
                  }}
                />
                {emailErrors.subject && <p className="text-xs text-destructive font-medium">{emailErrors.subject}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Message Body <span className="text-destructive">*</span></label>
                <div className="[&_.ql-editor]:min-h-[200px]">
                  <ReactQuill
                    theme="snow"
                    value={emailData.body}
                    onChange={(content, delta, source, editor) => {
                      setEmailData({ ...emailData, body: content });
                      if (editor.getText().trim()) setEmailErrors({ ...emailErrors, body: "" });
                    }}
                    className="bg-card text-foreground"
                    placeholder="Type your message here..."
                  />
                </div>
                {emailErrors.body && <p className="text-xs text-destructive font-medium">{emailErrors.body}</p>}
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => {
              setIsEmailModalOpen(false);
              setEmailErrors({});
            }}>Cancel</button>
            <button
              className={`btn-primary flex items-center justify-center gap-2 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={sendQuickEmail}
              disabled={isSubmitting}
            >
              <Send size={16} /> {isSubmitting ? "Sending..." : "Send via Gmail"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Modal */}
      <Dialog open={isSmsModalOpen} onOpenChange={(open) => {
        setIsSmsModalOpen(open);
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0"><DialogTitle className="dark:text-foreground">Send SMS</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0">
            <div className="grid gap-4">
              <div className="grid gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">To</label>
                <div className="p-2 bg-accent/30 rounded border text-sm">{selectedLead?.contacts?.[0]?.name || selectedLead?.name || 'Unknown'} ({selectedLead?.contacts?.[0]?.direct_phone || selectedLead?.telephone})</div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
                <textarea
                    id="type-your-sms-message"
                    name="type-your-sms-message"
                
                  className={`input-field min-h-[120px]`}
                  placeholder="Type your SMS message..."
                  value={smsMessage}
                  onChange={e => {
                    setSmsMessage(e.target.value);
                  }}
                />
                <div className="flex justify-between items-center">
                  <span />
                  <p className="text-xs text-muted-foreground">{smsMessage.length} chars (approx {Math.ceil((smsMessage.length || 1) / 160)} SMS)</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => {
              setIsSmsModalOpen(false);
            }}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary flex items-center justify-center gap-2 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={sendQuickSms}
            >
              <MessageSquare size={16} /> {isSubmitting ? "Sending..." : "Send SMS"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Modal */}
      <Dialog open={isMeetingModalOpen} onOpenChange={(open) => {
        setIsMeetingModalOpen(open);
        if (!open) setMeetingErrors({});
      }}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-md dark:bg-card p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0"><DialogTitle className="dark:text-foreground">Schedule Meeting</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            <div className="p-6 py-4 grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Meeting Title <span className="text-destructive">*</span></label>
                <input
                    id="e-g-initial-strategy-session"
                    name="e-g-initial-strategy-session"
                
                  className={`input-field ${meetingErrors.title ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}`}
                  placeholder="e.g. Initial Strategy Session"
                  value={meetingData.title}
                  onChange={e => {
                    setMeetingData({ ...meetingData, title: e.target.value });
                    if (e.target.value.trim()) setMeetingErrors({ ...meetingErrors, title: "" });
                  }}
                />
                {meetingErrors.title && <p className="text-xs text-destructive font-medium">{meetingErrors.title}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Date & Time <span className="text-destructive">*</span></label>
                <DateTimePicker
                  id="input-datetime-local-31"
                  value={meetingData.date_time || ""}
                  onChange={val => {
                    setMeetingData({ ...meetingData, date_time: val });
                    if (val) setMeetingErrors({ ...meetingErrors, date_time: "" });
                  }}
                  className={meetingErrors.date_time ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}
                />
                {meetingErrors.date_time && <p className="text-xs text-destructive font-medium">{meetingErrors.date_time}</p>}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Meeting Type</label>
                <select
                    id="select-field-32"
                    name="select-field-32" className="input-field dark:bg-card" value={meetingData.type} onChange={e => setMeetingData({ ...meetingData, type: e.target.value })}>
                  <option value="Virtual">Virtual (Google Meet)</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="In-Person">In-Person</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Invitees</label>
                <div className="p-2 bg-accent/30 rounded border text-xs text-foreground space-y-1">
                  <div>
                    Automatically inviting client: <strong>{selectedLead?.contacts?.[0]?.email || 'No email saved'}</strong>
                  </div>
                  {selectedLead?.assigned_to?.email && (
                    <div>
                      Automatically inviting team member: <strong>{selectedLead.assigned_to.email}</strong> ({selectedLead.assigned_to.name})
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">CC <span className="text-muted-foreground text-xs">(optional)</span></label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[42px] bg-background border rounded-lg focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  {meetingCc.map((email, index) => {
                    const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
                    const domain = email.split('@')[1];
                    const domainStatus = verifiedDomains[domain];
                    const isDomainInvalid = domainStatus && domainStatus.valid === false;

                    return (
                      <div
                        key={index}
                        onClick={() => {
                          setMeetingCcInput(email);
                          setMeetingCc(meetingCc.filter((_, i) => i !== index));
                        }}
                        title={isDomainInvalid ? `Warning: ${domainStatus.message}` : "Click to edit"}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium animate-in zoom-in-95 duration-200 cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${!isValid
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : isDomainInvalid
                            ? "bg-orange-500/10 text-orange-600 border border-orange-500/30"
                            : "bg-primary/10 text-primary border border-primary/20"
                          }`}
                      >
                        {email}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMeetingCc(meetingCc.filter((_, i) => i !== index));
                          }}
                          className="hover:bg-black/5 rounded-full p-0.5 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                  <input
                      id="meeting-cc-input"
                      name="meeting-cc-input"
                  
                    className="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px] placeholder:text-muted-foreground/50"
                    placeholder={meetingCc.length === 0 ? "Add email and press Enter..." : ""}
                    value={meetingCcInput}
                    onChange={e => {
                      setMeetingCcInput(e.target.value);
                      if (e.target.value.trim()) setMeetingErrors({ ...meetingErrors, cc: "" });
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = meetingCcInput.trim().replace(/,$/, '');
                        if (val && !meetingCc.includes(val)) {
                          setMeetingCc([...meetingCc, val]);
                          setMeetingCcInput("");
                          checkDomain(val);
                        }
                      } else if (e.key === 'Backspace' && !meetingCcInput && meetingCc.length > 0) {
                        setMeetingCc(meetingCc.slice(0, -1));
                      }
                    }}
                    onBlur={() => {
                      const val = meetingCcInput.trim().replace(/,$/, '');
                      if (val && !meetingCc.includes(val)) {
                        setMeetingCc([...meetingCc, val]);
                        setMeetingCcInput("");
                        checkDomain(val);
                      }
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                    id="agenda-or-location-details"
                    name="agenda-or-location-details" className="input-field min-h-[80px]" placeholder="Agenda or location details..." value={meetingData.notes} onChange={e => setMeetingData({ ...meetingData, notes: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => {
              setIsMeetingModalOpen(false);
              setMeetingCc([]);
              setMeetingCcInput("");
              setMeetingErrors({});
            }}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary flex items-center justify-center gap-2 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => scheduleQuickMeeting()}
            >
              <Video size={16} /> {isSubmitting ? "Scheduling..." : "Schedule & Send Invite"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Campaigns;








