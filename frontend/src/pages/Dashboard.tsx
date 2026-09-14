import { useEffect, useState, useRef } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { AlertCircle, Clock, Calendar, CheckCircle, Phone, Filter, Search, Plus, Building, Megaphone, Info, ArrowRight, Mail, Send, Globe, ChevronDown, ChevronLeft, ChevronRight, X, PhoneCall, Edit, Trash2, Sparkles, FileText, RefreshCw, TrendingUp, Flame, Sun, Snowflake, MessageSquare, CheckCircle2 } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCampaignStore } from "../store/campaignStore";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useDialerStore } from "../store/dialerStore";
import { can } from "../utils/permissions";
import { countryCodes } from "../utils/countryCodes";
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

interface Campaign {
  _id: string;
  name: string;
}

interface Lead {
  _id: string;
  name: string;
  type?: string;
  telephone?: string;
  city?: string;
  campaign_id?: string;
}

interface FollowUp {
  _id: string;
  title?: string;
  notes: string;
  date_time: string;
  type: string;
  priority: string;
  status: string;
  lead_id_val: string;
  lead_name: string; // lead name
  telephone?: string;
  campaign_name: string;
  campaign_id_val: string;
}

interface DashboardData {
  overdue: FollowUp[];
  due: FollowUp[];
  upcoming: FollowUp[];
  all: FollowUp[];
  totalCampaigns?: number;
  totalLeads?: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const isReadOnly = permissions.isReadOnly;
  const isSalesrepOrReadOnly = currentUser?.role === 'sales_rep' || currentUser?.role === 'view_only';
  const openDialer = useDialerStore(state => state.openDialer);
  const statsRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [rawData, setRawData] = useState<DashboardData | null>(null);
  const [pipelineData, setPipelineData] = useState<Record<string, number>>({});
  const [campaignSummaries, setCampaignSummaries] = useState<any[]>([]);
  const [activeTaskTab, setActiveTaskTab] = useState<"overdue" | "due" | "upcoming">("due");
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const { campaigns, setCampaigns } = useCampaignStore();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Weekly AI Performance Report State
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [isGeneratingWeeklyReport, setIsGeneratingWeeklyReport] = useState(false);
  const [isWeeklyReportModalOpen, setIsWeeklyReportModalOpen] = useState(false);
  const [loadingWeeklyReport, setLoadingWeeklyReport] = useState(true);

  const loadWeeklyReport = async () => {
    try {
      setLoadingWeeklyReport(true);
      const res = await api.get("/reports/weekly-ai-report/latest");
      if (res.data?.success && res.data?.report) {
        setWeeklyReport(res.data.report);
      }
    } catch (err) {
      console.error("Failed to load weekly AI report:", err);
    } finally {
      setLoadingWeeklyReport(false);
    }
  };

  const handleGenerateWeeklyReport = async () => {
    try {
      setIsGeneratingWeeklyReport(true);
      toast.info("Generating Weekly AI Performance Report with Claude...");
      const res = await api.post("/reports/weekly-ai-report/generate", { sendEmail: false });
      if (res.data?.success) {
        toast.success("Weekly AI Report regenerated and updated in database");
        setWeeklyReport(res.data.report);
      } else {
        toast.error(res.data?.message || "Failed to generate report");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error generating weekly report");
    } finally {
      setIsGeneratingWeeklyReport(false);
    }
  };

  const socket = useSocket();

  // Live SMS Action Panel State
  const [unreadSmsData, setUnreadSmsData] = useState<{
    totalUnreadCount: number;
    hotWarmCount?: number;
    hotWarmMessages?: any[];
    unreadMessages?: any[];
    recentMessages: any[];
  }>({ totalUnreadCount: 0, hotWarmCount: 0, hotWarmMessages: [], unreadMessages: [], recentMessages: [] });
  const [loadingUnreadSms, setLoadingUnreadSms] = useState(true);
  const [activeSmsTab, setActiveSmsTab] = useState<"hot_warm" | "all">("hot_warm");

  const loadUnreadSms = async () => {
    try {
      setLoadingUnreadSms(true);
      const res = await api.get("/sms/unread-count");
      if (res.data) {
        setUnreadSmsData(res.data);
      }
    } catch (err) {
      console.error("Failed to load unread SMS messages:", err);
    } finally {
      setLoadingUnreadSms(false);
    }
  };

  // Real-time socket listener for SMS action panel updates
  useEffect(() => {
    if (!socket?.socket) return;
    const s = socket.socket;
    const handleSmsUpdate = () => {
      loadUnreadSms();
    };
    s.on('sms:received', handleSmsUpdate);
    s.on('sms:sent', handleSmsUpdate);
    s.on('lead:score_updated', handleSmsUpdate);
    return () => {
      s.off('sms:received', handleSmsUpdate);
      s.off('sms:sent', handleSmsUpdate);
      s.off('lead:score_updated', handleSmsUpdate);
    };
  }, [socket?.socket]);

  // New Follow-up Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadSearchIndex, setLeadSearchIndex] = useState(-1);
  const [selectedLeadResult, setSelectedLeadResult] = useState<Lead | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpType, setFollowUpType] = useState("Task");
  const [followUpPriority, setFollowUpPriority] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("Answered - Interested");
  const [callDuration, setCallDuration] = useState("");
  const [assignedTo, setAssignedTo] = useState("self");
  const [customAssignedTo, setCustomAssignedTo] = useState("");

  // New Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<any>(null);
  const [emailData, setEmailData] = useState({ subject: "", body: "", cc: [] as string[] });
  const [ccInput, setCcInput] = useState("");
  const [verifiedDomains, setVerifiedDomains] = useState<Record<string, { valid: boolean; message?: string }>>({});
  const [leadContacts, setLeadContacts] = useState<any[]>([]);

  const checkDomain = async (email: string) => {
    const domain = email.split('@')[1];
    if (!domain || verifiedDomains[domain]) return;

    try {
      const res = await api.get(`/emails/verify-domain?email=${email}`);
      setVerifiedDomains(prev => ({ ...prev, [domain]: { valid: res.data.valid, message: res.data.message } }));
    } catch { }
  };
  const [selectedContactEmail, setSelectedContactEmail] = useState("");

