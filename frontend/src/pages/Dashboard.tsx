import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import {
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle,
  Phone,
  Filter,
  Search,
  Plus,
  Building,
  Megaphone,
  ArrowRight,
  Mail,
  Send,
  ChevronLeft,
  ChevronRight,
  X,
  Edit,
  Trash2,
  Sparkles,
  FileText,
  RefreshCw,
  Flame,
  Sun,
  Snowflake,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Video,
  PhoneCall,
  PhoneForwarded,
  Voicemail,
  Eye
} from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCampaignStore } from "../store/campaignStore";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useSMS } from "../context/SMSContext";
import { useDashboard, FollowUpItem as FollowUp, DashboardData } from "../context/DashboardContext";
import DashboardSkeleton from "../components/dashboard/DashboardSkeleton";
import { useDialerStore } from "../store/dialerStore";
import { can } from "../utils/permissions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { toESTDate } from "../utils/timezoneHelper";

// ── Types ─────────────────────────────────────────────────────────────

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

// Module-scoped persistent cache for 0ms client-side SPA navigation
let savedDashboardScrollTop = 0;

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const isReadOnly = permissions.isReadOnly;
  const isSalesrepOrReadOnly = currentUser?.role === "sales_rep" || currentUser?.role === "view_only";
  const isAdminOrManager = currentUser?.role === "admin" || currentUser?.role === "manager";
  const isAdmin = currentUser?.role === "admin";
  const openDialer = useDialerStore((state) => state.openDialer);
  const statsRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Core Data from DashboardContext
  const {
    dashboardMetrics,
    rawData,
    commandCenterData,
    campaignSummaries,
    pipelineData,
    selectedCampaign,
    initialLoading,
    metricsLoaded,
    tasksLoaded,
    commandCenterLoaded,
    weeklyReport,
    loadingWeeklyReport,
    isGeneratingWeeklyReport,
    isRefreshing,
    setCampaignFilter,
    refreshDashboard,
    generateWeeklyReport
  } = useDashboard();

  const [activeTaskTab, setActiveTaskTab] = useState<"overdue" | "due" | "upcoming">("due");
  const { campaigns, setCampaigns } = useCampaignStore();
  const [isWeeklyReportModalOpen, setIsWeeklyReportModalOpen] = useState(false);

  // Live SMS Action Panel State
  const { unreadSmsData: contextUnreadSmsData, refreshUnreadCount } = useSMS();
  const [loadingUnreadSms, setLoadingUnreadSms] = useState(false);
  const [activeSmsTab, setActiveSmsTab] = useState<"hot_warm" | "all">("hot_warm");
  const [smsPage, setSmsPage] = useState(0);
  const SMS_PER_PAGE = 4;

  // Stalled Leads Action Panel State
  const [stalledPage, setStalledPage] = useState(0);
  const STALLED_PER_PAGE = 5;
  const [isScanningStalled, setIsScanningStalled] = useState(false);
  const [selectedStalledLead, setSelectedStalledLead] = useState<any | null>(null);
  const [reengageMessage, setReengageMessage] = useState("");
  const [reengageModalOpen, setReengageModalOpen] = useState(false);
  const [isSendingReengage, setIsSendingReengage] = useState(false);

  // AI Suggestions State
  const [aiSuggestionPage, setAiSuggestionPage] = useState(0);
  const AI_SUGGESTIONS_PER_PAGE = 5;
  const [processingSuggestionId, setProcessingSuggestionId] = useState<string | null>(null);
  const [selectedAiSuggestion, setSelectedAiSuggestion] = useState<any | null>(null);
  const [aiDetailModalOpen, setAiDetailModalOpen] = useState(false);

  // Email Campaign Activity State
  const [emailCampaignPage, setEmailCampaignPage] = useState(0);
  const EMAIL_CAMPAIGNS_PER_PAGE = 5;

  // Retell AI Telephony Summary Timeframe State
  const [telephonyTimeframe, setTelephonyTimeframe] = useState<"today" | "7d" | "30d" | "all">("today");

  // Meetings Scheduled Timeframe State (Default: "today")
  const [meetingTimeframe, setMeetingTimeframe] = useState<"today" | "7d" | "30d" | "all">("today");
  const [meetingPage, setMeetingPage] = useState(0);
  const MEETINGS_PER_PAGE = 5;

  // Manual Dashboard Refresh with Motion Feedback (Click-Only)
  const [isManualSpinning, setIsManualSpinning] = useState(false);

  const handleManualRefresh = async () => {
    setIsManualSpinning(true);
    try {
      await refreshDashboard(false);
      toast.success("Dashboard live data refreshed");
    } catch {
      toast.error("Failed to refresh dashboard");
    } finally {
      setTimeout(() => setIsManualSpinning(false), 700);
    }
  };

  // ── Auto-refresh live data silently on Dashboard mount ──
  useEffect(() => {
    refreshDashboard(true);
  }, [refreshDashboard]);

  // ── Preserve & Restore Dashboard Scroll Position (Dashboard Exclusive) ──
  useEffect(() => {
    const container = document.getElementById("main-scroll-container");
    if (!container) return;

    const saved = sessionStorage.getItem("crm_dashboard_scroll");
    const targetScrollTop = saved !== null ? parseInt(saved, 10) : savedDashboardScrollTop;

    let isRestoring = targetScrollTop > 0;
    let observer: ResizeObserver | null = null;
    let safetyTimer: any = null;
    let debounceTimer: any = null;

    // Track user-initiated interaction
    const recordUserScroll = () => {
      // If user manually scrolls/interacts, immediately disengage restoration
      isRestoring = false;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!container) return;
        savedDashboardScrollTop = container.scrollTop;
        sessionStorage.setItem("crm_dashboard_scroll", String(container.scrollTop));
      }, 50);
    };

    const handleUserInteraction = () => {
      recordUserScroll();
    };

    container.addEventListener("wheel", handleUserInteraction, { passive: true });
    container.addEventListener("touchmove", handleUserInteraction, { passive: true });
    container.addEventListener("pointerdown", handleUserInteraction, { passive: true });
    container.addEventListener("keydown", handleUserInteraction, { passive: true });

    // Scroll listener: only record when not restoring
    const handleScroll = () => {
      if (isRestoring) return;
      savedDashboardScrollTop = container.scrollTop;
      sessionStorage.setItem("crm_dashboard_scroll", String(container.scrollTop));
    };
    container.addEventListener("scroll", handleScroll, { passive: true });

    // Restoration engine using ResizeObserver
    if (isRestoring && targetScrollTop > 0) {
      const attemptRestore = () => {
        if (!isRestoring || !container) return;
        container.scrollTop = targetScrollTop;
        // If container was tall enough to reach within 4px of target
        if (Math.abs(container.scrollTop - targetScrollTop) <= 4) {
          isRestoring = false;
          if (observer) {
            observer.disconnect();
            observer = null;
          }
        }
      };

      // Try immediately and on next animation frame
      attemptRestore();
      requestAnimationFrame(attemptRestore);

      // Observe size changes of the container (fires as dashboard widgets expand to full height)
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => {
          attemptRestore();
        });
        observer.observe(container);
        if (container.firstElementChild) {
          observer.observe(container.firstElementChild);
        }
      }

      // Safety timeout: stop trying after 2.5s
      safetyTimer = setTimeout(() => {
        isRestoring = false;
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }, 2500);
    }

    return () => {
      clearTimeout(safetyTimer);
      clearTimeout(debounceTimer);
      if (observer) {
        observer.disconnect();
      }
      container.removeEventListener("wheel", handleUserInteraction);
      container.removeEventListener("touchmove", handleUserInteraction);
      container.removeEventListener("pointerdown", handleUserInteraction);
      container.removeEventListener("keydown", handleUserInteraction);
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Global Search State
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<Lead[]>([]);
  const [globalSearchIndex, setGlobalSearchIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Log Call / Schedule Follow-up Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadSearchIndex, setLeadSearchIndex] = useState(-1);
  const [selectedLeadResult, setSelectedLeadResult] = useState<Lead | null>(null);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpType, setFollowUpType] = useState("Call");
  const [followUpPriority, setFollowUpPriority] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [callOutcome, setCallOutcome] = useState("Answered - Interested");
  const [assignedTo, setAssignedTo] = useState("self");
  const [customAssignedTo, setCustomAssignedTo] = useState("");
  const [quickFollowUpErrors, setQuickFollowUpErrors] = useState<Record<string, string>>({});

  // Follow-up Edit State
  const [isFollowUpEditModalOpen, setIsFollowUpEditModalOpen] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("pending");
  const [editingFollowUp, setEditingFollowUp] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [followUpToDelete, setFollowUpToDelete] = useState<string | null>(null);

  // Quick Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<any>(null);
  const [emailData, setEmailData] = useState({ subject: "", body: "", cc: [] as string[] });
  const [ccInput, setCcInput] = useState("");
  const [verifiedDomains, setVerifiedDomains] = useState<Record<string, { valid: boolean; message?: string }>>({});
  const [leadContacts, setLeadContacts] = useState<any[]>([]);
  const [selectedContactEmail, setSelectedContactEmail] = useState("");
  const [quickEmailErrors, setQuickEmailErrors] = useState<Record<string, string>>({});

  // Quick SMS Modal State
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsTarget, setSmsTarget] = useState<{ leadId: string; name: string; phone?: string; leadType: "ea_lead" | "lead" } | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);

  // Confirm Done Dialog
  const [isConfirmDoneOpen, setIsConfirmDoneOpen] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState<string | null>(null);

  const [campaignPage, setCampaignPage] = useState(0);
  const CAMPAIGNS_PER_PAGE = 5;

  // ── Actions & Refresh ───────────────────────────────────────────────

  const handleGenerateWeeklyReport = async () => {
    await generateWeeklyReport(false);
  };

  const loadUnreadSms = async () => {
    try {
      setLoadingUnreadSms(true);
      await refreshUnreadCount();
      await refreshDashboard(true);
    } catch (err) {
      console.error("Failed to refresh SMS activity:", err);
    } finally {
      setLoadingUnreadSms(false);
    }
  };

  useEffect(() => {
    if (searchParams.get("action") === "new-followup") {
      setIsModalOpen(true);
      searchParams.delete("action");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Global search autocomplete
  useEffect(() => {
    if (globalSearch.trim().length >= 2) {
      api
        .get(`/leads?q=${globalSearch}&limit=10`)
        .then((r) => {
          setGlobalSearchResults(r.data.data ?? r.data ?? []);
          setGlobalSearchIndex(-1);
        })
        .catch(() => setGlobalSearchResults([]));
    } else {
      setGlobalSearchResults([]);
      setGlobalSearchIndex(-1);
    }
  }, [globalSearch]);

  // Modal lead search
  useEffect(() => {
    if (isModalOpen || isEmailModalOpen) {
      if (leadSearch.length >= 1) {
        api
          .get(`/leads?q=${leadSearch}&limit=50`)
          .then((r) => {
            setLeads(r.data.data ?? r.data ?? []);
            setLeadSearchIndex(-1);
          })
          .catch(() => setLeads([]));
      } else {
        setLeads([]);
        setLeadSearchIndex(-1);
      }
    }
  }, [leadSearch, isModalOpen, isEmailModalOpen]);

  // Contact list for email modal
  useEffect(() => {
    if (selectedLeadForEmail) {
      api
        .get(`/leads/${selectedLeadForEmail._id}`)
        .then((res) => {
          const contacts = res.data.contacts || [];
          setLeadContacts(contacts);
          if (contacts.length > 0) {
            setSelectedContactEmail(contacts[0].email);
          }
        })
        .catch(() => setLeadContacts([]));
    }
  }, [selectedLeadForEmail]);

  // ── Action Handlers ──────────────────────────────────────────────────

  const initiateCall = (leadToCall: Lead) => {
    if (isReadOnly) return;
    const phone = leadToCall.telephone;
    if (phone) {
      const cleanPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
      openDialer(cleanPhone, leadToCall._id, leadToCall.name || "Unknown", true);
    }
    setFollowUpType("Call");
  };

  const handleOpenSmsModal = (target: { leadId: string; name: string; phone?: string; leadType: "ea_lead" | "lead" }) => {
    setSmsTarget(target);
    setSmsMessage(`Hi ${target.name}, checking in from YAU Sports! How can we help you today?`);
    setSmsModalOpen(true);
  };

  const handleSendQuickSms = async () => {
    if (!smsTarget || !smsMessage.trim()) return;
    setIsSendingSms(true);
    try {
      if (smsTarget.leadType === "ea_lead") {
        await api.post(`/ea-leads/${smsTarget.leadId}/send-sms`, { message: smsMessage.trim() });
      } else {
        await api.post("/sms/send-sms", {
          lead_id: smsTarget.leadId,
          to: smsTarget.phone,
          message: smsMessage.trim()
        });
      }
      toast.success(`SMS dispatched to ${smsTarget.name}!`);
      setSmsModalOpen(false);
      setSmsMessage("");
      refreshDashboard(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to dispatch SMS");
    } finally {
      setIsSendingSms(false);
    }
  };

  // Stalled Leads Scan & Re-engage
  const handleTriggerStalledScan = async () => {
    setIsScanningStalled(true);
    try {
      const res = await api.post("/stalled-leads/scan");
      if (res.data?.success) {
        toast.success(`Scan complete: ${res.data.currentlyStalledCount} stalled leads found.`);
        await refreshDashboard(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to scan stalled leads.");
    } finally {
      setIsScanningStalled(false);
    }
  };

  const openReengageModal = (lead: any) => {
    setSelectedStalledLead(lead);
    setReengageMessage(
      lead.draftMessage ||
      `Hi ${lead.name}, checking in to see if you have any questions about our sports programs! Let us know if you'd like to connect.`
    );
    setReengageModalOpen(true);
  };

  const handleSendReengage = async () => {
    if (!selectedStalledLead || !reengageMessage.trim()) return;
    setIsSendingReengage(true);
    try {
      const res = await api.post(`/stalled-leads/${selectedStalledLead._id}/re-engage`, {
        message: reengageMessage.trim(),
        leadType: selectedStalledLead.leadType
      });
      if (res.data?.success) {
        toast.success(`Re-engagement dispatched to ${selectedStalledLead.name}!`);
        setReengageModalOpen(false);
        setSelectedStalledLead(null);
        await refreshDashboard(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to send re-engagement message.");
    } finally {
      setIsSendingReengage(false);
    }
  };

  const handleDismissStalled = async (lead: any) => {
    try {
      const res = await api.post(`/stalled-leads/${lead._id}/dismiss`, {
        leadType: lead.leadType
      });
      if (res.data?.success) {
        toast.info(`Stalled status dismissed for ${lead.name}`);
        await refreshDashboard(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to dismiss stalled status.");
    }
  };

  // AI Suggestions
  const handleAcceptSuggestion = async (item: any) => {
    try {
      setProcessingSuggestionId(item.leadId);
      const res = await api.post(`/next-action/${item.leadId}/accept`, {
        leadType: item.leadType
      });
      if (res.data?.success) {
        toast.success(`Action accepted for ${item.name}! Added to tasks.`);
        await refreshDashboard(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to accept AI suggestion");
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const handleDismissSuggestion = async (item: any) => {
    try {
      setProcessingSuggestionId(item.leadId);
      const res = await api.post(`/next-action/${item.leadId}/dismiss`, {
        leadType: item.leadType
      });
      if (res.data?.success) {
        toast.info(`Suggestion dismissed for ${item.name}`);
        await refreshDashboard(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to dismiss AI suggestion");
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  // Follow-ups completion & delete
  const markDone = (fuId: string) => {
    setTaskToComplete(fuId);
    setIsConfirmDoneOpen(true);
  };

  const handleConfirmDone = async () => {
    if (!taskToComplete) return;
    try {
      await api.patch(`/followups/${taskToComplete}/status`, { status: "completed" });
      toast.success("Follow-up marked as completed");
      refreshDashboard(true);
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setIsConfirmDoneOpen(false);
      setTaskToComplete(null);
    }
  };

  const handleOpenEditFollowUpModal = (fu: FollowUp) => {
    setEditingFollowUp(fu);
    setFollowUpTitle(fu.title || "");
    setFollowUpDate(fu.date_time);
    setFollowUpType(fu.type || "Call");
    setFollowUpPriority(fu.priority || "Medium");
    setFollowUpStatus(fu.status || "pending");
    setFollowUpNotes(fu.notes || "");
    setIsFollowUpEditModalOpen(true);
  };

  const submitEditFollowUp = async () => {
    if (isSubmitting || !editingFollowUp) return;
    setIsSubmitting(true);
    try {
      await api.put(`/followups/${editingFollowUp._id}`, {
        title: followUpTitle.trim(),
        date_time: followUpDate,
        type: followUpType,
        priority: followUpPriority,
        notes: followUpNotes,
        status: followUpStatus
      });
      toast.success("Follow-up updated");
      setIsFollowUpEditModalOpen(false);
      setEditingFollowUp(null);
      refreshDashboard(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update follow-up");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFollowUp = (fuId: string) => {
    setFollowUpToDelete(fuId);
  };

  const confirmDeleteFollowUp = async () => {
    if (!followUpToDelete) return;
    try {
      await api.delete(`/followups/${followUpToDelete}`);
      toast.success("Follow-up deleted");
      refreshDashboard(true);
    } catch {
      toast.error("Failed to delete follow-up");
    } finally {
      setFollowUpToDelete(null);
    }
  };

  const submitFollowUp = async () => {
    const errors: Record<string, string> = {};
    if (!selectedLeadResult) errors.lead = "Please select a lead first";
    if (!followUpDate) errors.date = "Follow-up date is required";

    if (Object.keys(errors).length > 0) {
      setQuickFollowUpErrors(errors);
      toast.error("Please fill all follow-up details");
      return;
    }

    try {
      if (callOutcome) {
        try {
          await api.post("/voice/log-call", {
            lead_id: selectedLeadResult?._id,
            outcome: callOutcome,
            notes: followUpNotes,
            contact_name: selectedLeadResult?.name || "Unknown"
          });
        } catch (e) {
          console.error("Failed to log call activity:", e);
        }
      }

      await api.post(`/followups/${selectedLeadResult?._id}`, {
        date_time: followUpDate,
        type: followUpType,
        priority: followUpPriority,
        notes: followUpNotes,
        assigned_to: assignedTo === "other" ? customAssignedTo : assignedTo
      });
      toast.success("Activity logged & Follow-up scheduled");
      setIsModalOpen(false);
      setSelectedLeadResult(null);
      setLeadSearch("");
      setFollowUpDate("");
      setFollowUpNotes("");
      refreshDashboard(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to schedule follow-up");
    }
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
      refreshDashboard(true);
    } catch {
      toast.error("Failed to send email");
    }
  };

  // Filter list for Tasks panel
  const filterList = (list: FollowUp[]) => {
    if (selectedCampaign === "all") return list;
    return list.filter((f) => String(f.campaign_id_val) === selectedCampaign);
  };

  const filteredData = rawData
    ? {
      overdue: filterList(rawData.overdue || []),
      due: filterList(rawData.due || []),
      upcoming: filterList(rawData.upcoming || []),
      all: filterList(rawData.all || [])
    }
    : null;

  // ── Calculations for Lead Temperature Pipeline ───────────────────────

  const widgets = commandCenterData || {};
  const scoreBreakdown = widgets.leadScoreBreakdown || {};
  const tempMetrics = (dashboardMetrics as any)?.temperature;

  const hotCount = scoreBreakdown.hot ?? tempMetrics?.ea?.hot ?? tempMetrics?.hot ?? 0;
  const warmCount = scoreBreakdown.warm ?? tempMetrics?.ea?.warm ?? tempMetrics?.warm ?? 0;
  const coldCount = scoreBreakdown.cold ?? tempMetrics?.ea?.cold ?? tempMetrics?.cold ?? 0;
  const totalTempLeads = scoreBreakdown.total ?? (hotCount + warmCount + coldCount);

  const hotPercentage = scoreBreakdown.hotPct ?? (totalTempLeads > 0 ? Math.round((hotCount / totalTempLeads) * 100) : 0);
  const warmPercentage = scoreBreakdown.warmPct ?? (totalTempLeads > 0 ? Math.round((warmCount / totalTempLeads) * 100) : 0);
  const coldPercentage = scoreBreakdown.coldPct ?? (totalTempLeads > 0 ? Math.max(0, 100 - hotPercentage - warmPercentage) : 0);

  // Live SMS list
  const unreadSmsData = contextUnreadSmsData || { totalUnreadCount: 0, hotWarmCount: 0, hotWarmMessages: [], unreadMessages: [], recentMessages: [] };
  const allEaMessages = (widgets.unreadSms?.messages && widgets.unreadSms.messages.length > 0)
    ? widgets.unreadSms.messages
    : (unreadSmsData.recentMessages || []).filter((m: any) => m.leadType === "ea" || m.leadType === "ea_lead");

  const hotWarmSmsList = allEaMessages.filter((m: any) => m.aiScore === "Hot" || m.aiScore === "Warm");
  const displayedSmsList = activeSmsTab === "hot_warm" ? (hotWarmSmsList.length > 0 ? hotWarmSmsList : allEaMessages) : allEaMessages;
  const totalSmsPages = Math.ceil(displayedSmsList.length / SMS_PER_PAGE) || 1;
  const paginatedSmsList = displayedSmsList.slice(smsPage * SMS_PER_PAGE, (smsPage + 1) * SMS_PER_PAGE);

  // Stalled leads list
  const rawStalledList: any[] = widgets.stalledLeads?.leads || [];
  const displayedStalledList = rawStalledList;
  const totalStalledPages = Math.ceil(displayedStalledList.length / STALLED_PER_PAGE) || 1;
  const paginatedStalledList = displayedStalledList.slice(stalledPage * STALLED_PER_PAGE, (stalledPage + 1) * STALLED_PER_PAGE);

  // AI suggestions list
  const aiSuggestionsList: any[] = widgets.aiSuggestions || [];
  const totalAiSuggestionPages = Math.ceil(aiSuggestionsList.length / AI_SUGGESTIONS_PER_PAGE) || 1;
  const paginatedAiSuggestions = aiSuggestionsList.slice(
    aiSuggestionPage * AI_SUGGESTIONS_PER_PAGE,
    (aiSuggestionPage + 1) * AI_SUGGESTIONS_PER_PAGE
  );

  // Meetings Scheduled list & dynamic timeframe filter (timezone-aware)
  const meetingsWidget = widgets.meetings || {};
  const currentMeetingsList: any[] = useMemo(() => {
    const allMeetings: any[] = (Array.isArray(meetingsWidget.all) && meetingsWidget.all.length > 0)
      ? meetingsWidget.all
      : (Array.isArray(widgets.meetingsThisWeek) ? widgets.meetingsThisWeek : []);

    if (meetingTimeframe === "today") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      // Local calendar day filtering from all meetings (handles client timezone boundary)
      const localTodayMeetings = allMeetings.filter((m: any) => {
        if (!m?.dateTime) return false;
        const dt = new Date(m.dateTime);
        return dt >= startOfToday && dt <= endOfToday;
      });

      if (localTodayMeetings.length > 0) {
        return localTodayMeetings;
      }
      return Array.isArray(meetingsWidget.today) ? meetingsWidget.today : [];
    }

    if (meetingTimeframe === "7d") {
      if (Array.isArray(meetingsWidget["7d"]) && meetingsWidget["7d"].length > 0) {
        return meetingsWidget["7d"];
      }
      return Array.isArray(widgets.meetingsThisWeek) ? widgets.meetingsThisWeek : [];
    }

    if (meetingTimeframe === "30d") {
      return Array.isArray(meetingsWidget["30d"]) ? meetingsWidget["30d"] : [];
    }

    // "all"
    return (Array.isArray(meetingsWidget.all) && meetingsWidget.all.length > 0) ? meetingsWidget.all : allMeetings;
  }, [meetingsWidget, widgets.meetingsThisWeek, meetingTimeframe]);
  const totalMeetingPages = Math.ceil(currentMeetingsList.length / MEETINGS_PER_PAGE) || 1;
  const paginatedMeetings = currentMeetingsList.slice(
    meetingPage * MEETINGS_PER_PAGE,
    (meetingPage + 1) * MEETINGS_PER_PAGE
  );

  // Email campaigns list
  const emailCampaignsList: any[] = widgets.emailCampaignActivity || [];
  const totalEmailCampaignPages = Math.ceil(emailCampaignsList.length / EMAIL_CAMPAIGNS_PER_PAGE) || 1;
  const paginatedEmailCampaigns = emailCampaignsList.slice(
    emailCampaignPage * EMAIL_CAMPAIGNS_PER_PAGE,
    (emailCampaignPage + 1) * EMAIL_CAMPAIGNS_PER_PAGE
  );

  // Weekly report stats
  const weeklyStats = weeklyReport?.rawStats || {};
  const reportTotalLeads = weeklyStats.totalLeads ?? weeklyStats.leads?.total ?? dashboardMetrics?.leads?.total ?? 0;
  const reportNewLeads7d = weeklyStats.newLeadsThisWeek ?? weeklyStats.leads?.newInLast7Days ?? 1;
  const reportFollowupsDone = weeklyStats.followupStats?.completedLast7Days ?? weeklyStats.followups?.completedLast7Days ?? 0;
  const reportHotWarmTotal = hotCount + warmCount;

  const weeklyNarrativePreview = weeklyReport?.executiveSummary
    ? weeklyReport.executiveSummary.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim()
    : "Automated executive summary synthesized by Claude AI.";

  const StatCard = ({ title, count, icon: Icon, color }: { title: string; count: number; icon: any; color: string }) => (
    <div className="stat-card border-none bg-accent/20 dark:bg-card/40 flex flex-col items-center text-center p-5 rounded-2xl transition-all hover:bg-accent/30 shadow-xs">
      <div className="w-10 h-10 rounded-full bg-background dark:bg-background/20 flex items-center justify-center mb-2.5">
        <Icon size={20} className={color} />
      </div>
      <div className="text-2xl font-bold text-foreground">{count}</div>
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-1">{title}</span>
    </div>
  );

  if (initialLoading && !metricsLoaded && !dashboardMetrics) {
    return (
      <AppLayout>
        <DashboardSkeleton isAdminOrManager={isAdminOrManager} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-[1700px] mx-auto p-3 sm:p-5 lg:p-6 space-y-6 text-foreground">

        {/* ── TOP ACTION BAR (EXACT ORIGINAL DESIGN) ────────────────────────── */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => !isSalesrepOrReadOnly && navigate("/campaigns?action=new-campaign")}
                className={`bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 ${isSalesrepOrReadOnly ? "opacity-50 blur-[0.5px] pointer-events-none" : ""
                  }`}
                title="Create New Campaign"
                disabled={isSalesrepOrReadOnly}
              >
                <Plus size={18} /> Create New Campaign
              </button>
              <button
                onClick={() => !isSalesrepOrReadOnly && setIsModalOpen(true)}
                className={`btn-secondary h-11 px-6 font-semibold flex items-center justify-center gap-2 ${isSalesrepOrReadOnly ? "opacity-50 blur-[0.5px] pointer-events-none" : ""
                  }`}
                title="Schedule New Follow-Up"
                disabled={isSalesrepOrReadOnly}
              >
                <Clock size={18} /> New Follow-Up
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
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
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setGlobalSearchIndex((prev) => (prev < globalSearchResults.length - 1 ? prev + 1 : 0));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setGlobalSearchIndex((prev) => (prev > 0 ? prev - 1 : globalSearchResults.length - 1));
                    } else if (e.key === "Enter") {
                      if (globalSearchIndex >= 0 && globalSearchResults[globalSearchIndex]) {
                        navigate(`/lead/${globalSearchResults[globalSearchIndex]._id}`);
                        setIsSearchFocused(false);
                      }
                    } else if (e.key === "Escape") {
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
                        className={`w-full text-left p-3 flex items-center justify-between transition-colors ${index === globalSearchIndex ? "bg-accent border-l-4 border-l-primary" : "hover:bg-accent"
                          }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{l.name}</p>
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                              {campaigns.find((c) => c._id === (l as any).campaign_id)?.name || "Lead"}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground uppercase mt-1">
                            {l.type ? <span className="font-bold text-primary/80">{l.type} • </span> : ""}
                            {l.telephone || "No Phone"} {l.city ? `• ${l.city}` : ""}
                          </p>
                        </div>
                        <ArrowRight
                          size={14}
                          className={
                            index === globalSearchIndex
                              ? "text-primary translate-x-1 transition-transform"
                              : "text-muted-foreground"
                          }
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 h-11 px-3 bg-accent/30 border rounded-xl min-w-[150px]">
                <Filter size={14} className="text-muted-foreground" />
                <select
                  id="selected-campaign"
                  name="selected-campaign"
                  className="bg-transparent text-xs font-bold uppercase tracking-wider focus:outline-none flex-1"
                  value={selectedCampaign}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                >
                  <option className="dark:bg-accent" value="all">
                    All Campaigns
                  </option>
                  {campaigns.map((c) => (
                    <option className="dark:bg-accent" key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Animated Live Dashboard Refresh Button (Click-Only Motion) */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing || isManualSpinning}
                className="h-11 px-4 bg-card hover:bg-accent border rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-foreground transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-xs hover:border-primary/40"
                title="Refresh Dashboard Live Data"
              >
                <RefreshCw
                  size={15}
                  className={
                    isRefreshing || isManualSpinning
                      ? "animate-spin text-primary"
                      : "text-muted-foreground"
                  }
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── EA-LEAD TEMPERATURE PIPELINE (PRIORITY 1 & 7 - MANAGER / ADMIN ONLY) ── */}
        {isAdminOrManager && (
          <div className="bg-card border rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 text-rose-500 flex items-center justify-center shadow-inner">
                  <Flame size={20} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground">EA-Lead Temperature Pipeline</h2>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent text-muted-foreground border">
                      {totalTempLeads} Active EA Leads
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time engagement breakdown across Hot, Warm, and Cold EA leads
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Hot ({hotPercentage}%)
                </span>
                <span className="flex items-center gap-1.5 ml-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Warm ({warmPercentage}%)
                </span>
                <span className="flex items-center gap-1.5 ml-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Cold ({coldPercentage}%)
                </span>
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
              {/* Hot Card (Priority 1) */}
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
        )}

        {/* ── 2-COLUMN OPERATIONAL GRID ────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── LEFT OPERATIONAL COLUMN (~65% width) ───────────────────────── */}
          <div className="flex-1 lg:w-[65%] min-w-0 space-y-6">

            {/* 1. Campaign Acquisition Overview */}
            <div className="page-card dark:bg-card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-foreground">Campaign Acquisition Overview</h2>

                {campaigns.length > CAMPAIGNS_PER_PAGE && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setCampaignPage((p) => Math.max(0, p - 1))}
                      disabled={campaignPage === 0}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${campaignPage === 0
                          ? "opacity-20 cursor-not-allowed"
                          : "hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card"
                        }`}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                      {campaignPage + 1} / {Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                    </span>
                    <button
                      onClick={() =>
                        setCampaignPage((p) =>
                          p + 1 < Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE) ? p + 1 : p
                        )
                      }
                      disabled={campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${campaignPage + 1 >= Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)
                          ? "opacity-20 cursor-not-allowed"
                          : "hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card"
                        }`}
                    >
                      <ChevronRight size={16} className="text-emerald-500" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {campaigns.slice(campaignPage * CAMPAIGNS_PER_PAGE, (campaignPage + 1) * CAMPAIGNS_PER_PAGE).map((c) => {
                  const summary = campaignSummaries.find((s) => s._id === c._id) || { totalLeads: 0, meetingsScheduled: 0 };
                  const followUpsDue = rawData?.all?.filter((f) => String(f.campaign_id_val) === c._id).length || 0;
                  return (
                    <div
                      key={c._id}
                      className="group relative bg-accent/10 dark:bg-accent/5 rounded-2xl p-4 transition-all hover:bg-accent/20 border border-transparent hover:border-primary/20"
                    >
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
                            setCampaignFilter(c._id);
                            statsRef.current?.scrollIntoView({ behavior: "smooth" });
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
            </div>

            {/* 2. Stat Cards Grid (5 Cards) */}
            <div ref={statsRef} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard title="Total Campaigns" count={dashboardMetrics?.campaigns?.total || 0} icon={Megaphone} color="text-primary" />
              <StatCard title="Total Leads" count={dashboardMetrics?.leads?.total || 0} icon={Building} color="text-blue-500" />
              <StatCard title="Overdue" count={dashboardMetrics?.followups?.overdue || 0} icon={AlertCircle} color="text-primary/70" />
              <StatCard title="Due Today" count={dashboardMetrics?.followups?.dueToday || 0} icon={Clock} color="text-primary/70" />
              <StatCard title="Upcoming" count={dashboardMetrics?.followups?.upcoming || 0} icon={Calendar} color="text-primary/70" />
            </div>

            {/* 3. Strategic Pipeline */}
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
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getColor(s.status)}`} />
                            {s.status}
                          </span>
                          <div className="flex items-center gap-2">
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

            {/* 4. Weekly AI Executive Briefing Snapshot (Admin & Manager) */}
            {isAdminOrManager && (
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
                        title="Regenerate latest report"
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-background/60 dark:bg-background/40 border rounded-xl p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New Leads (7d)</span>
                        <p className="text-xl font-extrabold text-foreground mt-0.5">{reportNewLeads7d}</p>
                      </div>
                      <div className="bg-background/60 dark:bg-background/40 border rounded-xl p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total In Pipeline</span>
                        <p className="text-xl font-extrabold text-primary mt-0.5">{reportTotalLeads}</p>
                      </div>
                      <div className="bg-background/60 dark:bg-background/40 border rounded-xl p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Follow-Ups Done</span>
                        <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{reportFollowupsDone}</p>
                      </div>
                      <div className="bg-background/60 dark:bg-background/40 border rounded-xl p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hot / Warm EA</span>
                        <p className="text-xl font-extrabold text-amber-500 mt-0.5">{reportHotWarmTotal}</p>
                      </div>
                    </div>

                    <div className="bg-background/40 border rounded-xl p-4 text-xs text-muted-foreground leading-relaxed">
                      <div className="line-clamp-3">{weeklyNarrativePreview}</div>
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
                      No weekly executive briefing has been generated yet. It runs automatically every Monday or on demand.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 5. Priority 9: Meetings Scheduled */}
            <div className="page-card dark:bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <Video size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Meetings Scheduled</h2>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {currentMeetingsList.length} Scheduled
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Upcoming school consultations and HR interviews</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {/* Timeframe Dropdown (Default: Today) */}
                  <select
                    id="meeting-timeframe-select"
                    value={meetingTimeframe}
                    onChange={(e) => {
                      setMeetingTimeframe(e.target.value as "today" | "7d" | "30d" | "all");
                      setMeetingPage(0);
                    }}
                    className="text-xs font-semibold bg-accent/50 hover:bg-accent border border-border/80 rounded-lg px-2.5 py-1 text-foreground focus:outline-none cursor-pointer transition-colors"
                  >
                    <option value="today">Today</option>
                    <option value="7d">Next 7 Days</option>
                    <option value="30d">Next 30 Days</option>
                    <option value="all">All Time</option>
                  </select>

                  {currentMeetingsList.length > MEETINGS_PER_PAGE && (
                    <div className="flex items-center gap-1.5 mr-1">
                      <button
                        onClick={() => setMeetingPage((p) => Math.max(0, p - 1))}
                        disabled={meetingPage === 0}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${meetingPage === 0
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:bg-accent hover:border-blue-500/50 text-foreground/50 hover:text-blue-600 shadow-sm bg-card"
                          }`}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        {meetingPage + 1} / {totalMeetingPages}
                      </span>
                      <button
                        onClick={() => setMeetingPage((p) => (p + 1 < totalMeetingPages ? p + 1 : p))}
                        disabled={meetingPage + 1 >= totalMeetingPages}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${meetingPage + 1 >= totalMeetingPages
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:bg-accent hover:border-blue-500/50 text-foreground/50 hover:text-blue-600 shadow-sm bg-card"
                          }`}
                      >
                        <ChevronRight size={14} className="text-blue-600" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 border-l pl-2">
                    <Link to="/meetings/school" className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
                      School <ArrowRight size={11} />
                    </Link>
                    <Link to="/meetings/hr" className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1">
                      HR <ArrowRight size={11} />
                    </Link>
                    <Link to="/calendar" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                      Calendar <ArrowRight size={11} />
                    </Link>
                  </div>
                </div>
              </div>

              {currentMeetingsList.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <Calendar size={20} className="mx-auto mb-1 opacity-40" />
                  {meetingTimeframe === "today"
                    ? "No consultations or interviews scheduled for today."
                    : meetingTimeframe === "7d"
                      ? "No consultations or interviews scheduled for the next 7 days."
                      : meetingTimeframe === "30d"
                        ? "No consultations or interviews scheduled for the next 30 days."
                        : "No consultations or interviews scheduled."}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {paginatedMeetings.map((m: any) => {
                    const isHr = m.category === "hr";
                    const statusColor = m.status === "completed"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : m.status === "rescheduled"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
                    return (
                      <div
                        key={m._id}
                        className={`p-3 rounded-xl border bg-accent/10 hover:bg-accent/20 transition-all flex items-center justify-between gap-3 border-l-4 ${isHr ? "border-l-purple-500" : "border-l-blue-500"
                          }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground truncate">{m.title}</span>
                            <Link
                              to={isHr ? "/meetings/hr" : "/meetings/school"}
                              className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded hover:opacity-80 transition-opacity ${isHr ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                                }`}
                            >
                              {isHr ? "HR / Staffing" : "School Partner"}
                            </Link>
                            {m.status && (
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${statusColor}`}>
                                {m.status}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {m.dateTime ? new Date(m.dateTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} • {m.duration ? `${m.duration}m` : "30m"} • {m.leadName || m.candidateName || "Contact"}
                            {m.attendees && m.attendees.length > 0 && ` • Attendees: ${m.attendees.join(", ")}`}
                          </p>
                        </div>
                        {m.meetingLink && (
                          <a
                            href={m.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition-all shrink-0"
                          >
                            <Video size={11} /> Join
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Priority 10: Email Campaign Activity (Admin only) */}
            {isAdmin && emailCampaignsList.length > 0 && (
              <div className="page-card dark:bg-card">
                <div className="flex items-center justify-between mb-4 pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
                      <Mail size={16} />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Email Campaign Activity</h2>
                      <p className="text-[10px] text-muted-foreground">Recent SendGrid outreach engagement</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {emailCampaignsList.length > EMAIL_CAMPAIGNS_PER_PAGE && (
                      <div className="flex items-center gap-1.5 mr-1">
                        <button
                          onClick={() => setEmailCampaignPage((p) => Math.max(0, p - 1))}
                          disabled={emailCampaignPage === 0}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${emailCampaignPage === 0
                              ? "opacity-20 cursor-not-allowed"
                              : "hover:bg-accent hover:border-teal-500/50 text-foreground/50 hover:text-teal-600 shadow-sm bg-card"
                            }`}
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                          {emailCampaignPage + 1} / {totalEmailCampaignPages}
                        </span>
                        <button
                          onClick={() => setEmailCampaignPage((p) => (p + 1 < totalEmailCampaignPages ? p + 1 : p))}
                          disabled={emailCampaignPage + 1 >= totalEmailCampaignPages}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${emailCampaignPage + 1 >= totalEmailCampaignPages
                              ? "opacity-20 cursor-not-allowed"
                              : "hover:bg-accent hover:border-teal-500/50 text-foreground/50 hover:text-teal-600 shadow-sm bg-card"
                            }`}
                        >
                          <ChevronRight size={14} className="text-teal-600" />
                        </button>
                      </div>
                    )}
                    <Link to="/email-center" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                      All Campaigns <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {paginatedEmailCampaigns.map((c: any) => (
                    <div key={c._id} className="p-3 rounded-xl border bg-accent/10 flex items-center justify-between gap-3 border-l-4 border-l-teal-500">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground truncate">{c.title}</span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-700">
                            {c.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.subject}</p>
                      </div>
                      <div className="flex items-center gap-4 text-right shrink-0">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Open Rate</span>
                          <span className="text-xs font-black text-emerald-600">
                            {c.openRate || 0}%
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            {c.opens || c.opensCount || 0} opened
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">Clicks</span>
                          <span className="text-xs font-black text-indigo-600">
                            {c.clicks || c.clicksCount || 0}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            {c.clickRate || 0}% rate
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Pagination Controls when campaigns > 5 */}
                {emailCampaignsList.length > EMAIL_CAMPAIGNS_PER_PAGE && (
                  <div className="pt-2.5 pb-1 border-t flex items-center justify-between px-2 text-xs mt-3">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Showing {emailCampaignPage * EMAIL_CAMPAIGNS_PER_PAGE + 1}–{Math.min((emailCampaignPage + 1) * EMAIL_CAMPAIGNS_PER_PAGE, emailCampaignsList.length)} of {emailCampaignsList.length} campaigns
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEmailCampaignPage((p) => Math.max(0, p - 1))}
                        disabled={emailCampaignPage === 0}
                        className="px-2.5 py-1 text-xs rounded-md border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all"
                      >
                        Previous
                      </button>
                      <span className="px-2 text-[11px] font-bold text-muted-foreground">
                        {emailCampaignPage + 1} / {totalEmailCampaignPages}
                      </span>
                      <button
                        onClick={() => setEmailCampaignPage((p) => (p + 1 < totalEmailCampaignPages ? p + 1 : p))}
                        disabled={emailCampaignPage + 1 >= totalEmailCampaignPages}
                        className="px-2.5 py-1 text-xs rounded-md border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. Priority 8: Retell AI Call Summary (Admin only) */}
            {isAdmin && widgets.retellCallSummary && (() => {
              const summaryData = widgets.retellCallSummary[telephonyTimeframe] || widgets.retellCallSummary;
              return (
                <div className="page-card dark:bg-card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
                        <PhoneCall size={16} />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Retell AI Telephony Summary</h2>
                        <p className="text-[10px] text-muted-foreground">Inbound AI operations and rep transfers</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {/* Timeframe Dropdown */}
                      <select
                        id="telephony-timeframe-select"
                        value={telephonyTimeframe}
                        onChange={(e) => setTelephonyTimeframe(e.target.value as "today" | "7d" | "30d" | "all")}
                        className="text-xs font-semibold bg-accent/50 hover:bg-accent border border-border/80 rounded-lg px-2.5 py-1 text-foreground focus:outline-none cursor-pointer transition-colors"
                      >
                        <option value="today">Today</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="all">All Time</option>
                      </select>

                      <div className="flex items-center gap-2 border-l border-border/70 pl-2.5">
                        <Link to="/call-history" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                          Calls <ArrowRight size={11} />
                        </Link>
                        <Link to="/voicemail-inbox" className="text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1">
                          Voicemails <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/80 text-center">
                      <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider block">AI Inbound Calls</span>
                      <span className="text-xl font-extrabold text-violet-600 mt-0.5 block">{summaryData.aiCalls ?? summaryData.aiCallsToday ?? 0}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {telephonyTimeframe === "today"
                          ? "Handled today"
                          : telephonyTimeframe === "7d"
                            ? "Past 7 days"
                            : telephonyTimeframe === "30d"
                              ? "Past 30 days"
                              : "Total handled"}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 text-center">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Rep Transfers</span>
                      <span className="text-xl font-extrabold text-indigo-600 mt-0.5 block">{summaryData.transfersCompleted ?? 0}</span>
                      <span className="text-[10px] text-muted-foreground">Connected</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 text-center">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Voicemails</span>
                      <span className="text-xl font-extrabold text-slate-700 mt-0.5 block">{summaryData.voicemails ?? summaryData.voicemailsToday ?? 0}</span>
                      <span className="text-[10px] text-muted-foreground">{summaryData.voicemailsUnread ?? 0} unread</span>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>

          {/* ── RIGHT OPERATIONAL COLUMN (~35% width — LIVE SMS ACTION PANELS) ─ */}
          <div className="w-full lg:w-[35%] space-y-6">

            {/* PANEL 1: LIVE SMS ACTION PANEL (PRIORITY 3) */}
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
                        onClick={() => setSmsPage((p) => Math.max(0, p - 1))}
                        disabled={smsPage === 0}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${smsPage === 0
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card"
                          }`}
                        title="Previous Page"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        {smsPage + 1} / {totalSmsPages}
                      </span>
                      <button
                        onClick={() => setSmsPage((p) => (p + 1 < totalSmsPages ? p + 1 : p))}
                        disabled={smsPage + 1 >= totalSmsPages}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${smsPage + 1 >= totalSmsPages
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:bg-accent hover:border-primary/50 text-foreground/50 hover:text-primary shadow-sm bg-card"
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
                    className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-all active:scale-90"
                    title="Refresh SMS activity"
                  >
                    <RefreshCw size={13} className={loadingUnreadSms ? "animate-spin text-primary" : ""} />
                  </button>
                </div>
              </div>

              {/* Sub-Tabs: Hot & Warm vs All EA Leads */}
              <div className="flex border-b text-xs font-semibold bg-accent/10">
                <button
                  onClick={() => {
                    setActiveSmsTab("hot_warm");
                    setSmsPage(0);
                  }}
                  className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${activeSmsTab === "hot_warm"
                      ? "border-rose-500 text-rose-600 dark:text-rose-400 bg-background/50 font-bold"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Flame size={13} className="text-rose-500" />
                  <span>Hot & Warm</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 font-bold ml-1">
                    {hotWarmSmsList.length}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setActiveSmsTab("all");
                    setSmsPage(0);
                  }}
                  className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${activeSmsTab === "all"
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
                {paginatedSmsList && paginatedSmsList.length > 0 ? (
                  paginatedSmsList.map((msg: any, idx: number) => {
                    const isHot = msg.aiScore === "Hot";
                    const isWarm = msg.aiScore === "Warm";
                    return (
                      <div
                        key={msg.leadId || idx}
                        className={`p-3 rounded-xl border bg-accent/10 hover:bg-accent/20 transition-all border-l-4 flex items-center justify-between gap-3 group ${isHot
                            ? "border-l-rose-500 bg-rose-500/5"
                            : isWarm
                              ? "border-l-amber-500 bg-amber-500/5"
                              : "border-l-sky-500 bg-sky-500/5"
                          }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground truncate">{msg.senderName}</span>
                            {(msg.unreadCount ?? 0) > 0 && (
                              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Unread replies" />
                            )}
                          </div>
                          {msg.message && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">"{msg.message}"</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isHot && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              <Flame size={12} className="text-rose-500" /> Hot
                            </span>
                          )}
                          {isWarm && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              <Sun size={12} className="text-amber-500" /> Warm
                            </span>
                          )}
                          <button
                            onClick={() =>
                              handleOpenSmsModal({
                                leadId: msg.leadId,
                                name: msg.senderName,
                                phone: msg.phone,
                                leadType: msg.leadType || "ea_lead"
                              })
                            }
                            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm shadow-primary/20 transition-all active:scale-95"
                            title="Reply to SMS"
                          >
                            <Send size={11} /> Reply
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 px-4 text-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${activeSmsTab === "hot_warm" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                        }`}
                    >
                      {activeSmsTab === "hot_warm" ? <Flame size={20} /> : <CheckCircle2 size={20} />}
                    </div>
                    <p className="text-xs font-bold text-foreground">
                      {activeSmsTab === "hot_warm" ? "No Hot or Warm EA Leads" : "No EA Leads"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {activeSmsTab === "hot_warm" ? "Hot and Warm EA leads will appear here." : "No EA leads found with recent SMS activity."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL 2: STALLED LEADS ACTION PANEL (PRIORITY 2) */}
            <div className="page-card dark:bg-card p-0 overflow-hidden border border-amber-500/20 shadow-sm">
              <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-card to-amber-500/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Stalled Leads Action Panel</h2>
                    <p className="text-[10px] text-muted-foreground">Needs attention today</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {displayedStalledList.length > STALLED_PER_PAGE && (
                    <div className="flex items-center gap-1.5 mr-1">
                      <button
                        onClick={() => setStalledPage((p) => Math.max(0, p - 1))}
                        disabled={stalledPage === 0}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${stalledPage === 0
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:bg-accent hover:border-amber-500/50 text-foreground/50 hover:text-amber-600 shadow-sm bg-card"
                          }`}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        {stalledPage + 1} / {totalStalledPages}
                      </span>
                      <button
                        onClick={() => setStalledPage((p) => (p + 1 < totalStalledPages ? p + 1 : p))}
                        disabled={stalledPage + 1 >= totalStalledPages}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${stalledPage + 1 >= totalStalledPages
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:bg-accent hover:border-amber-500/50 text-foreground/50 hover:text-amber-600 shadow-sm bg-card"
                          }`}
                      >
                        <ChevronRight size={14} className="text-amber-600" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleTriggerStalledScan}
                    disabled={isScanningStalled}
                    className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-amber-600 transition-all active:scale-90"
                    title="Scan for stalled leads"
                  >
                    <RefreshCw size={13} className={isScanningStalled ? "animate-spin text-amber-600" : ""} />
                  </button>
                </div>
              </div>

              {/* Single View Header */}
              <div className="px-4 py-2.5 border-b text-xs font-semibold bg-accent/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-foreground font-bold">
                  <AlertTriangle size={13} className="text-amber-500" />
                  <span>All Stalled Leads</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold border border-amber-500/20">
                  {rawStalledList.length} Leads
                </span>
              </div>

              <div className="p-3 space-y-2">
                {paginatedStalledList && paginatedStalledList.length > 0 ? (
                  paginatedStalledList.map((lead: any) => (
                    <div
                      key={lead._id}
                      className="p-3 rounded-xl border bg-amber-500/5 hover:bg-amber-500/10 transition-all border-l-4 border-l-amber-500 flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground truncate">{lead.name}</span>
                          <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full border ${lead.leadType === "ea_lead" || lead.leadType === "ea"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted text-muted-foreground border-border"
                            }`}>
                            {lead.leadType === "ea_lead" || lead.leadType === "ea" ? "EA Lead" : "CRM Lead"}
                          </span>
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700">
                            {lead.daysInactive}d
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {lead.draftMessage || lead.stalledReason || "Claude draft queued..."}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            if (lead.leadType === "ea_lead" || lead.leadType === "ea") {
                              navigate(`/ea-leads?leadId=${lead._id}`);
                            } else {
                              navigate(`/lead/${lead._id}`);
                            }
                          }}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                          title={`View ${lead.leadType === 'ea_lead' || lead.leadType === 'ea' ? 'EA' : 'CRM'} lead details`}
                        >
                          <Eye size={13} />
                          <span>See</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 px-4 text-center">
                    <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs font-bold text-foreground">No Stalled Leads</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">All leads have received recent engagement.</p>
                  </div>
                )}

                {/* Bottom Pagination Controls when leads > 5 */}
                {displayedStalledList.length > STALLED_PER_PAGE && (
                  <div className="pt-2.5 pb-1 border-t flex items-center justify-between px-2 text-xs">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Showing {stalledPage * STALLED_PER_PAGE + 1}–{Math.min((stalledPage + 1) * STALLED_PER_PAGE, displayedStalledList.length)} of {displayedStalledList.length} leads
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setStalledPage((p) => Math.max(0, p - 1))}
                        disabled={stalledPage === 0}
                        className="px-2.5 py-1 text-xs rounded-md border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all"
                      >
                        Previous
                      </button>
                      <span className="px-2 text-[11px] font-bold text-muted-foreground">
                        {stalledPage + 1} / {totalStalledPages}
                      </span>
                      <button
                        onClick={() => setStalledPage((p) => (p + 1 < totalStalledPages ? p + 1 : p))}
                        disabled={stalledPage + 1 >= totalStalledPages}
                        className="px-2.5 py-1 text-xs rounded-md border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL 3: TASKS & FOLLOW-UPS (PRIORITY 4 — EXACT ORIGINAL DESIGN) */}
            <div className="page-card dark:bg-card p-0 overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Tasks & Follow-Ups</h2>
              </div>
              <div className="flex border-b">
                {[
                  { id: "overdue", label: "Overdue" },
                  { id: "due", label: "Today" },
                  { id: "upcoming", label: "Upcoming" }
                ].map((tab) => (
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
              <div className="max-h-[360px] overflow-y-auto p-2 space-y-2">
                {(filteredData?.[activeTaskTab] || []).map((f) => {
                  const statusStyles =
                    {
                      overdue: "border-l-destructive bg-destructive/5",
                      due: "border-l-warning bg-warning/5",
                      upcoming: "border-l-success bg-success/5"
                    }[activeTaskTab] || "border-l-border bg-accent/5";

                  return (
                    <div
                      key={f._id}
                      title={`${f.lead_name} - ${f.type}${f.title ? ` (${f.title})` : ""}: ${f.notes || "No notes"}`}
                      className={`border rounded-xl p-3 group flex items-start justify-between border-l-4 transition-all hover:shadow-sm ${statusStyles}`}
                    >
                      <div className="min-w-0 flex-1">
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
                          {f.telephone && (
                            <button
                              onClick={() => {
                                const cleanPhone = f.telephone!.startsWith("+") ? f.telephone! : `+1${f.telephone!.replace(/\D/g, "")}`;
                                openDialer(cleanPhone, f.lead_id_val, f.lead_name, true);
                              }}
                              className="p-1 hover:bg-emerald-100 text-muted-foreground hover:text-emerald-600 rounded transition-colors"
                              title="Call contact"
                            >
                              <Phone size={14} />
                            </button>
                          )}
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

            {/* PANEL 4: AI SUGGESTIONS PANEL (PRIORITY 5) */}
            <div className="page-card dark:bg-card p-0 overflow-hidden border border-purple-500/20 shadow-sm">
              <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-card to-purple-500/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">AI Next-Action Suggestions</h2>
                    <p className="text-[10px] text-muted-foreground">Claude recommended actions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {aiSuggestionsList.length > AI_SUGGESTIONS_PER_PAGE && (
                    <div className="flex items-center gap-1.5 mr-1">
                      <button
                        onClick={() => setAiSuggestionPage((p) => Math.max(0, p - 1))}
                        disabled={aiSuggestionPage === 0}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${aiSuggestionPage === 0
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:bg-accent hover:border-purple-500/50 text-foreground/50 hover:text-purple-600 shadow-sm bg-card"
                          }`}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        {aiSuggestionPage + 1} / {totalAiSuggestionPages}
                      </span>
                      <button
                        onClick={() => setAiSuggestionPage((p) => (p + 1 < totalAiSuggestionPages ? p + 1 : p))}
                        disabled={aiSuggestionPage + 1 >= totalAiSuggestionPages}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${aiSuggestionPage + 1 >= totalAiSuggestionPages
                            ? "opacity-20 cursor-not-allowed"
                            : "hover:bg-accent hover:border-purple-500/50 text-foreground/50 hover:text-purple-600 shadow-sm bg-card"
                          }`}
                      >
                        <ChevronRight size={14} className="text-purple-600" />
                      </button>
                    </div>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                    {aiSuggestionsList.length} Pending
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-2">
                {aiSuggestionsList.length === 0 ? (
                  <div className="py-6 px-4 text-center">
                    <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs font-bold text-foreground">All Suggestions Reviewed</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">No pending AI next actions awaiting approval.</p>
                  </div>
                ) : (
                  paginatedAiSuggestions.map((item: any) => (
                    <div
                      key={item.leadId}
                      className="p-3 rounded-xl border bg-purple-500/5 hover:bg-purple-500/10 transition-all border-l-4 border-l-purple-500 flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground truncate">{item.name}</span>
                          <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-full border ${item.leadType === "ea_lead" || item.leadType === "ea"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted text-muted-foreground border-border"
                            }`}>
                            {item.leadType === "ea_lead" || item.leadType === "ea" ? "EA Lead" : "CRM Lead"}
                          </span>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {item.priority || "Action"}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 truncate mt-0.5">
                          {item.action}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.reason}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            if (item.leadType === "ea_lead" || item.leadType === "ea") {
                              navigate(`/ea-leads?leadId=${item.leadId}`);
                            } else {
                              navigate(`/lead/${item.leadId}`);
                            }
                          }}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-2.5 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                          title={`View ${item.leadType === 'ea_lead' || item.leadType === 'ea' ? 'EA' : 'CRM'} lead details`}
                        >
                          <Eye size={13} />
                          <span>See</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAiSuggestion(item);
                            setAiDetailModalOpen(true);
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                          title="View AI next step details"
                        >
                          <Sparkles size={13} />
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}

                {/* Bottom Pagination Controls when suggestions > 5 */}
                {aiSuggestionsList.length > AI_SUGGESTIONS_PER_PAGE && (
                  <div className="pt-2.5 pb-1 border-t flex items-center justify-between px-2 text-xs">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Showing {aiSuggestionPage * AI_SUGGESTIONS_PER_PAGE + 1}–{Math.min((aiSuggestionPage + 1) * AI_SUGGESTIONS_PER_PAGE, aiSuggestionsList.length)} of {aiSuggestionsList.length} suggestions
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setAiSuggestionPage((p) => Math.max(0, p - 1))}
                        disabled={aiSuggestionPage === 0}
                        className="px-2.5 py-1 text-xs rounded-md border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all"
                      >
                        Previous
                      </button>
                      <span className="px-2 text-[11px] font-bold text-muted-foreground">
                        {aiSuggestionPage + 1} / {totalAiSuggestionPages}
                      </span>
                      <button
                        onClick={() => setAiSuggestionPage((p) => (p + 1 < totalAiSuggestionPages ? p + 1 : p))}
                        disabled={aiSuggestionPage + 1 >= totalAiSuggestionPages}
                        className="px-2.5 py-1 text-xs rounded-md border bg-card hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL 5: QUICK ACTIONS (EXACT ORIGINAL DESIGN) */}
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
                    {
                      label: "Send Email",
                      icon: Mail,
                      onClick: () => {
                        setLeadSearch("");
                        setLeads([]);
                        setIsEmailModalOpen(true);
                      },
                      color: "bg-indigo-500/10 text-indigo-500"
                    },
                    {
                      label: "Export Report",
                      icon: Search,
                      onClick: () => toast.info("Report generated"),
                      color: "bg-emerald-500/10 text-emerald-500"
                    }
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

      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}

      {/* 1. Log Call / Outreach Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen} modal={false}>
        <DialogContent
          aria-describedby={undefined}
          hideOverlay={true}
          className="w-[90vw] max-w-lg dark:bg-card max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl border-2 border-border/80"
        >
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-lg">Log Call / Outreach</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {!selectedLeadResult ? (
              <div className="grid gap-3">
                <label htmlFor="search-by-lead-name" className="text-xs font-bold uppercase text-muted-foreground">
                  Select Lead to Log
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <input
                    id="search-by-lead-name"
                    name="search-by-lead-name"
                    className={`input-field pl-9 ${quickFollowUpErrors.lead ? "border-destructive focus:ring-destructive/20" : ""}`}
                    placeholder="Search by lead name..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                  />
                </div>
                {quickFollowUpErrors.lead && <p className="text-[10px] text-destructive">{quickFollowUpErrors.lead}</p>}
                <div className="max-h-[180px] overflow-y-auto border rounded-lg divide-y">
                  {leads.map((s, index) => (
                    <button
                      key={s._id}
                      className="w-full text-left p-2.5 transition-colors text-xs hover:bg-accent"
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
                      <div className="text-[10px] text-muted-foreground">
                        {s.telephone || "No phone"} {s.city ? `• ${s.city}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
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
                      className={`btn-primary h-9 px-4 flex items-center justify-center gap-2 shadow-sm ${isReadOnly ? "opacity-40 blur-[0.5px] pointer-events-none cursor-not-allowed" : ""
                        }`}
                    >
                      <Phone size={14} fill="currentColor" />
                      <span>Call Now</span>
                    </button>
                    <button className="text-[10px] font-bold text-primary hover:underline" onClick={() => setSelectedLeadResult(null)}>
                      Change Lead
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Call Outcome</div>
                    <div className="relative p-1 bg-accent/30 rounded-xl border border-border/50 flex flex-wrap gap-1">
                      {["Interested", "Not Interested", "Follow-Up Needed", "Left Voicemail", "No Answer", "Wrong Number"].map((outcome) => (
                        <button
                          key={outcome}
                          onClick={() => setCallOutcome(outcome)}
                          className={`flex-1 min-w-[100px] py-2 px-1 text-[10px] font-bold rounded-lg transition-all ${callOutcome === outcome ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          {outcome}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Calendar size={12} /> Next Follow-up Date & Time
                    </label>
                    <DateTimePicker
                      size="sm"
                      value={followUpDate}
                      onChange={(val) => {
                        setFollowUpDate(val);
                        if (val) setQuickFollowUpErrors({ ...quickFollowUpErrors, date: "" });
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Notes & Details</label>
                    <textarea
                      className="input-field min-h-[80px] text-xs py-2.5"
                      placeholder="Briefly describe the interaction..."
                      value={followUpNotes}
                      onChange={(e) => setFollowUpNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <button className="btn-secondary h-10 px-6 rounded-lg text-xs" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            {!isReadOnly && (
              <button className="btn-primary h-10 px-8 rounded-lg text-xs font-bold" onClick={() => submitFollowUp()}>
                Schedule Follow-up
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Edit Follow-up Modal */}
      <Dialog
        open={isFollowUpEditModalOpen}
        onOpenChange={(open) => {
          setIsFollowUpEditModalOpen(open);
          if (!open) setEditingFollowUp(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Edit Follow-up</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Title</label>
              <input
                type="text"
                className="w-full text-xs p-2.5 rounded-lg border bg-background text-foreground"
                value={followUpTitle}
                onChange={(e) => setFollowUpTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Follow-up Time</label>
              <DateTimePicker value={followUpDate} onChange={setFollowUpDate} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Type</label>
                <select
                  value={followUpType}
                  onChange={(e) => setFollowUpType(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border bg-background text-foreground"
                >
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Task">Task</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Status</label>
                <select
                  value={followUpStatus}
                  onChange={(e) => setFollowUpStatus(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border bg-background text-foreground"
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Notes / Instructions</label>
              <textarea
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border bg-background text-foreground"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <button onClick={() => setIsFollowUpEditModalOpen(false)} className="btn-secondary px-4 text-xs">
              Cancel
            </button>
            <button onClick={submitEditFollowUp} disabled={isSubmitting} className="btn-primary px-5 text-xs font-bold">
              {isSubmitting ? "Saving..." : "Update"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Send Quick Email Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-2xl dark:bg-card p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2 border-b flex-shrink-0">
            <DialogTitle className="dark:text-foreground">Send Quick Email</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 py-4 custom-scrollbar min-h-0 space-y-4">
            {!selectedLeadForEmail ? (
              <div className="grid gap-3">
                <label className="text-sm font-semibold">Select Lead to Email</label>
                <input
                  className="input-field"
                  placeholder="Search by lead name..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
                <div className="max-h-[200px] overflow-y-auto border rounded-xl divide-y">
                  {leads.map((s) => (
                    <button
                      key={s._id}
                      className="w-full text-left p-3 transition-colors text-sm hover:bg-accent"
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
                  <button className="text-xs text-primary font-bold" onClick={() => setSelectedLeadForEmail(null)}>
                    Change
                  </button>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">
                    Recipient Email <span className="text-destructive">*</span>
                  </label>
                  {leadContacts.length > 0 ? (
                    <select
                      className="input-field"
                      value={selectedContactEmail}
                      onChange={(e) => setSelectedContactEmail(e.target.value)}
                    >
                      {leadContacts.map((c) => (
                        <option key={c._id} value={c.email}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input-field text-sm opacity-50 cursor-not-allowed"
                      disabled
                      placeholder="No email on file — contact has no saved emails"
                    />
                  )}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">
                    Email Subject <span className="text-destructive">*</span>
                  </label>
                  <input
                    className="input-field"
                    value={emailData.subject}
                    onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold">
                    Message Content <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    className="input-field min-h-[150px]"
                    value={emailData.body}
                    onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="p-6 pt-2 border-t flex-shrink-0">
            <button className="btn-secondary" onClick={() => setIsEmailModalOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary flex items-center justify-center gap-2" onClick={sendQuickEmail}>
              <Send size={16} /> Send via Gmail
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Quick SMS Modal */}
      <Dialog open={smsModalOpen} onOpenChange={setSmsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <MessageSquare size={18} className="text-primary" />
              Direct SMS Outreach: {smsTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Send an instant personalized text message to {smsTarget?.phone || "the lead"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-accent/30 p-2.5 rounded-lg border">
              <div>
                <strong>Recipient:</strong> {smsTarget?.name} ({smsTarget?.leadType === "ea_lead" ? "EA Lead" : "CRM Lead"})
              </div>
              <div className="font-mono">{smsTarget?.phone || "No phone"}</div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Text Message</label>
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={4}
                className="w-full text-xs font-mono p-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
                placeholder="Type your SMS message..."
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1">
                <span>Standard rates apply</span>
                <span>{smsMessage.length} characters</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <button onClick={() => setSmsModalOpen(false)} className="btn-secondary px-3 text-xs">
              Cancel
            </button>
            <button
              onClick={handleSendQuickSms}
              disabled={isSendingSms || !smsMessage.trim()}
              className="btn-primary px-4 text-xs font-bold flex items-center gap-1.5"
            >
              <Send size={13} className={isSendingSms ? "animate-spin" : ""} />
              {isSendingSms ? "Sending..." : "Send SMS"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Re-engage Stalled Lead Modal */}
      <Dialog open={reengageModalOpen} onOpenChange={setReengageModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <AlertTriangle size={18} className="text-amber-500" />
              Re-engage Stalled Lead: {selectedStalledLead?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Dispatches this message and clears the stalled inactivity flag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              <div>
                <strong>Lead:</strong> {selectedStalledLead?.name}
              </div>
              <div className="font-bold text-amber-700 dark:text-amber-300">
                {selectedStalledLead?.daysInactive} days inactive
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">Claude Draft Re-engagement Message</label>
              <textarea
                value={reengageMessage}
                onChange={(e) => setReengageMessage(e.target.value)}
                rows={4}
                className="w-full text-xs font-mono p-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <button onClick={() => setReengageModalOpen(false)} className="btn-secondary px-3 text-xs">
              Cancel
            </button>
            <button
              onClick={handleSendReengage}
              disabled={isSendingReengage || !reengageMessage.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Send size={13} className={isSendingReengage ? "animate-spin" : ""} />
              {isSendingReengage ? "Sending..." : "Send Re-engagement"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Confirm Mark Done Dialog */}
      <Dialog open={isConfirmDoneOpen} onOpenChange={setIsConfirmDoneOpen}>
        <DialogContent aria-describedby={undefined} className="w-[90vw] max-w-sm dark:bg-card">
          <DialogHeader>
            <DialogTitle className="dark:text-foreground text-center font-bold">Confirm Completion</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">Are you sure you want to mark this task as completed?</p>
          </div>
          <DialogFooter className="flex-row gap-2">
            <button className="btn-secondary flex-1" onClick={() => setIsConfirmDoneOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmDone}>
              Yes, Mark Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Weekly AI Report Full Modal (Admin / Manager only) */}
      {isAdminOrManager && (
        <Dialog open={isWeeklyReportModalOpen} onOpenChange={setIsWeeklyReportModalOpen}>
          <DialogContent className="w-[95vw] max-w-5xl max-h-[92vh] flex flex-col p-6 sm:p-8">
            <DialogHeader className="pb-2 border-b">
              <div className="flex items-center gap-3">
                <span className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <Sparkles size={24} />
                </span>
                <div>
                  <DialogTitle className="text-xl font-bold">Weekly AI Executive Briefing</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Claude AI weekly team operations synthesis and performance insights
                  </p>
                </div>
              </div>
            </DialogHeader>

            {weeklyReport && (
              <div className="flex-1 overflow-y-auto pr-2 space-y-4 my-4">
                <div
                  className="bg-accent/20 border rounded-2xl p-6 text-sm text-foreground/90 leading-relaxed font-normal shadow-sm [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-2 [&_h3:first-child]:mt-0 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1 [&_strong]:text-foreground [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{
                    __html: weeklyReport.executiveSummary || "<p>No briefing content generated.</p>"
                  }}
                />
              </div>
            )}

            <DialogFooter className="pt-2 border-t">
              <button onClick={() => setIsWeeklyReportModalOpen(false)} className="btn-secondary px-5 text-xs">
                Close
              </button>
              <button
                onClick={() => {
                  setIsWeeklyReportModalOpen(false);
                  handleGenerateWeeklyReport();
                }}
                disabled={isGeneratingWeeklyReport}
                className="btn-primary flex items-center gap-2 px-5 text-xs"
              >
                <RefreshCw size={13} className={isGeneratingWeeklyReport ? "animate-spin" : ""} />
                Regenerate
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* 8. AI Next Step Details Modal */}
      <Dialog open={aiDetailModalOpen} onOpenChange={setAiDetailModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  AI Next Step Details
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Claude AI recommended next course of action for this lead
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedAiSuggestion && (
            <div className="space-y-4 py-2">
              {/* Lead Identity Bar */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-accent/20 border border-border/60">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{selectedAiSuggestion.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {selectedAiSuggestion.phone && <span>{selectedAiSuggestion.phone}</span>}
                    {selectedAiSuggestion.phone && selectedAiSuggestion.email && <span>•</span>}
                    {selectedAiSuggestion.email && <span>{selectedAiSuggestion.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${selectedAiSuggestion.leadType === "ea_lead" || selectedAiSuggestion.leadType === "ea"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted text-muted-foreground border-border"
                    }`}>
                    {selectedAiSuggestion.leadType === "ea_lead" || selectedAiSuggestion.leadType === "ea" ? "EA Lead" : "CRM Lead"}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    {selectedAiSuggestion.priority || "Action"}
                  </span>
                </div>
              </div>

              {/* Recommended Action Box */}
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  <CheckCircle2 size={14} className="text-purple-600" />
                  <span>Recommended Next Action</span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {selectedAiSuggestion.action}
                </p>
              </div>

              {/* Strategic AI Rationale */}
              <div className="p-4 rounded-xl border bg-card/60 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Strategic AI Rationale</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedAiSuggestion.reason || "Claude evaluated recent engagement, lead temperature, and activity status to recommend this next operational step."}
                </p>
              </div>

              {/* Key Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl border bg-background space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Calendar size={12} className="text-primary" /> Recommended Due Date
                  </span>
                  <p className="font-semibold text-foreground">
                    {selectedAiSuggestion.recommendedDueDate
                      ? new Date(selectedAiSuggestion.recommendedDueDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })
                      : "Immediate / Today"}
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-background space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Clock size={12} className="text-amber-500" /> Lead Temperature
                  </span>
                  <p className="font-semibold text-foreground">
                    {selectedAiSuggestion.aiScore || "Warm"}
                  </p>
                </div>

                {selectedAiSuggestion.assignedTo && (
                  <div className="p-3 rounded-xl border bg-background space-y-1 col-span-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Assigned Representative
                    </span>
                    <p className="font-semibold text-foreground">
                      {selectedAiSuggestion.assignedTo}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t">
            <button
              onClick={() => setAiDetailModalOpen(false)}
              className="btn-secondary px-4 text-xs"
            >
              Close
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAiDetailModalOpen(false);
                  if (selectedAiSuggestion?.leadType === "ea_lead" || selectedAiSuggestion?.leadType === "ea") {
                    navigate(`/ea-leads?leadId=${selectedAiSuggestion.leadId}`);
                  } else if (selectedAiSuggestion?.leadId) {
                    navigate(`/lead/${selectedAiSuggestion.leadId}`);
                  }
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <Eye size={13} />
                <span>Go to Lead</span>
              </button>
              <button
                onClick={async () => {
                  if (selectedAiSuggestion) {
                    await handleAcceptSuggestion(selectedAiSuggestion);
                    setAiDetailModalOpen(false);
                  }
                }}
                disabled={processingSuggestionId === selectedAiSuggestion?.leadId}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 size={13} />
                <span>Accept as Task</span>
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