  // Global Search State
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Lead[]>([]);
  const [globalSearchIndex, setGlobalSearchIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isConfirmDoneOpen, setIsConfirmDoneOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<string | null>(null);
  const [quickFollowUpErrors, setQuickFollowUpErrors] = useState<Record<string, string>>({});
  // Follow-up editing states
  const [isFollowUpEditModalOpen, setIsFollowUpEditModalOpen] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("pending");
  const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [followUpToDelete, setFollowUpToDelete] = useState<string | null>(null);
  const [quickEmailErrors, setQuickEmailErrors] = useState<Record<string, string>>({});
  const [phonePrefix, setPhonePrefix] = useState("+1");
  const [campaignPage, setCampaignPage] = useState(0);
  const CAMPAIGNS_PER_PAGE = 5;
  const [smsPage, setSmsPage] = useState(0);
  const SMS_PER_PAGE = 5;

  const initiateCall = (leadToCall: Lead) => {
    if (isReadOnly) return;
    const phone = leadToCall.telephone;
    if (phone) {
      const cleanPhone = phone.startsWith('+') ? phone : `${phonePrefix}${phone.replace(/\D/g, '')}`;
      openDialer(cleanPhone, leadToCall._id, leadToCall.name || 'Unknown', true);
    }
    // Form already shows outcome/notes fields
    setFollowUpType("Call");
  };

  const load = async () => {
    try {
      const campaignId = selectedCampaign === "all" ? "" : selectedCampaign;
      const [resConsolidated, resDetailedFollowups] = await Promise.all([
        api.get(`/dashboard${campaignId ? `?campaignId=${campaignId}` : ""}`),
        api.get("/followups/dashboard")
      ]);

      setDashboardMetrics(resConsolidated.data);
      setRawData(resDetailedFollowups.data);
      setCampaignSummaries(resConsolidated.data.campaignSummaries);

      if (campaignId) {
        const breakdown: Record<string, number> = {};
        resConsolidated.data.leads.byStatus.forEach((s: any) => {
          breakdown[s.status] = s.count;
        });
        setPipelineData(breakdown);
      } else {
        setPipelineData({});
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadWeeklyReport();
    loadUnreadSms();
    if (searchParams.get("action") === "new-followup") {
      setIsModalOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams);
    }
  }, [searchParams, selectedCampaign]);

  useEffect(() => {
    if ((isModalOpen || isEmailModalOpen)) {
      if (leadSearch.length >= 1) {
        api.get(`/leads?q=${leadSearch}&limit=50`).then(r => {
          setLeads(r.data.data ?? r.data);
          setLeadSearchIndex(-1);
        });
      } else {
        setLeads([]);
        setLeadSearchIndex(-1);
      }
    }
  }, [leadSearch, isModalOpen, isEmailModalOpen]);

  useEffect(() => {
    if (selectedLeadForEmail) {
      api.get(`/leads/${selectedLeadForEmail._id}`).then(res => {
        const contacts = res.data.contacts || [];
        setLeadContacts(contacts);
        if (contacts.length > 0) {
          setSelectedContactEmail(contacts[0].email);
        }
      });
    }
  }, [selectedLeadForEmail]);

  useEffect(() => {
    if (globalSearchIndex >= 0) {
      const el = document.getElementById(`global-search-item-${globalSearchIndex}`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [globalSearchIndex]);

  useEffect(() => {
    if (leadSearchIndex >= 0) {
      const el = document.getElementById(`modal-search-item-${leadSearchIndex}`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [leadSearchIndex]);

  useEffect(() => {
    if (globalSearch.length >= 2) {
      api.get(`/leads?q=${globalSearch}&limit=5`).then(r => {
        setGlobalSearchResults(r.data.data ?? r.data);
        setGlobalSearchIndex(-1);
      });
    } else {
      setGlobalSearchResults([]);
      setGlobalSearchIndex(-1);
    }
  }, [globalSearch]);

  const markDone = async (id: string) => {
    setTaskToComplete(id);
    setIsConfirmDoneOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!taskToComplete) return;
    try {
      await api.put(`/followups/${taskToComplete}/complete`);
      toast.success("Follow-up marked as done");
      setIsConfirmDoneOpen(false);
      setTaskToComplete(null);
      load();
    } catch { }
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
    setQuickFollowUpErrors({});
    setIsFollowUpEditModalOpen(true);
  };

  const handleDeleteFollowUp = (fuId: string) => {
    setFollowUpToDelete(fuId);
  };

  const confirmDeleteFollowUp = async () => {
    if (!followUpToDelete) return;
    try {
      await api.delete(`/followups/${followUpToDelete}`);
      toast.success("Follow-up deleted");
      load();
    } catch (err) {
      toast.error("Failed to delete follow-up");
    } finally {
      setFollowUpToDelete(null);
    }
  };

  const submitEditFollowUp = async (force = false) => {
    if (isSubmitting) return;
    const errors: Record<string, string> = {};

    if (!followUpDate) {
      errors.date = "Date and time are required";
    }

    if (!followUpNotes.trim()) {
      errors.notes = "Please provide notes/instructions";
    }

    if (Object.keys(errors).length > 0) {
      setQuickFollowUpErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: followUpTitle.trim(),
        date_time: new Date(followUpDate).toISOString(),
        type: followUpType,
        priority: followUpPriority,
        notes: followUpNotes,
        status: followUpStatus,
        force
      };

      await api.put(`/followups/${editingFollowUp._id}`, payload);
      toast.success("Follow-up updated");
      setIsFollowUpEditModalOpen(false);
      setEditingFollowUp(null);
      setFollowUpTitle("");
      load();
    } catch (err: any) {
      if (err.response?.status === 409) {
        const conflicts = err.response.data.conflicts || [];
        const conflictNames = conflicts.map((c: any) => c.summary).join(", ");
        if (window.confirm(`Conflict detected: "${conflictNames || 'Existing Event'}". Update anyway?`)) {
          setIsSubmitting(false);
          submitEditFollowUp(true);
          return;
        }
      } else {
        toast.error(err.response?.data?.message || "Failed to update follow-up");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitFollowUp = async (force = false) => {
    const errors: Record<string, string> = {};
    if (!selectedLeadResult) errors.lead = "Please select a lead first";
    if (!followUpDate) errors.date = "Follow-up date is required";

    if (Object.keys(errors).length > 0) {
      setQuickFollowUpErrors(errors);
      toast.error("Please fill all follow-up details");
      return;
    }

    try {
      // 1. Log the call activity first if an outcome is selected
      if (callOutcome) {
          try {
              await api.post(`/voice/log-call`, {
                  lead_id: selectedLeadResult?._id,
                  outcome: callOutcome,
                  notes: followUpNotes,
                  contact_name: selectedLeadResult?.name || 'Unknown',
                  callSid: useDialerStore.getState().activeCallSid || null
              });
          } catch (e) {
              console.error("Failed to log call activity:", e);
          }
      }

      // 2. Schedule the follow-up
      await api.post(`/followups/${selectedLeadResult?._id}`, {
        date_time: followUpDate,
        type: followUpType,
        priority: followUpPriority,
        notes: followUpNotes,
        assigned_to: assignedTo === "other" ? customAssignedTo : assignedTo,
        force
      });
      toast.success("Activity logged & Follow-up scheduled");
      setIsModalOpen(false);
      resetFollowUpForm();
      load();
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

  const resetFollowUpForm = () => {
    setSelectedLeadResult(null);
    setLeadSearch("");
    setFollowUpDate("");
    setFollowUpType("Call");
    setFollowUpPriority("");
    setFollowUpNotes("");
    setAssignedTo("self");
    setCustomAssignedTo("");
    setQuickFollowUpErrors({});
  };

  const sendQuickEmail = async () => {
    const errors: Record<string, string> = {};
    if (!selectedLeadForEmail) errors.lead = "Please select a lead first";
    else if (!selectedContactEmail) errors.contact = "Please select a recipient email";

    if (!emailData.subject.trim()) errors.subject = "Subject is required";
    if (!emailData.body.trim()) errors.body = "Message body is required";

    if (Object.keys(errors).length > 0) {
      setQuickEmailErrors(errors);
      toast.error("Please fill all email details");
      return;
    }

    try {
      await api.post("/emails/send", {
        lead_id: selectedLeadForEmail?._id,
        to: selectedContactEmail,
        cc: emailData.cc.join(", "),
        subject: emailData.subject,
        body: emailData.body
      });
      toast.success("Email sent successfully");
      setIsEmailModalOpen(false);
      setSelectedLeadForEmail(null);
      setEmailData({ subject: "", body: "", cc: [] });
      setCcInput("");
      setQuickEmailErrors({});
      load();
    } catch { }
  };

  // Filter list for the detailed panels
  const filterList = (list: FollowUp[]) => {
    if (selectedCampaign === "all") return list;
    return list.filter(f => String(f.campaign_id_val) === selectedCampaign);
  };

  const filteredData = rawData ? {
    overdue: filterList(rawData.overdue),
    due: filterList(rawData.due),
    upcoming: filterList(rawData.upcoming),
    all: filterList(rawData.all)
  } : null;

  const StatCard = ({ title, count, icon: Icon, color }: { title: string; count: number; icon: any; color: string }) => (
    <div className="stat-card border-none bg-accent/20 dark:bg-card/40 flex flex-col items-center text-center p-6 transition-all hover:bg-accent/30">
      <div className="w-10 h-10 rounded-full bg-background dark:bg-background/20 flex items-center justify-center mb-3">
        <Icon size={20} className={color} />
      </div>
      <div className="text-2xl font-bold text-foreground">{count}</div>
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-1">{title}</span>
    </div>
  );

  const hasDraftData = 
    selectedLeadResult !== null || 
    leadSearch.trim().length > 0 || 
    followUpNotes.trim().length > 0 || 
    followUpDate.trim().length > 0 ||
    followUpPriority !== "";

  // Resilient weekly AI stats extraction (supports both direct and nested schemas)
  const weeklyStats = weeklyReport?.rawStats || {};
  const reportTotalLeads = weeklyStats.totalLeads ?? weeklyStats.leads?.total ?? 0;
  const reportNewLeads7d = weeklyStats.newLeadsThisWeek ?? weeklyStats.leads?.newInLast7Days ?? 0;
  const reportFollowupsDone = weeklyStats.followupStats?.completedLast7Days ?? weeklyStats.followups?.completedLast7Days ?? 0;
  const reportOverduePending = weeklyStats.followupStats?.overduePending ?? weeklyStats.followups?.overdue ?? 0;

  const eaByScore = weeklyStats.eaLeads?.byScore || [];
  const reportHotLeads = weeklyStats.eaStats?.hotLeads ?? (eaByScore.find((s: any) => String(s.score).toLowerCase() === 'hot')?.count || 0);
  const reportWarmLeads = weeklyStats.eaStats?.warmLeads ?? (eaByScore.find((s: any) => String(s.score).toLowerCase() === 'warm')?.count || 0);
  const reportColdLeads = weeklyStats.eaStats?.coldLeads ?? (eaByScore.find((s: any) => String(s.score).toLowerCase() === 'cold')?.count || 0);
  const reportStalledLeads = weeklyStats.eaStats?.stalledCount ?? weeklyStats.eaLeads?.stalled ?? 0;
  const reportHotWarmTotal = reportHotLeads + reportWarmLeads;

  const weeklyNarrativePreview = weeklyReport?.executiveSummary
    ? weeklyReport.executiveSummary.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim()
    : 'No narrative available.';

  const getRelativeTime = (timestamp?: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHrs > 0) return `${diffHrs}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return "just now";
  };

  const tempMetrics = (dashboardMetrics as any)?.temperature;
  const hotCount = tempMetrics?.ea?.hot ?? tempMetrics?.hot ?? reportHotLeads;
  const warmCount = tempMetrics?.ea?.warm ?? tempMetrics?.warm ?? reportWarmLeads;
  const coldCount = tempMetrics?.ea?.cold ?? tempMetrics?.cold ?? reportColdLeads;
  const totalTempLeads = tempMetrics?.ea?.total ?? (hotCount + warmCount + coldCount);
  const hotPercentage = totalTempLeads > 0 ? Math.round((hotCount / totalTempLeads) * 100) : 0;
  const warmPercentage = totalTempLeads > 0 ? Math.round((warmCount / totalTempLeads) * 100) : 0;
  const coldPercentage = totalTempLeads > 0 ? Math.max(0, 100 - hotPercentage - warmPercentage) : 0;

  // Filter only EA leads for the Live SMS Action Panel
  const allEaMessages = (unreadSmsData.hotWarmMessages && unreadSmsData.hotWarmMessages.length > 0)
    ? unreadSmsData.hotWarmMessages.filter((m: any) => m.leadType === "ea" || m.leadType === "ea_lead")
    : (unreadSmsData.recentMessages || []).filter((m: any) => m.leadType === "ea" || m.leadType === "ea_lead");

  const hotWarmList = allEaMessages.filter((m: any) => m.aiScore === 'Hot' || m.aiScore === 'Warm');
  const unreadList = (unreadSmsData.unreadMessages || []).filter((m: any) => m.leadType === "ea" || m.leadType === "ea_lead");

  const displayedSmsList = activeSmsTab === "hot_warm"
    ? (hotWarmList.length > 0 ? hotWarmList : allEaMessages)
    : allEaMessages;

  const totalSmsPages = Math.ceil(displayedSmsList.length / SMS_PER_PAGE) || 1;
  const paginatedSmsList = displayedSmsList.slice(smsPage * SMS_PER_PAGE, (smsPage + 1) * SMS_PER_PAGE);

  if (loading) return <AppLayout><div className="p-12 text-center animate-pulse">Loading dashboard...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="bg-card border rounded-2xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => !isSalesrepOrReadOnly && navigate("/campaigns?action=new-campaign")}
              className={`bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 ${isSalesrepOrReadOnly ? "opacity-50 blur-[0.5px] pointer-events-none" : ""}`}
              title="Create New Campaign"
              disabled={isSalesrepOrReadOnly}
            >
              <Plus size={18} /> Create New Campaign
            </button>
            <button
              onClick={() => !isSalesrepOrReadOnly && setIsModalOpen(true)}
              className={`btn-secondary h-11 px-6 font-semibold flex items-center justify-center gap-2 ${isSalesrepOrReadOnly ? "opacity-50 blur-[0.5px] pointer-events-none" : ""}`}
              title="Schedule New Follow-Up"
              disabled={isSalesrepOrReadOnly}
            >
              <Clock size={18} /> New Follow-Up
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                  id="search-leads-across-all-campaigns"
                  name="search-leads-across-all-campaigns"
              
                placeholder="Search leads across all campaigns..."
                className="input-field pl-10 h-11"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setGlobalSearchIndex(prev => (prev < globalSearchResults.length - 1 ? prev + 1 : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setGlobalSearchIndex(prev => (prev > 0 ? prev - 1 : globalSearchResults.length - 1));
                  } else if (e.key === 'Enter') {
                    if (globalSearchIndex >= 0 && globalSearchResults[globalSearchIndex]) {
                      navigate(`/lead/${globalSearchResults[globalSearchIndex]._id}`);
                      setIsSearchFocused(false);
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchFocused(false);
                  }
                }}
              />

              {isSearchFocused && globalSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-xl z-50 overflow-hidden divide-y">
                  {globalSearchResults.map((l, index) => (
                    <button
                      key={l._id}
                      id={`global-search-item-${index}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigate(`/lead/${l._id}`);
                      }}
                      className={`w-full text-left p-3 flex items-center justify-between transition-colors ${index === globalSearchIndex ? 'bg-accent border-l-4 border-l-primary' : 'hover:bg-accent'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-sm font-bold text-foreground">{l.name}</p>
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                            {campaigns.find(c => c._id === (l as any).campaign_id)?.name || "Lead"}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase mt-1">
                          {l.type ? <span className="font-bold text-primary/80">{l.type} • </span> : ''}
                          {l.telephone || "No Phone"} {l.city ? `• ${l.city}` : ''}
                        </p>
                      </div>
                      <ArrowRight size={14} className={index === globalSearchIndex ? "text-primary translate-x-1 transition-transform" : "text-muted-foreground"} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 h-11 px-3 bg-accent/30 border rounded-xl min-w-[150px]">
              <Filter size={14} className="text-muted-foreground" />
              <select
                  id="selected-campaign"
                  name="selected-campaign"
              
                className="bg-transparent text-xs font-bold uppercase tracking-wider focus:outline-none flex-1"
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
              >
                <option className="dark:bg-accent" value="all">All Campaigns</option>
                {campaigns.map(c => (
                  <option className="dark:bg-accent" key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>


      {/* Lead Temperature Pipeline Section */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm mb-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 text-rose-500 flex items-center justify-center shadow-inner">
              <Flame size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Lead Temperature Pipeline</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent text-muted-foreground border">
                  {totalTempLeads} Active Leads
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time engagement breakdown across Hot, Warm, and Cold outreach
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Hot ({hotPercentage}%)</span>
            <span className="flex items-center gap-1.5 ml-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Warm ({warmPercentage}%)</span>
            <span className="flex items-center gap-1.5 ml-2"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Cold ({coldPercentage}%)</span>
          </div>
        </div>

        {/* Segmented Pipeline Progress Gauge */}
        <div className="h-3 w-full bg-accent/40 rounded-full overflow-hidden flex p-0.5 gap-1 mb-5">
          <div
            style={{ width: `${hotPercentage}%` }}
            className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-700"
            title={`Hot Leads: ${hotCount} (${hotPercentage}%)`}
          />
          <div
            style={{ width: `${warmPercentage}%` }}
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
            title={`Warm Leads: ${warmCount} (${warmPercentage}%)`}
          />
          <div
            style={{ width: `${coldPercentage}%` }}
            className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-700"
            title={`Cold Leads: ${coldCount} (${coldPercentage}%)`}
          />
        </div>

        {/* 3 Interactive Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Hot Card */}
          <div
            onClick={() => navigate("/ea-leads?score=Hot")}
            className="group cursor-pointer bg-gradient-to-br from-rose-500/5 via-card to-card border border-rose-500/20 hover:border-rose-500/50 rounded-2xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Flame size={14} className="text-rose-500" /> Hot Leads
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Immediate Action
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-3">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">{hotCount}</span>
              <span className="text-xs font-semibold text-rose-500">{hotPercentage}% of pipeline</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Ready for meeting / high intent</span>
              <ArrowRight size={13} className="text-muted-foreground group-hover:text-rose-500 group-hover:translate-x-1 transition-all" />
            </p>
          </div>

          {/* Warm Card */}
          <div
            onClick={() => navigate("/ea-leads?score=Warm")}
            className="group cursor-pointer bg-gradient-to-br from-amber-500/5 via-card to-card border border-amber-500/20 hover:border-amber-500/50 rounded-2xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Sun size={14} className="text-amber-500" /> Warm Leads
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Nurture
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-3">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">{warmCount}</span>
              <span className="text-xs font-semibold text-amber-500">{warmPercentage}% of pipeline</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Engaged & asking questions</span>
              <ArrowRight size={13} className="text-muted-foreground group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
            </p>
          </div>

          {/* Cold Card */}
          <div
            onClick={() => navigate("/ea-leads?score=Cold")}
            className="group cursor-pointer bg-gradient-to-br from-sky-500/5 via-card to-card border border-sky-500/20 hover:border-sky-500/50 rounded-2xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Snowflake size={14} className="text-sky-500" /> Cold Leads
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                Re-engage
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-3">
              <span className="text-3xl font-extrabold text-foreground tracking-tight">{coldCount}</span>
              <span className="text-xs font-semibold text-sky-500">{coldPercentage}% of pipeline</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>New or stalled outreach</span>
              <ArrowRight size={13} className="text-muted-foreground group-hover:text-sky-500 group-hover:translate-x-1 transition-all" />
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Operational Column */}
        <div className="flex-1 lg:w-[65%] min-w-0 space-y-6">
          <div className="page-card dark:bg-card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">Campaign Acquisition Overview</h2>
              
              {campaigns.length > CAMPAIGNS_PER_PAGE && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setCampaignPage(p => Math.max(0, p - 1))}
                    disabled={campaignPage === 0}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${campaignPage === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'}`}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                    {campaignPage + 1} / {Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                  </span>
                  <button 
                    onClick={() => setCampaignPage(p => (p + 1 < Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? p + 1 : p))}
                    disabled={campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'}`}
                  >
                    <ChevronRight size={16} className="text-emerald-500" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {campaigns.slice(campaignPage * CAMPAIGNS_PER_PAGE, (campaignPage + 1) * CAMPAIGNS_PER_PAGE).map(c => {
                const summary = campaignSummaries.find(s => s._id === c._id) || { totalLeads: 0, meetingsScheduled: 0 };
                const followUpsDue = rawData?.all?.filter(f => String(f.campaign_id_val) === c._id).length || 0;
                return (
                  <div key={c._id} className="group relative bg-accent/10 dark:bg-accent/5 rounded-2xl p-4 transition-all hover:bg-accent/20 border border-transparent hover:border-primary/20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate text-base">{c.name}</h3>
                        <div className="grid grid-cols-3 gap-6 mt-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Leads</span>
                            <span className="text-sm font-semibold">{summary.totalLeads}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Meetings</span>
                            <span className="text-sm font-semibold text-primary">{summary.meetingsScheduled}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Follow-ups</span>
                            <span className="text-sm font-semibold">{followUpsDue}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCampaign(c._id);
                          statsRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-10 h-10 rounded-full bg-background dark:bg-card border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm"
                        title="View Campaign Details"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {campaigns.length > CAMPAIGNS_PER_PAGE && (
              <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-border/50">
                <button 
                  onClick={() => setCampaignPage(p => Math.max(0, p - 1))}
                  disabled={campaignPage === 0}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${campaignPage === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'}`}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  PAGE {campaignPage + 1} OF {Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                </span>
                <button 
                  onClick={() => setCampaignPage(p => (p + 1 < Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? p + 1 : p))}
                  disabled={campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all ${campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'}`}
                >
                  <ChevronRight size={18} className="text-emerald-500" />
                </button>
              </div>
            )}
          </div>

          <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="Total Campaigns" count={dashboardMetrics?.campaigns?.total || 0} icon={Megaphone} color="text-primary" />
            <StatCard title="Total Leads" count={dashboardMetrics?.leads?.total || 0} icon={Building} color="text-blue-500" />
            <StatCard title="Overdue" count={dashboardMetrics?.followups?.overdue || 0} icon={AlertCircle} color="text-primary/70" />
            <StatCard title="Due Today" count={dashboardMetrics?.followups?.dueToday || 0} icon={Clock} color="text-primary/70" />
            <StatCard title="Upcoming" count={dashboardMetrics?.followups?.upcoming || 0} icon={Calendar} color="text-primary/70" />
          </div>

          {/* Strategic Pipeline Section Restored */}
          <div className="page-card dark:bg-card">
            <h2 className="text-lg font-bold text-foreground mb-6">Strategic Pipeline</h2>
            {selectedCampaign === "all" ? (
              <div className="p-8 text-center border-2 border-dashed rounded-2xl">
                <p className="text-sm text-muted-foreground">Select a campaign to view the strategic pipeline visualization.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(dashboardMetrics?.pipeline?.statusBreakdown || []).map((s: any) => {
                  const count = s.count || 0;
                  const total = dashboardMetrics?.leads?.total || 1;
                  const percentage = Math.round((count / total) * 100);
                  const getColor = (label: string) => {
                    const l = label.toLowerCase();
                    if (l.includes("not contacted")) return "bg-muted-foreground/20";
                    if (l.includes("attempted")) return "bg-orange-400";
                    if (l.includes("voicemail")) return "bg-orange-500";
                    if (l.includes("office") || l.includes("staff") || l.includes("spoke")) return "bg-blue-400";
                    if (l.includes("meeting")) return "bg-emerald-500";
                    if (l.includes("proposal") || l.includes("info sent")) return "bg-indigo-500";
                    if (l.includes("signed") || l.includes("active")) return "bg-primary";
                    if (l.includes("not interested") || l.includes("lost")) return "bg-destructive/40";
                    return "bg-primary/40";
                  };
                  return (
                    <div key={s.status} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getColor(s.status)}`} />
                          {s.status}
                        </span>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs font-bold">{count}</span>
                          <span className="text-[10px] text-muted-foreground">({percentage}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-accent dark:bg-accent/20 rounded-full overflow-hidden">
                        <div className={`h-full ${getColor(s.status)} transition-all duration-1000`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly AI Executive Briefing Snapshot */}
          <div className="bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground">Weekly AI Executive Briefing</h2>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Claude AI
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {weeklyReport ? (
                      <>
                        Week of {new Date(weeklyReport.weekStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(weeklyReport.weekEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • Sent to {weeklyReport.recipient || "play@yausports.com"}
                      </>
                    ) : (
                      "Automated weekly intelligence summary generated every Monday at 8:00 AM EST"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {weeklyReport && (
                  <button
                    onClick={() => setIsWeeklyReportModalOpen(true)}
                    className="btn-secondary text-xs h-9 px-3.5 font-semibold flex items-center gap-1.5 hover:border-primary/40"
                  >
                    <FileText size={14} /> View Full Report
                  </button>
                )}
                {!isSalesrepOrReadOnly && (
                  <button
                    onClick={handleGenerateWeeklyReport}
                    disabled={isGeneratingWeeklyReport}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-9 px-3.5 rounded-xl font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-primary/20 disabled:opacity-50"
                    title="Regenerate latest report and update database"
                  >
                    <RefreshCw size={13} className={isGeneratingWeeklyReport ? "animate-spin" : ""} />
                    {isGeneratingWeeklyReport ? "Analyzing..." : "Regenerate"}
                  </button>
                )}
              </div>
            </div>

            {loadingWeeklyReport ? (
              <div className="py-8 text-center text-sm text-muted-foreground animate-pulse flex items-center justify-center gap-2">
                <Sparkles size={16} className="text-primary animate-spin" /> Loading executive briefing...
              </div>
            ) : weeklyReport ? (
              <div className="pt-4 space-y-4">
                {/* Highlight KPI pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-background/60 dark:bg-background/40 border rounded-xl p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Leads (7d)</span>
                    <p className="text-xl font-extrabold text-foreground mt-0.5">
                      {reportNewLeads7d}
                    </p>
                  </div>
                  <div className="bg-background/60 dark:bg-background/40 border rounded-xl p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total In Pipeline</span>
                    <p className="text-xl font-extrabold text-primary mt-0.5">
                      {reportTotalLeads}
                    </p>
                  </div>
                  <div className="bg-background/60 dark:bg-background/40 border rounded-xl p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Follow-Ups Done</span>
                    <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {reportFollowupsDone}
                    </p>
                  </div>
                  <div className="bg-background/60 dark:bg-background/40 border rounded-xl p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hot / Warm EA</span>
                    <p className="text-xl font-extrabold text-amber-500 mt-0.5">
                      {reportHotWarmTotal}
                    </p>
                  </div>
                </div>

                {/* Narrative Preview */}
                <div className="bg-background/40 border rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                  <div className="line-clamp-3">
                    {weeklyNarrativePreview}
                  </div>
                  <button
                    onClick={() => setIsWeeklyReportModalOpen(true)}
                    className="text-primary font-bold hover:underline mt-2 inline-flex items-center gap-1"
                  >
                    Read full executive synthesis & action items <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  No weekly executive briefing has been generated yet. It runs automatically every Monday at 8:00 AM EST, or you can generate the first edition right now.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Operational Column */}
        <div className="w-full lg:w-[35%] space-y-6">
          {/* Live SMS Action Panel (Mini-Inbox) */}
          <div className="page-card dark:bg-card p-0 overflow-hidden border border-primary/20 shadow-sm">
            <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-card to-primary/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Live SMS Action Panel</h2>
                  <p className="text-[10px] text-muted-foreground">EA leads live engagement</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {displayedSmsList.length > SMS_PER_PAGE && (
                  <div className="flex items-center gap-1.5 mr-1">
                    <button 
                      onClick={() => setSmsPage(p => Math.max(0, p - 1))}
                      disabled={smsPage === 0}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                        smsPage === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'
                      }`}
                      title="Previous Page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                      {smsPage + 1} / {totalSmsPages}
                    </span>
                    <button 
                      onClick={() => setSmsPage(p => (p + 1 < totalSmsPages ? p + 1 : p))}
                      disabled={smsPage + 1 >= totalSmsPages}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                        smsPage + 1 >= totalSmsPages ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'
                      }`}
                      title="Next Page"
                    >
                      <ChevronRight size={14} className="text-emerald-500" />
                    </button>
                  </div>
                )}
                <button
                  onClick={loadUnreadSms}
                  disabled={loadingUnreadSms}
                  className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  title="Refresh SMS activity"
                >
                  <RefreshCw size={13} className={loadingUnreadSms ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Hot & Warm vs All EA Leads */}
            <div className="flex border-b text-xs font-semibold bg-accent/10">
              <button
                onClick={() => { setActiveSmsTab("hot_warm"); setSmsPage(0); }}
                className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  activeSmsTab === "hot_warm"
                    ? "border-rose-500 text-rose-600 dark:text-rose-400 bg-background/50 font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Flame size={13} className="text-rose-500" />
                <span>Hot & Warm</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 font-bold ml-1">
                  {hotWarmList.length}
                </span>
              </button>
              <button
                onClick={() => { setActiveSmsTab("all"); setSmsPage(0); }}
                className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  activeSmsTab === "all"
                    ? "border-primary text-primary bg-background/50 font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare size={13} />
                <span>All EA Leads</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold ml-1">
                  {allEaMessages.length}
                </span>
              </button>
            </div>

            <div className="p-3 space-y-2">
              {loadingUnreadSms ? (
                <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
                  Checking for live SMS activity...
                </div>
              ) : paginatedSmsList && paginatedSmsList.length > 0 ? (
                paginatedSmsList.map((msg: any, idx: number) => {
                  const isHot = msg.aiScore === "Hot";
                  const isWarm = msg.aiScore === "Warm";
                  return (
                    <div
                      key={msg.leadId || idx}
                      className={`p-3 rounded-xl border bg-accent/10 hover:bg-accent/20 transition-all border-l-4 flex items-center justify-between gap-3 group ${
                        isHot ? "border-l-rose-500 bg-rose-500/5" : isWarm ? "border-l-amber-500 bg-amber-500/5" : "border-l-sky-500 bg-sky-500/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground truncate">{msg.senderName}</span>
                          {msg.unreadCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Unread replies" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {isHot && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <Flame size={12} className="text-rose-500" /> Hot
                          </span>
                        )}
                        {isWarm && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Sun size={12} className="text-amber-500" /> Warm
                          </span>
                        )}
                        {!isHot && !isWarm && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            <Snowflake size={12} className="text-sky-500" /> Cold
                          </span>
                        )}
                        <button
                          onClick={() => navigate(`/sms?leadId=${msg.leadId}`)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm shadow-primary/20 transition-all active:scale-95"
                          title="Open SMS conversation"
                        >
                          <Send size={11} /> Reply
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 px-4 text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${
                    activeSmsTab === "hot_warm" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                  }`}>
                    {activeSmsTab === "hot_warm" ? <Flame size={20} /> : <CheckCircle2 size={20} />}
                  </div>
                  <p className="text-xs font-bold text-foreground">
                    {activeSmsTab === "hot_warm" ? "No Hot or Warm EA Leads" : "No EA Leads"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeSmsTab === "hot_warm"
                      ? "Hot and Warm EA leads will appear here."
                      : "No EA leads found with recent SMS activity."}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Pagination if displayedSmsList.length > SMS_PER_PAGE */}
            {displayedSmsList.length > SMS_PER_PAGE && (
              <div className="flex items-center justify-center gap-4 py-3 px-4 border-t border-border/50">
                <button 
                  onClick={() => setSmsPage(p => Math.max(0, p - 1))}
                  disabled={smsPage === 0}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${
                    smsPage === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'
                  }`}
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  PAGE {smsPage + 1} OF {totalSmsPages}
                </span>
                <button 
                  onClick={() => setSmsPage(p => (p + 1 < totalSmsPages ? p + 1 : p))}
                  disabled={smsPage + 1 >= totalSmsPages}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${
                    smsPage + 1 >= totalSmsPages ? 'opacity-20 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card'
                  }`}
                  title="Next Page"
                >
                  <ChevronRight size={16} className="text-emerald-500" />
                </button>
              </div>
            )}
          </div>
          <div className="page-card dark:bg-card p-0 overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tasks & Follow-Ups</h2>
            </div>
            <div className="flex border-b">
              {[{ id: "overdue", label: "Overdue" }, { id: "due", label: "Today" }, { id: "upcoming", label: "Upcoming" }].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTaskTab(tab.id as any)}
                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-tighter transition-all border-b-2 ${activeTaskTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                    }`}
                >
                  {tab.label} ({filteredData?.[tab.id as keyof typeof filteredData]?.length || 0})
                </button>
              ))}
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
              {(filteredData?.[activeTaskTab] || []).map((f) => {
                const statusStyles = {
                  overdue: "border-l-destructive bg-destructive/5",
                  due: "border-l-warning bg-warning/5",
                  upcoming: "border-l-success bg-success/5"
                }[activeTaskTab] || "border-l-border bg-accent/5";

                return (
                  <div 
                    key={f._id} 
                    title={`${f.lead_name} - ${f.type}${f.title ? ` (${f.title})` : ''}: ${f.notes || "No notes"}`}
                    className={`border rounded-xl p-3 group flex items-start justify-between border-l-4 transition-all hover:shadow-sm ${statusStyles}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{f.lead_name}</p>
                      {f.title && <p className="text-[10px] font-semibold text-foreground truncate mt-0.5">{f.title}</p>}
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{f.notes}</p>
                      <p className="text-[9px] font-medium opacity-70 mt-1">{toESTDate(f.date_time).toLocaleString()}</p>
                    </div>
                    {!isReadOnly && (
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => markDone(f._id)}
                          className="p-1 hover:bg-success/15 text-muted-foreground hover:text-success rounded transition-colors"
                          title="Mark done"
                        >
                          <CheckCircle size={14} />
                        </button>
                        <button
                          onClick={() => handleOpenEditFollowUpModal(f)}
                          className="p-1 hover:bg-primary/15 text-muted-foreground hover:text-primary rounded transition-colors"
                          title="Edit follow-up"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteFollowUp(f._id)}
                          className="p-1 hover:bg-destructive/15 text-muted-foreground hover:text-destructive rounded transition-colors"
                          title="Delete follow-up"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {!isReadOnly && (
          <div className="page-card dark:bg-card">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Add Lead", icon: Plus, onClick: () => navigate("/leads/create"), color: "bg-blue-500/10 text-blue-500" },
                { 
                  label: "Log Call", 
                  icon: Phone, 
                  onClick: () => {
                    openDialer("", "", "", false);
                    setIsModalOpen(true);
                  }, 
                  color: "bg-orange-500/10 text-orange-500" 
                },
                { label: "Send Email", icon: Mail, onClick: () => { setLeadSearch(""); setLeads([]); setIsEmailModalOpen(true); }, color: "bg-indigo-500/10 text-indigo-500" },
                { label: "Export Report", icon: Search, onClick: () => toast.info("Report generated"), color: "bg-emerald-500/10 text-emerald-500" }
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-accent/5 hover:bg-accent/20 border transition-all space-y-2 group"
                  title={action.label}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110 ${action.color}`}>
                    <action.icon size={18} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-foreground">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen} modal={false}>
        <DialogContent 
          aria-describedby={undefined} 
          hideOverlay={true}
          className="w-[90vw] max-w-lg dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl border-2 border-border/80"
          onPointerDownOutside={(e) => {
            if (hasDraftData) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (hasDraftData) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-lg">Log Call / Outreach</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-2">
            {!selectedLeadResult ? (
              <div className="grid gap-3">
                <label htmlFor="search-by-lead-name" className="text-xs font-bold uppercase text-muted-foreground">Select Lead to Log</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <input
                      id="search-by-lead-name"
                      name="search-by-lead-name"
                  
                    className={`input-field pl-9 ${quickFollowUpErrors.lead ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="Search by lead name..."
                    value={leadSearch}
                    onChange={e => setLeadSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setLeadSearchIndex(prev => (prev < leads.length - 1 ? prev + 1 : 0));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setLeadSearchIndex(prev => (prev > 0 ? prev - 1 : leads.length - 1));
                      } else if (e.key === 'Enter') {
                        if (leadSearchIndex >= 0 && leads[leadSearchIndex]) {
                          setSelectedLeadResult(leads[leadSearchIndex]);
                          setLeadSearch("");
                          setLeads([]);
                        }
                      }
                    }}
                  />
                </div>
                {quickFollowUpErrors.lead && <p className="text-[10px] text-destructive">{quickFollowUpErrors.lead}</p>}
                <div className="max-h-[180px] overflow-y-auto border rounded-lg divide-y">
                  {leads.map((s, index) => (
                    <button 
                      key={s._id} 
                      id={`modal-search-item-${index}`}
                      className={`w-full text-left p-2.5 transition-colors text-xs ${
                        index === leadSearchIndex ? 'bg-accent border-l-4 border-l-primary' : 'hover:bg-accent'
                      }`} 
                      onClick={() => {
                        setSelectedLeadResult(s);
                        setLeadSearch("");
                        setLeads([]);
                      }}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{s.name}</span>
                        {s.type && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded-sm uppercase">{s.type}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{s.telephone || "No phone"} {s.city ? `• ${s.city}` : ''}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
                {/* Active Lead Summary */}
                <div className="p-3.5 rounded-xl bg-accent/5 border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Lead</p>
                    <h4 className="font-bold text-base text-foreground">{selectedLeadResult.name}</h4>
                    <p className="text-xs text-muted-foreground">{selectedLeadResult.telephone || "No phone"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button 
                      onClick={() => !isReadOnly && initiateCall(selectedLeadResult)}
                      disabled={isReadOnly}
                      className={`btn-primary h-9 px-4 flex items-center justify-center gap-2 shadow-sm ${isReadOnly ? 'opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed' : ''}`}
                    >
                      <Phone size={14} fill="currentColor" />
                      <span>Call Now</span>
                    </button>
                    <button className="text-[10px] font-bold text-primary hover:underline" onClick={() => setSelectedLeadResult(null)}>Change Lead</button>
                  </div>
                </div>

                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Call Outcome</div>
                    <div className="relative p-1 bg-accent/30 rounded-xl border border-border/50 flex flex-wrap gap-1">
                      {[
                        "Interested", 
                        "Not Interested", 
                        "Follow-Up Needed", 
                        "Left Voicemail", 
                        "No Answer", 
                        "Wrong Number"
                      ].map((outcome) => (
                        <button
                          key={outcome}
                          onClick={() => setCallOutcome(outcome)}
                          className={`flex-1 min-w-[100px] py-2 px-1 text-[10px] font-bold rounded-lg transition-all relative z-10 ${
                            callOutcome === outcome 
                              ? "text-primary dark:text-foreground" 
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {callOutcome === outcome && (
                            <div className="absolute inset-0 bg-white dark:bg-card shadow-sm rounded-lg -z-10 animate-in zoom-in-95 duration-200 border border-border/10" />
                          )}
                          {outcome}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label htmlFor="input-datetime-local-45" className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Calendar size={12} /> Next Follow-up
                    </label>
                    <DateTimePicker
                      id="input-datetime-local-45"
                      size="sm"
                      value={followUpDate}
                      onChange={(val) => {
                        setFollowUpDate(val);
                        if (val) setQuickFollowUpErrors({...quickFollowUpErrors, date: ""});
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="briefly-describe-the-interaction" className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Notes & Details</label>
                  <textarea
                      id="briefly-describe-the-interaction"
                      name="briefly-describe-the-interaction"
                  
                    className="input-field min-h-[80px] text-xs py-2.5"
                    placeholder="Briefly describe the interaction..."
                    value={followUpNotes}
                    onChange={e => setFollowUpNotes(e.target.value)}
                  />
                </div>
                <div className="mt-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">
                  <p className="text-[10px] font-medium text-center">
                    <span className="font-bold uppercase mr-1">Important:</span>
                    Ensure you click <strong>'Log Call'</strong> in the softphone dialer and <strong>'Schedule Follow-up'</strong> here to sync activity.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <button className="btn-secondary h-10 px-6 rounded-lg text-xs" onClick={() => setIsModalOpen(false)}>Cancel</button>
            {!isReadOnly && (
              <button className="btn-primary h-10 px-8 rounded-lg text-xs font-bold" onClick={() => submitFollowUp()}>Schedule Follow-up</button>
            )}
          </DialogFooter>

        </DialogContent>
      </Dialog>

      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-2xl dark:bg-card p-0 overflow-hidden !flex !flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0"><DialogTitle className="dark:text-foreground">Send Quick Email</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0">
            <div className="grid gap-4">
            {!selectedLeadForEmail ? (
              <div className="grid gap-3">
                <label className="text-sm font-semibold">Select Lead to Email</label>
                <input
                    id="search-by-lead-name"
                    name="search-by-lead-name"
                
                  className={`input-field ${quickEmailErrors.lead ? "border-destructive" : ""}`}
                  placeholder="Search by lead name..."
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setLeadSearchIndex(prev => (prev < leads.length - 1 ? prev + 1 : 0));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setLeadSearchIndex(prev => (prev > 0 ? prev - 1 : leads.length - 1));
                    } else if (e.key === 'Enter') {
                      if (leadSearchIndex >= 0 && leads[leadSearchIndex]) {
                        setSelectedLeadForEmail(leads[leadSearchIndex]);
                      }
                    }
                  }}
                />
                {quickEmailErrors.lead && <p className="text-xs text-destructive">{quickEmailErrors.lead}</p>}
                <div className="max-h-[200px] overflow-y-auto border rounded-xl divide-y">
                  {leads.map((s, index) => (
                    <button 
                      key={s._id} 
                      id={`modal-search-item-${index}`}
                      className={`w-full text-left p-3 transition-colors text-sm ${
                        index === leadSearchIndex ? 'bg-accent border-l-4 border-l-primary' : 'hover:bg-accent'
                      }`} 
                      onClick={() => setSelectedLeadForEmail(s)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between bg-primary/5 p-3 rounded-xl border border-primary/20">
                  <p className="text-sm font-semibold">Sending To: {selectedLeadForEmail.name}</p>
                  <button className="text-xs text-primary font-bold" onClick={() => setSelectedLeadForEmail(null)}>Change</button>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Recipient Email <span className="text-destructive">*</span></label>
                  {leadContacts.length > 0 ? (
                    <select
                        id="selected-contact-email"
                        name="selected-contact-email" className="input-field" value={selectedContactEmail} onChange={e => setSelectedContactEmail(e.target.value)}>
                      {leadContacts.map(c => <option key={c._id} value={c.email}>{c.name} ({c.email})</option>)}
                    </select>
                  ) : (
                    <div>
                      <input
                          id="no-email-on-file-contact-has-no-saved-em"
                          name="no-email-on-file-contact-has-no-saved-em" 
                        className="input-field text-sm opacity-50 cursor-not-allowed" 
                        disabled 
                        placeholder="No email on file — contact has no saved emails" 
                      />
                      <p className="text-[10px] text-amber-500 font-medium mt-1 flex items-center gap-1">
                        ⚠️ This lead has no contacts with email addresses.
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">CC <span className="text-muted-foreground text-xs">(optional)</span></label>
                  <div className="flex flex-wrap gap-2 p-2 min-h-[42px] bg-background border rounded-lg focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    {emailData.cc.map((email, index) => {
                      const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
                      const domain = email.split('@')[1];
                      const domainStatus = verifiedDomains[domain];
                      const isDomainInvalid = domainStatus && domainStatus.valid === false;

                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setCcInput(email);
                            setEmailData({ ...emailData, cc: emailData.cc.filter((_, i) => i !== index) });
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
                              setEmailData({ ...emailData, cc: emailData.cc.filter((_, i) => i !== index) });
                            }}
                            className="hover:bg-black/5 rounded-full p-0.5 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                    <input
                        id="cc-input"
                        name="cc-input"
                    
                      className="flex-1 bg-transparent border-none outline-none text-sm min-w-[120px] placeholder:text-muted-foreground/50"
                      placeholder={emailData.cc.length === 0 ? "Add email and press Enter..." : ""}
                      value={ccInput}
                      onChange={e => setCcInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const val = ccInput.trim().replace(/,$/, '');
                          if (val && !emailData.cc.includes(val)) {
                            setEmailData({ ...emailData, cc: [...emailData.cc, val] });
                            setCcInput("");
                            checkDomain(val);
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
                          checkDomain(val);
                        }
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 ml-1 font-medium italic flex justify-between">
                    <span>Press Enter or Comma to add • Click a tag to edit</span>
                    {emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)) && (
                      <span className="text-destructive font-semibold">One or more emails are invalid</span>
                    )}
                  </p>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Email Subject <span className="text-destructive">*</span></label>
                  <input
                      id="input-field-51"
                      name="input-field-51" className={`input-field ${quickEmailErrors.subject ? "border-destructive" : ""}`} value={emailData.subject} onChange={e => setEmailData({ ...emailData, subject: e.target.value })} />
                  {quickEmailErrors.subject && <p className="text-xs text-destructive">{quickEmailErrors.subject}</p>}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">Message Content <span className="text-destructive">*</span></label>
                  <textarea
                      id="textarea-field-52"
                      name="textarea-field-52" className={`input-field min-h-[150px] ${quickEmailErrors.body ? "border-destructive" : ""}`} value={emailData.body} onChange={e => setEmailData({ ...emailData, body: e.target.value })} />
                  {quickEmailErrors.body && <p className="text-xs text-destructive">{quickEmailErrors.body}</p>}
                </div>
              </>
            )}
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => setIsEmailModalOpen(false)}>Cancel</button>
            <button
              className={`btn-primary flex items-center justify-center gap-2 ${emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)) ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={sendQuickEmail}
              disabled={emailData.cc.some(e => !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e))}
            >
              <Send size={16} /> Send via Gmail
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDoneOpen} onOpenChange={setIsConfirmDoneOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-sm dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-center font-bold">Confirm Completion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">
              Are you sure you want to mark this task as completed?
            </p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <button className="btn-secondary flex-1" onClick={() => setIsConfirmDoneOpen(false)}>Cancel</button>
            <button className="btn-primary flex-1 bg-success hover:bg-success/90" onClick={handleConfirmDone}>Yes, Mark Done</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Follow-up Modal */}
      <Dialog
        open={isFollowUpEditModalOpen}
        onOpenChange={(open) => {
          setIsFollowUpEditModalOpen(open);
          if (!open) {
            setQuickFollowUpErrors({});
            setEditingFollowUp(null);
          }
        }}
      >
        <DialogContent aria-describedby={undefined} className="w-[90vw] sm:max-w-lg dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground">Edit Follow-up</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="edit-title" className="text-sm font-medium">Title</label>
              <input
                id="edit-title"
                type="text"
                name="title"
                className="input-field dark:bg-card"
                placeholder="e.g. Discuss proposal details"
                value={followUpTitle || ""}
                onChange={(e) => setFollowUpTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-date" className="text-sm font-medium">Follow-up Time <span className="text-destructive">*</span></label>
              <DateTimePicker
                id="edit-date"
                value={followUpDate || ""}
                onChange={setFollowUpDate}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Type <span className="text-destructive">*</span></label>
                <select
                  name="type"
                  className="input-field dark:bg-card"
                  value={followUpType || ""}
                  onChange={e => setFollowUpType(e.target.value)}
                >
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Task">Task</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Priority (optional)</label>
                <select
                  name="priority"
                  className="input-field dark:bg-card"
                  value={followUpPriority || ""}
                  onChange={e => setFollowUpPriority(e.target.value)}
                >
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

            <div className="grid gap-2">
              <label className="text-sm font-medium">Status <span className="text-destructive">*</span></label>
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
            <div className="grid gap-2">
              <label htmlFor="edit-notes" className="text-sm font-medium">Notes / Instructions <span className="text-destructive">*</span></label>
              <textarea
                id="edit-notes"
                name="notes"
                className="input-field min-h-[80px]"
                placeholder="What needs to happen?"
                value={followUpNotes || ""}
                onChange={(e) => setFollowUpNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <button className="btn-secondary" onClick={() => {
              setIsFollowUpEditModalOpen(false);
              setEditingFollowUp(null);
            }}>Cancel</button>
            <button
              disabled={isSubmitting}
              className={`btn-primary ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => submitEditFollowUp()}
            >
              {isSubmitting ? "Saving..." : "Update Follow-up"}
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

      {/* Weekly AI Executive Briefing Full Modal */}
      <Dialog open={isWeeklyReportModalOpen} onOpenChange={setIsWeeklyReportModalOpen}>
        <DialogContent className="w-[95vw] max-w-5xl xl:max-w-6xl max-h-[92vh] flex flex-col p-6 sm:p-8">
          <DialogHeader className="pb-2 border-b border-border/40">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-primary/10 text-primary">
                <Sparkles size={24} />
              </span>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold">
                  Weekly AI Executive Briefing
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {weeklyReport?.weekStartDate && (
                    <>
                      Coverage: {new Date(weeklyReport.weekStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(weeklyReport.weekEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • Delivered to {weeklyReport.recipient || "play@yausports.com"}
                    </>
                  )}
                </p>
              </div>
            </div>
          </DialogHeader>

          {weeklyReport && (
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 my-4">
              {/* Status Badge & Meta */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4 bg-accent/30 rounded-2xl border text-xs sm:text-sm">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full font-bold uppercase text-[11px] ${
                    weeklyReport.status === 'sent' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    Status: {weeklyReport.status || 'sent'}
                  </span>
                  <span className="text-muted-foreground">
                    Generated: {new Date(weeklyReport.generatedAt || Date.now()).toLocaleString()}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-semibold">
                  AI Model: Claude Sonnet 4.6
                </span>
              </div>

              {/* Two Column Layout Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: KPI Summary & EA Lead Scoring (5 of 12 columns) */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Executive KPI Summary */}
                  <div className="bg-card/60 border rounded-2xl p-5 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <TrendingUp size={15} className="text-primary" /> Executive KPI Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-background/80 dark:bg-card border rounded-xl p-3.5 shadow-sm">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold">New Leads (7d)</span>
                        <p className="text-2xl font-extrabold text-foreground mt-0.5">{reportNewLeads7d}</p>
                      </div>
                      <div className="bg-background/80 dark:bg-card border rounded-xl p-3.5 shadow-sm">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Total In Pipeline</span>
                        <p className="text-2xl font-extrabold text-primary mt-0.5">{reportTotalLeads}</p>
                      </div>
                      <div className="bg-background/80 dark:bg-card border rounded-xl p-3.5 shadow-sm">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Followups Done</span>
                        <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">{reportFollowupsDone}</p>
                      </div>
                      <div className="bg-background/80 dark:bg-card border rounded-xl p-3.5 shadow-sm">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold">Pending Overdue</span>
                        <p className="text-2xl font-extrabold text-red-500 mt-0.5">{reportOverduePending}</p>
                      </div>
                    </div>
                  </div>

                  {/* EA Lead Distribution */}
                  {weeklyReport.rawStats && (
                    <div className="bg-card/60 border rounded-2xl p-5 shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Sparkles size={15} className="text-amber-500" /> EA AI Lead Scoring Breakdown
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-background/80 dark:bg-card border rounded-xl p-3.5 shadow-sm">
                          <span className="text-[10px] uppercase text-amber-600 font-bold">🔥 Hot Leads</span>
                          <p className="text-2xl font-extrabold mt-0.5">{reportHotLeads}</p>
                        </div>
                        <div className="bg-background/80 dark:bg-card border rounded-xl p-3.5 shadow-sm">
                          <span className="text-[10px] uppercase text-blue-600 font-bold">☀️ Warm Leads</span>
                          <p className="text-2xl font-extrabold mt-0.5">{reportWarmLeads}</p>
                        </div>
                        <div className="bg-background/80 dark:bg-card border rounded-xl p-3.5 shadow-sm">
                          <span className="text-[10px] uppercase text-slate-500 font-bold">❄️ Cold Leads</span>
                          <p className="text-2xl font-extrabold mt-0.5">{reportColdLeads}</p>
                        </div>
                        <div className="bg-background/80 dark:bg-card border rounded-xl p-3.5 shadow-sm">
                          <span className="text-[10px] uppercase text-red-500 font-bold">⚠️ Stalled Leads</span>
                          <p className="text-2xl font-extrabold mt-0.5">{reportStalledLeads}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Claude AI Executive Synthesis (7 of 12 columns) */}
                <div className="lg:col-span-7 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Sparkles size={15} className="text-primary" /> Claude AI Executive Synthesis
                  </h4>
                  <div
                    className="bg-accent/20 border rounded-2xl p-6 sm:p-7 text-sm text-foreground/90 leading-relaxed font-normal shadow-sm [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-5 [&_h3]:mb-2 [&_h3:first-child]:mt-0 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_strong]:text-foreground [&_strong]:font-semibold [&_em]:text-muted-foreground [&_hr]:my-4 [&_hr]:border-border/60"
                    dangerouslySetInnerHTML={{ __html: weeklyReport.executiveSummary || '<p>No narrative available.</p>' }}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border/40">
            <button
              onClick={() => setIsWeeklyReportModalOpen(false)}
              className="btn-secondary px-5"
            >
              Close
            </button>
            {!isSalesrepOrReadOnly && (
              <button
                onClick={() => {
                  setIsWeeklyReportModalOpen(false);
                  handleGenerateWeeklyReport();
                }}
                disabled={isGeneratingWeeklyReport}
                className="btn-primary flex items-center gap-2 px-5"
              >
                <RefreshCw size={15} className={isGeneratingWeeklyReport ? "animate-spin" : ""} />
                Regenerate
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
