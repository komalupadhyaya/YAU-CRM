import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/permissions";
import { 
  Mail, 
  Plus, 
  Users, 
  FileText, 
  Send, 
  Calendar, 
  Trash2, 
  BarChart3, 
  Upload, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Clock,
  Eye,
  Settings,
  ChevronRight,
  TrendingUp,
  Inbox,
  MousePointerClick,
  UserX,
  Search,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useNavigate, useSearchParams } from "react-router-dom";

interface Segment {
  _id: string;
  name: string;
  description?: string;
  type: "dynamic" | "static" | "campaign" | "csv";
  filters?: {
    source?: string;
    sport?: string;
    location?: string;
    status?: string;
    campaignId?: string | { _id: string; name: string };
  };
  contacts?: {
    name?: string;
    email: string;
    status: "active" | "opted_out" | "bounced" | "failed";
  }[];
}

interface Campaign {
  _id: string;
  title: string;
  subject: string;
  content: string;
  segmentId: Segment | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  sendAt?: string;
  sentAt?: string;
  stats: {
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    unsubscribes: number;
    bounces: number;
  };
  recipientLogs?: any[];
}

interface EmailConversation {
  _id: string;
  leadType: "ea_lead" | "main_lead";
  name: string;
  email: string;
  phone?: string;
  categoryTag: string;
  isConsent: boolean;
  lastMessage: string;
  lastMessageTimestamp: string;
}

interface EmailHistoryItem {
  _id: string;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  cc?: string;
  to: string;
  timestamp: string;
  type: "direct" | "bulk";
  status?: string;
  campaignTitle?: string;
  error?: string | null;
}

interface DbTemplate {
  _id: string;
  name: string;
  category: string;
  subject: string;
  content: string;
  isAiGenerated?: boolean;
  aiPrompt?: string;
  createdAt?: string;
}

export default function EmailCenter() {
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const isPrivileged = currentUser?.role === "admin" || currentUser?.role === "manager";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialWorkspace = (searchParams.get("workspace") as "campaigns" | "inbox") || "campaigns";
  const initialTab = (searchParams.get("tab") as "campaigns" | "segments" | "templates") || "campaigns";

  // Workspace Toggle: 'campaigns' | 'inbox'
  const [workspace, setWorkspaceState] = useState<"campaigns" | "inbox">(
    ["campaigns", "inbox"].includes(initialWorkspace) ? initialWorkspace : "campaigns"
  );

  const [activeTab, setActiveTabState] = useState<"campaigns" | "segments" | "templates">(
    ["campaigns", "segments", "templates"].includes(initialTab) ? initialTab : "campaigns"
  );

  // Helper functions to update state & sync URL
  const setWorkspace = (ws: "campaigns" | "inbox") => {
    setWorkspaceState(ws);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set("workspace", ws);
      return p;
    }, { replace: true });
  };

  const setActiveTab = (tab: "campaigns" | "segments" | "templates") => {
    setActiveTabState(tab);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set("tab", tab);
      return p;
    }, { replace: true });
  };

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  
  // Database Template & Groq AI States
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isAiTemplateModalOpen, setIsAiTemplateModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [templateSubjectInput, setTemplateSubjectInput] = useState("");
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [aiCategoryInput, setAiCategoryInput] = useState("General");
  const [aiToneInput, setAiToneInput] = useState("Professional & Warm");
  const [isGeneratingAiTemplate, setIsGeneratingAiTemplate] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Live AI Draft Template State
  const [aiDraftTemplate, setAiDraftTemplate] = useState<{
    name: string;
    subject: string;
    content: string;
    category: string;
  } | null>(null);

  const [previewTab, setPreviewTab] = useState<"visual" | "code">("visual");

  // 1-to-1 Emailing States
  const [conversations, setConversations] = useState<EmailConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<EmailConversation | null>(null);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [conversationsSearch, setConversationsSearch] = useState("");
  const [conversationsFilter, setConversationsFilter] = useState<"all" | "ea_lead" | "main_lead" | "opted_out">("all");
  const [conversationsSort, setConversationsSort] = useState<"recent" | "name">("recent");

  // 1-to-1 Compose Form
  const [composeForm, setComposeForm] = useState({
    subject: "",
    cc: "",
    body: ""
  });
  const [isComposeExpanded, setIsComposeExpanded] = useState(false);

  // Loader States
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog States
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isViewStatsOpen, setIsViewStatsOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Campaign Form State
  const [campaignForm, setCampaignForm] = useState({
    title: "",
    subject: "",
    content: "",
    segmentId: "",
    sendAt: "",
    isScheduled: false,
    templateId: null as string | null
  });

  // Segment Form State
  const [segmentForm, setSegmentForm] = useState({
    name: "",
    description: "",
    type: "csv" as "csv" | "static" | "campaign" | "dynamic",
    filters: {
      source: "",
      sport: "",
      location: "",
      status: "",
      campaignId: ""
    },
    leadIds: [] as string[],
    leadModel: "Lead" as "Lead" | "EALead",
    customContacts: [] as { name: string; email: string }[]
  });

  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [salesCampaigns, setSalesCampaigns] = useState<{ _id: string; name: string }[]>([]);
  const [contactCategoryFilter, setContactCategoryFilter] = useState<"all" | "main_lead" | "ea_lead" | "team_member">("all");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [customContactName, setCustomContactName] = useState("");
  const [customContactEmail, setCustomContactEmail] = useState("");

  const [campaignPreviewContacts, setCampaignPreviewContacts] = useState<{ name: string; email: string }[]>([]);
  const [loadingCampaignPreview, setLoadingCampaignPreview] = useState(false);
  const [campaignPreviewSearch, setCampaignPreviewSearch] = useState("");
  const [campaignSelectedIds, setCampaignSelectedIds] = useState<string[]>([]);

  // Inline CSV Import State inside Segment Builder
  const [csvParsedContacts, setCsvParsedContacts] = useState<{ name: string; email: string }[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvSearchQuery, setCsvSearchQuery] = useState("");
  const [csvSelectedEmails, setCsvSelectedEmails] = useState<string[]>([]);

  // State for View Segment Contacts Modal
  const [selectedSegmentForView, setSelectedSegmentForView] = useState<Segment | null>(null);
  const [isViewSegmentModalOpen, setIsViewSegmentModalOpen] = useState(false);
  const [viewSegmentSearchQuery, setViewSegmentSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast.success("Email copied to clipboard");
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const filteredViewSegmentContacts = React.useMemo(() => {
    if (!selectedSegmentForView?.contacts) return [];
    if (!viewSegmentSearchQuery.trim()) return selectedSegmentForView.contacts;
    const q = viewSegmentSearchQuery.toLowerCase().trim();
    return selectedSegmentForView.contacts.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      c.email.toLowerCase().includes(q)
    );
  }, [selectedSegmentForView, viewSegmentSearchQuery]);

  // State for Campaign Analytics & Recipient Inspector
  const [campaignRecipientSearch, setCampaignRecipientSearch] = useState("");
  const [campaignRecipientFilter, setCampaignRecipientFilter] = useState<string>("all");

  const filteredCampaignRecipients = React.useMemo(() => {
    if (!selectedCampaign?.recipientLogs) return [];
    let list = selectedCampaign.recipientLogs;

    if (campaignRecipientFilter !== "all") {
      list = list.filter(log => log.status === campaignRecipientFilter);
    }

    if (campaignRecipientSearch.trim()) {
      const q = campaignRecipientSearch.toLowerCase().trim();
      list = list.filter(log =>
        (log.name && log.name.toLowerCase().includes(q)) ||
        log.email.toLowerCase().includes(q)
      );
    }

    return list;
  }, [selectedCampaign, campaignRecipientFilter, campaignRecipientSearch]);

  // State for Re-running Campaigns Confirmation Modal
  const [campaignToRerun, setCampaignToRerun] = useState<Campaign | null>(null);
  const [isConfirmRerunOpen, setIsConfirmRerunOpen] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);

  const handleExecuteRerun = async () => {
    if (!campaignToRerun) return;
    try {
      setIsRerunning(true);
      const res = await api.post(`/emails/campaigns/${campaignToRerun._id}/rerun`);
      toast.success(res.data?.message || "Campaign re-dispatched successfully!");
      setIsConfirmRerunOpen(false);
      setCampaignToRerun(null);
      fetchCampaigns();
      if (selectedCampaign?._id === campaignToRerun._id) {
        setSelectedCampaign(res.data?.campaign || campaignToRerun);
      }
    } catch (err: any) {
      console.error("Re-run Campaign error:", err);
      toast.error(err.response?.data?.error || "Failed to re-run campaign.");
    } finally {
      setIsRerunning(false);
    }
  };

  const filteredCampaignPreviewContacts = React.useMemo(() => {
    if (!campaignPreviewSearch.trim()) return campaignPreviewContacts;
    const q = campaignPreviewSearch.toLowerCase().trim();
    return campaignPreviewContacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [campaignPreviewContacts, campaignPreviewSearch]);

  const filteredCsvParsedContacts = React.useMemo(() => {
    if (!csvSearchQuery.trim()) return csvParsedContacts;
    const q = csvSearchQuery.toLowerCase().trim();
    return csvParsedContacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [csvParsedContacts, csvSearchQuery]);

  // Global selection breakdown calculation across all 3 sections
  const selectionBreakdown = React.useMemo(() => {
    const csvCount = csvSelectedEmails.length;
    
    let crmCount = 0;
    let eaCount = 0;
    let teamCount = 0;

    segmentForm.leadIds.forEach(id => {
      const found = availableContacts.find(c => c._id === id);
      if (found) {
        if (found.leadType === "main_lead") crmCount++;
        else if (found.leadType === "ea_lead") eaCount++;
        else if (found.leadType === "team_member") teamCount++;
      }
    });

    const customCount = segmentForm.customContacts.length;
    const campaignCount = campaignSelectedIds.length;

    const totalSet = new Set<string>();

    // 1. CSV
    csvParsedContacts.forEach(c => {
      if (csvSelectedEmails.includes(c.email)) totalSet.add(c.email.toLowerCase().trim());
    });

    // 2. Manual
    segmentForm.leadIds.forEach(id => {
      const found = availableContacts.find(c => c._id === id);
      if (found?.email) totalSet.add(found.email.toLowerCase().trim());
    });

    // 3. Custom
    segmentForm.customContacts.forEach(c => {
      if (c.email) totalSet.add(c.email.toLowerCase().trim());
    });

    // 4. Campaign
    campaignPreviewContacts.forEach((c: any) => {
      const key = c.leadId || c.email;
      if (campaignSelectedIds.includes(key) && c.email) {
        totalSet.add(c.email.toLowerCase().trim());
      }
    });

    return {
      totalUnique: totalSet.size,
      csvCount,
      crmCount,
      eaCount,
      teamCount,
      campaignCount,
      customCount
    };
  }, [csvSelectedEmails, csvParsedContacts, segmentForm.leadIds, availableContacts, segmentForm.customContacts, campaignSelectedIds, campaignPreviewContacts]);

  const handleInlineCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    if (!segmentForm.name) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setSegmentForm(prev => ({ ...prev, name: `CSV List - ${cleanName}` }));
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/);
      if (lines.length === 0) return;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      let emailIdx = headers.findIndex(h => h.includes('email'));
      let nameIdx = headers.findIndex(h => h.includes('name') || h.includes('first'));

      if (emailIdx === -1) {
        emailIdx = 0;
      }

      const parsed: { name: string; email: string }[] = [];
      const seenEmails = new Set<string>();

      for (let i = (headers.some(h => h.includes('@')) ? 0 : 1); i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const email = cols[emailIdx]?.toLowerCase();
        if (!email || !email.includes('@')) continue;

        if (seenEmails.has(email)) continue;
        seenEmails.add(email);

        const name = (nameIdx !== -1 && cols[nameIdx]) ? cols[nameIdx] : email.split('@')[0];
        parsed.push({ name, email });
      }

      setCsvParsedContacts(parsed);
      setCsvSelectedEmails(parsed.map(c => c.email));
      toast.success(`Loaded ${parsed.length} contacts from CSV!`);
    };
    reader.readAsText(file);
  };

  // Fetch campaign contact preview whenever segmentForm.filters.campaignId changes
  useEffect(() => {
    if (segmentForm.type === "campaign" && segmentForm.filters.campaignId) {
      setLoadingCampaignPreview(true);
      api.get(`/emails/segments/preview-campaign/${segmentForm.filters.campaignId}`)
        .then(res => {
          const list = res.data || [];
          setCampaignPreviewContacts(list);
          const allContactIds = list.map((c: any) => c.leadId || c.email);
          setCampaignSelectedIds(allContactIds);
        })
        .catch(err => {
          console.error("Failed to load campaign preview contacts", err);
          setCampaignPreviewContacts([]);
          setCampaignSelectedIds([]);
        })
        .finally(() => {
          setLoadingCampaignPreview(false);
        });
    } else if (segmentForm.type !== "static") {
      setCampaignPreviewContacts([]);
      setCampaignSelectedIds([]);
    }
  }, [segmentForm.type, segmentForm.filters.campaignId]);

  const fetchAvailableContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const [convRes, teamRes, campRes] = await Promise.allSettled([
        api.get("/emails/conversations"),
        api.get("/team"),
        api.get("/campaigns")
      ]);

      let combined: any[] = [];
      if (convRes.status === "fulfilled") {
        combined = [...convRes.value.data];
      }
      if (teamRes.status === "fulfilled") {
        const teamContacts = teamRes.value.data.map((member: any) => ({
          _id: member._id,
          leadType: "team_member",
          name: member.name || member.username,
          email: member.email,
          phone: member.phone || "",
          categoryTag: "Team Member",
          isConsent: true
        }));
        combined = [...combined, ...teamContacts];
      }
      setAvailableContacts(combined);

      if (campRes.status === "fulfilled") {
        setSalesCampaigns(campRes.value.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load contacts for selection");
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  // CSV Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSegmentName, setImportSegmentName] = useState("");

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showComposeAiPanel, setShowComposeAiPanel] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await api.get("/emails/campaigns");
      setCampaigns(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load email campaigns");
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  const fetchSegments = useCallback(async () => {
    setLoadingSegments(true);
    try {
      const res = await api.get("/emails/segments");
      setSegments(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load segments");
    } finally {
      setLoadingSegments(false);
    }
  }, []);

  // Fetch Database Email Templates
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.get("/templates");
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load email templates from database");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // Groq AI Template Generator Handler (Updates Live Draft Preview with Iterative Context)
  const handleGenerateAiTemplate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPromptInput.trim()) {
      toast.error("Please enter a prompt for Groq AI!");
      return;
    }
    setIsGeneratingAiTemplate(true);
    try {
      const fullPrompt = `${aiPromptInput.trim()}. Preferred Tone/Style: ${aiToneInput}.`;
      
      const payload: { prompt: string; category: string; existingContent?: string } = {
        prompt: fullPrompt,
        category: aiCategoryInput || "AI Generated"
      };

      // Pass existing HTML content if doing an iterative refinement/follow-up prompt
      if (aiDraftTemplate?.content) {
        payload.existingContent = aiDraftTemplate.content;
      }

      const res = await api.post("/templates/ai-generate", payload);
      toast.success(`Template layout generated with Groq AI! Click "Save to Database" when ready.`);
      
      // Auto-fill top fields
      setTemplateNameInput(res.data.name);
      setTemplateSubjectInput(res.data.subject);
      
      setAiDraftTemplate({
        name: res.data.name,
        subject: res.data.subject,
        content: res.data.content,
        category: res.data.category || aiCategoryInput
      });
      // Note: Only previewed in UI, not added to templates list until user clicks "Save to Database"
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to generate AI template");
    } finally {
      setIsGeneratingAiTemplate(false);
    }
  };

  // Save Current Live AI Draft Template to MongoDB
  const handleSaveDraftTemplate = async () => {
    const finalName = templateNameInput.trim() || aiDraftTemplate?.name;
    const finalSubject = templateSubjectInput.trim() || aiDraftTemplate?.subject;
    const finalContent = aiDraftTemplate?.content;

    if (!finalName || !finalSubject || !finalContent) {
      toast.error("Please ensure Template Name, Subject, and Content are generated/filled!");
      return;
    }

    setIsSavingTemplate(true);
    try {
      const res = await api.post("/templates", {
        name: finalName,
        category: aiCategoryInput || aiDraftTemplate?.category || "General",
        subject: finalSubject,
        content: finalContent,
        isAiGenerated: true,
        aiPrompt: aiPromptInput.trim()
      });
      toast.success("Template saved to database!");
      setTemplates(prev => [res.data, ...prev]);
      setIsAiTemplateModalOpen(false);
      setAiDraftTemplate(null);
    } catch (err) {
      toast.error("Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Use Current Live AI Draft Directly in Campaign Form
  const handleUseDraftInCampaign = () => {
    const finalSubject = templateSubjectInput.trim() || aiDraftTemplate?.subject;
    const finalContent = aiDraftTemplate?.content;

    if (!finalSubject || !finalContent) {
      toast.error("Please generate a template first!");
      return;
    }

    setCampaignForm(prev => ({
      ...prev,
      subject: finalSubject,
      content: finalContent,
    }));
    toast.success("Template applied to new campaign!");
    setIsAiTemplateModalOpen(false);
    setIsCampaignModalOpen(true);
  };

  // Delete DB Template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template from the database?")) return;
    try {
      await api.delete(`/templates/${id}`);
      toast.success("Template deleted");
      setTemplates(prev => prev.filter(t => t._id !== id));
    } catch (err) {
      toast.error("Failed to delete template");
    }
  };

  // Inject Database Template into Campaign Form
  const injectDbTemplate = (tpl: DbTemplate) => {
    setCampaignForm(prev => ({
      ...prev,
      subject: tpl.subject,
      content: tpl.content,
      templateId: tpl._id
    }));
    toast.success(`Template "${tpl.name}" applied!`);
    setIsCampaignModalOpen(true);
  };

  // Fetch 1-to-1 conversations list
  const fetchConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await api.get("/emails/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load conversations");
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // Fetch individual 1-to-1 conversation history
  const fetchHistory = useCallback(async (leadId: string) => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/emails/conversations/${leadId}`);
      setEmailHistory(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load email history thread");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (workspace === "campaigns") {
      fetchCampaigns();
      fetchSegments();
      fetchTemplates();
    } else {
      fetchConversations();
    }
  }, [workspace, activeTab, fetchCampaigns, fetchSegments, fetchTemplates, fetchConversations]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedConversation) {
      fetchHistory(selectedConversation._id);
    }
  }, [selectedConversation, fetchHistory]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [emailHistory, selectedConversation]);

  // Handle Campaign Creation
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignForm.title || !campaignForm.subject || !campaignForm.content || !campaignForm.segmentId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: campaignForm.title,
        subject: campaignForm.subject,
        content: campaignForm.content,
        segmentId: campaignForm.segmentId,
        sendAt: campaignForm.isScheduled && campaignForm.sendAt ? campaignForm.sendAt : null,
        templateId: campaignForm.templateId
      };

      const res = await api.post("/emails/campaigns", payload);
      toast.success(campaignForm.isScheduled ? "Campaign scheduled!" : "Campaign draft created!");
      
      if (!campaignForm.isScheduled) {
        await api.post(`/emails/campaigns/${res.data._id}/send`);
        toast.success("Campaign dispatch started!");
      }

      setIsCampaignModalOpen(false);
      setCampaignForm({ title: "", subject: "", content: "", segmentId: "", sendAt: "", isScheduled: false, templateId: null });
      fetchCampaigns();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Segment Creation
  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentForm.name) {
      toast.error("Segment name is required");
      return;
    }

    if (segmentForm.type === "csv" && csvParsedContacts.length === 0) {
      toast.error("Please upload a valid CSV file with contacts");
      return;
    }

    if (segmentForm.type === "static" && segmentForm.leadIds.length === 0 && segmentForm.customContacts.length === 0) {
      toast.error("Please select at least one contact or add a custom contact");
      return;
    }

    if (segmentForm.type === "campaign" && !segmentForm.filters.campaignId) {
      toast.error("Please select a target Sales Campaign");
      return;
    }

    setIsSubmitting(true);
    try {
      let contacts: { name: string; email: string; status: string }[] = [];
      // 1. Selected CSV contacts
      const selectedCsvContacts = csvParsedContacts
        .filter(c => csvSelectedEmails.includes(c.email))
        .map(c => ({ name: c.name, email: c.email, status: "active" }));

      // 2. Selected Manual CRM/EA/Team contacts
      const selectedCRMContacts = segmentForm.leadIds.map(id => {
        const found = availableContacts.find(c => c._id === id);
        return found ? { name: found.name, email: found.email, status: "active" } : null;
      }).filter(Boolean) as { name: string; email: string; status: string }[];

      // 3. Custom contacts
      const selectedCustomContacts = segmentForm.customContacts.map(c => ({
        name: c.name,
        email: c.email,
        status: "active"
      }));

      // 4. Selected Sales Campaign contacts
      const selectedCampaignContacts = campaignPreviewContacts
        .filter((c: any) => campaignSelectedIds.includes(c.leadId || c.email))
        .map((c: any) => ({ name: c.name, email: c.email, status: "active" }));

      contacts = [
        ...selectedCsvContacts,
        ...selectedCRMContacts,
        ...selectedCustomContacts,
        ...selectedCampaignContacts
      ];

      // Deduplicate contacts list by email (case-insensitive)
      if (contacts.length > 0) {
        const uniqueMap = new Map<string, { name: string; email: string; status: string }>();
        const originalLength = contacts.length;
        contacts.forEach(c => {
          if (c.email) {
            const normalized = c.email.toLowerCase().trim();
            if (!uniqueMap.has(normalized)) {
              uniqueMap.set(normalized, { ...c, email: normalized });
            }
          }
        });
        contacts = Array.from(uniqueMap.values());
        const removedDuplicates = originalLength - contacts.length;
        if (removedDuplicates > 0) {
          toast.info(`Removed ${removedDuplicates} duplicate email(s)`);
        }
      }

      const payload = {
        name: segmentForm.name,
        description: segmentForm.description,
        type: segmentForm.type,
        filters: segmentForm.type === "dynamic" ? segmentForm.filters :
                 segmentForm.type === "campaign" ? { campaignId: segmentForm.filters.campaignId } :
                 undefined,
        contacts: (segmentForm.type === "static" || segmentForm.type === "campaign" || segmentForm.type === "csv") ? contacts : undefined
      };

      await api.post("/emails/segments", payload);
      toast.success("Segment created successfully!");
      setIsSegmentModalOpen(false);
      setSegmentForm({
        name: "",
        description: "",
        type: "csv",
        filters: { source: "", sport: "", location: "", status: "", campaignId: "" },
        leadIds: [],
        leadModel: "Lead",
        customContacts: []
      });
      setContactCategoryFilter("all");
      setContactsSearchQuery("");
      setCustomContactName("");
      setCustomContactEmail("");
      setCsvParsedContacts([]);
      setCsvFileName("");
      setCsvSearchQuery("");
      setCsvSelectedEmails([]);
      setCampaignSelectedIds([]);
      fetchSegments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create segment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle CSV Contact Import
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("Please select a CSV file to upload");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("name", importSegmentName || `Imported List - ${importFile.name}`);

    try {
      const res = await api.post("/emails/segments/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(res.data.message || "CSV list imported successfully!");
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportSegmentName("");
      fetchSegments();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to import CSV list");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Segment
  const handleDeleteSegment = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this segment?")) return;
    try {
      await api.delete(`/emails/segments/${id}`);
      toast.success("Segment deleted successfully");
      fetchSegments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete segment");
    }
  };

  // AI draft composer trigger
  const handleAiDraftGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt describing the email goal");
      return;
    }
    setAiGenerating(true);
    try {
      const res = await api.post("/emails/ai-generate-email", {
        leadId: selectedConversation?._id || segments[0]?.contacts?.[0]?.email || "64cb20790d96d741a4bc5171",
        leadType: selectedConversation?.leadType || "main_lead",
        userPrompt: aiPrompt.trim()
      });
      
      if (workspace === "campaigns") {
        setCampaignForm(prev => ({
          ...prev,
          subject: res.data.subject || prev.subject,
          content: res.data.body || prev.content
        }));
      } else {
        setComposeForm(prev => ({
          ...prev,
          subject: res.data.subject || prev.subject,
          body: res.data.body || prev.body
        }));
      }
      toast.success("AI draft generated successfully!");
      setShowComposeAiPanel(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate AI email template");
    } finally {
      setAiGenerating(false);
    }
  };

  // Pre-designed templates injection
  const injectTemplate = (type: string) => {
    let subject = "";
    let content = "";

    if (type === "announcement") {
      subject = "New Youth Sports Programs Launching Soon! 🚀";
      content = `<h2>Get Ready for Next Season!</h2>
                 <p>Hi {{name}},</p>
                 <p>We are thrilled to announce that registration for our upcoming youth athletic development programs is officially opening next week! Our coaching staff has prepared an elite curriculum to take your child's skills and fitness to the next level.</p>
                 <p><strong>What's New:</strong></p>
                 <ul>
                   <li>Elite Speed & Agility Clinics</li>
                   <li>Sport-Specific Advanced Drills</li>
                   <li>Mental Conditioning Sessions</li>
                 </ul>
                 <p>Spots are strictly limited to ensure personal training attention. Click the button below to reserve early access:</p>
                 <p><a href="https://youthathleteuniversity.org" style="background:#0066cc;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Reserve Early Spot</a></p>
                 <br/><p>Best regards,<br/>The YAU Coaching Team</p>`;
    } else if (type === "followup") {
      subject = "Checking In: Your Athletic Goals 🏆";
      content = `<p>Hi {{name}},</p>
                 <p>I wanted to follow up and see if you had any questions regarding our sports programs or schedules we discussed earlier.</p>
                 <p>At Youth Athlete University, we focus on building self-discipline, teamwork, and top-tier athletic capabilities. Whether your child is starting out or looking to secure a varsity/college roster spot, we have custom tracks built for their success.</p>
                 <p>Would you have 5 minutes for a quick consultation call this week to align on their development plan?</p>
                 <br/><p>Best regards,<br/>YAU Admissions Team</p>`;
    } else {
      subject = "YAU Sports Monthly Newsletter 📰";
      content = `<h2>Youth Athlete Development Monthly</h2>
                 <p>Hi {{name}},</p>
                 <p>Here is your monthly round-up of tips, training drills, and success stories from the Youth Athlete University community.</p>
                 <h3>Training Tip of the Month: Recovery</h3>
                 <p>Did you know that muscle growth and conditioning adaptations happen during rest, not workouts? Ensure your young athletes are getting at least 8-9 hours of sleep and hydrating properly to prevent fatigue and sports injuries.</p>
                 <h3>Athlete Spotlight</h3>
                 <p>Shoutout to our program alumni who secured championships in their local league last weekend! Keep grinding!</p>
                 <br/><p>Yours in sports,<br/>The YAU Family</p>`;
    }

    setCampaignForm(prev => ({ ...prev, subject, content, templateId: type }));
    toast.success("Template injected!");
  };

  // Send 1-to-1 Email via OAuth Gmail connection
  const handleSendOneToOneEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation) return;
    if (!composeForm.subject || !composeForm.body) {
      toast.error("Subject and body message content are required!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        lead_id: selectedConversation.leadType === "main_lead" ? selectedConversation._id : undefined,
        to: selectedConversation.email,
        cc: composeForm.cc || undefined,
        subject: composeForm.subject,
        body: composeForm.body
      };

      await api.post("/emails/send", payload);
      toast.success("1-to-1 Email successfully sent!");
      
      // Update Notes log Locally
      setComposeForm({ subject: "", cc: "", body: "" });
      fetchHistory(selectedConversation._id);
      fetchConversations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to deliver email. Check OAuth token credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter & sort 1-to-1 conversations list
  const filteredConversations = React.useMemo(() => {
    let result = conversations.filter(conv => {
      // Filter type
      if (conversationsFilter === "ea_lead") return conv.leadType === "ea_lead";
      if (conversationsFilter === "main_lead") return conv.leadType === "main_lead";
      if (conversationsFilter === "opted_out") return conv.isConsent === false;
      return true;
    });

    if (conversationsSearch.trim()) {
      const q = conversationsSearch.toLowerCase().trim();
      result = result.filter(conv => 
        conv.name.toLowerCase().includes(q) || 
        conv.email.toLowerCase().includes(q)
      );
    }

    if (conversationsSort === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      result.sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
    }

    return result;
  }, [conversations, conversationsFilter, conversationsSearch, conversationsSort]);

  const filteredContactsForSelection = React.useMemo(() => {
    let list = availableContacts;
    if (contactCategoryFilter !== "all") {
      list = list.filter(c => c.leadType === contactCategoryFilter);
    }
    if (!contactsSearchQuery.trim()) return list;
    const q = contactsSearchQuery.toLowerCase().trim();
    return list.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.email.toLowerCase().includes(q)
    );
  }, [availableContacts, contactsSearchQuery, contactCategoryFilter]);

  const toggleContactSelection = (contactId: string, leadType: "ea_lead" | "main_lead" | "team_member") => {
    setSegmentForm(prev => {
      const isSelected = prev.leadIds.includes(contactId);
      let updatedLeadIds;
      if (isSelected) {
        updatedLeadIds = prev.leadIds.filter(id => id !== contactId);
      } else {
        updatedLeadIds = [...prev.leadIds, contactId];
      }
      return {
        ...prev,
        leadIds: updatedLeadIds,
        leadModel: leadType === "ea_lead" ? "EALead" : "Lead"
      };
    });
  };

  const handleAddCustomContact = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!customContactName.trim() || !customContactEmail.trim()) {
      toast.error("Both name and email are required for custom contacts");
      return;
    }
    if (!customContactEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    const exists = segmentForm.customContacts.some(
      c => c.email.toLowerCase() === customContactEmail.trim().toLowerCase()
    );
    if (exists) {
      toast.error("A contact with this email has already been added");
      return;
    }
    setSegmentForm(prev => ({
      ...prev,
      customContacts: [
        ...prev.customContacts,
        { name: customContactName.trim(), email: customContactEmail.trim() }
      ]
    }));
    setCustomContactName("");
    setCustomContactEmail("");
    toast.success("Custom contact added!");
  };

  const handleRemoveCustomContact = (email: string) => {
    setSegmentForm(prev => ({
      ...prev,
      customContacts: prev.customContacts.filter(c => c.email !== email)
    }));
  };

  return (
    <AppLayout>
      <div className="p-4 pt-1 space-y-3 max-w-7xl mx-auto flex-1 flex flex-col min-h-0">
        {/* Tier 1: Unified Top Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b pb-2.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight dark:text-foreground">Email Center</h1>
              <p className="text-xs text-muted-foreground">Manage campaigns, CSV segments, reusable templates & 1-to-1 inbox.</p>
            </div>
          </div>

          {/* Center: Sub-Tabs when in Campaigns workspace */}
          {workspace === "campaigns" && (
            <div className="flex items-center bg-accent/30 border p-1 rounded-xl shrink-0 text-xs font-bold">
              {(["campaigns", "segments", "templates"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-card text-foreground shadow-2xs font-extrabold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "segments" ? "Lists & Segments" : tab === "campaigns" ? "Campaigns" : "Templates"}
                </button>
              ))}
            </div>
          )}

          {/* Right: Workspace Toggle Pills */}
          <div className="flex items-center bg-accent/40 border p-1 rounded-xl shrink-0">
            <button
              onClick={() => setWorkspace("campaigns")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                workspace === "campaigns" 
                  ? "bg-primary text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Marketing Workspace
            </button>
            <button
              onClick={() => setWorkspace("inbox")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                workspace === "inbox" 
                  ? "bg-primary text-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              1-to-1 Inbox
            </button>
          </div>
        </div>

        {/* --- WORKSPACE A: CAMPAIGNS & MARKETING --- */}
        {workspace === "campaigns" && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {/* Tier 2: Dynamic Contextual Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 px-4 rounded-2xl border shadow-2xs shrink-0">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  {activeTab === "campaigns" ? "Email Marketing Campaigns" :
                   activeTab === "segments" ? "Recipient Lists & Segments" :
                   "Database Email Templates"}
                </h3>
                <p className="text-xs text-foreground font-semibold mt-0.5">
                  {activeTab === "campaigns" ? "Track email dispatches, open rates, click-throughs, and campaign performance." :
                   activeTab === "segments" ? "Target leads with CSV imports, static contact lists, or sales funnels." :
                   "Manage reusable HTML email layouts and generate new templates with Groq AI."}
                </p>
              </div>

              {/* Contextual Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {activeTab === "campaigns" && (
                  <button
                    onClick={() => setIsCampaignModalOpen(true)}
                    className="btn-primary h-8.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus size={14} /> New Campaign
                  </button>
                )}

                {activeTab === "segments" && (
                  <>
                    <button
                      onClick={() => setIsImportModalOpen(true)}
                      className="btn-secondary h-8.5 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Upload size={14} /> Import List (CSV)
                    </button>
                    <button
                      onClick={() => {
                        fetchAvailableContacts();
                        setIsSegmentModalOpen(true);
                      }}
                      className="btn-secondary h-8.5 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Create List & Segment
                    </button>
                  </>
                )}

                {activeTab === "templates" && (
                  <button
                    onClick={() => setIsAiTemplateModalOpen(true)}
                    className="h-8.5 px-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Sparkles size={13} className="animate-pulse" /> Generate AI Template (Groq AI)
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {activeTab === "campaigns" && (
                <div className="space-y-6">
                  {loadingCampaigns ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="animate-spin text-primary h-8 w-8" />
                    </div>
                  ) : campaigns.length === 0 ? (
                    <div className="text-center py-20 border rounded-2xl bg-card">
                      <Inbox size={48} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                      <h3 className="text-base font-bold">No Campaigns Sent</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                        Start communicating with your leads by composing your first email marketing campaign!
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {campaigns.map((camp) => {
                        const delRate = camp.stats.sent > 0 ? Math.round((camp.stats.delivered / camp.stats.sent) * 100) : 0;
                        const openRate = camp.stats.delivered > 0 ? Math.round((camp.stats.opens / camp.stats.delivered) * 100) : 0;
                        const clickRate = camp.stats.delivered > 0 ? Math.round((camp.stats.clicks / camp.stats.delivered) * 100) : 0;

                        return (
                          <div
                            key={camp._id}
                            onClick={() => {
                              setSelectedCampaign(camp);
                              setCampaignRecipientSearch("");
                              setCampaignRecipientFilter("all");
                              setIsViewStatsOpen(true);
                            }}
                            className="bg-card rounded-2xl border border-border/80 border-t-2 border-t-primary p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-primary/50 cursor-pointer transition-all text-left group"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border ${
                                  camp.status === "sent" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                                  camp.status === "scheduled" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                                  "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                                }`}>
                                  {camp.status}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                  {camp.sentAt ? new Date(camp.sentAt).toLocaleDateString() : 
                                   camp.sendAt ? `Scheduled: ${new Date(camp.sendAt).toLocaleString()}` : "Draft"}
                                </span>
                              </div>
                              <div>
                                <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors tracking-tight">{camp.title}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">Subject: {camp.subject}</p>
                              </div>
                              
                              {camp.status === "sent" && (
                                <div className="space-y-2 pt-2 border-t border-border/60">
                                  <div className="grid grid-cols-3 text-center gap-1 bg-accent/20 p-2 rounded-xl border border-border/50">
                                    <div>
                                      <div className="text-xs font-extrabold text-foreground">{delRate}%</div>
                                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Delivered</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-extrabold text-primary">{openRate}%</div>
                                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Open Rate</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{clickRate}%</div>
                                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Click Rate</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
                              <span className="text-[10px] text-muted-foreground truncate">
                                Segment: <strong className="text-foreground font-bold">{camp.segmentId?.name || "None"}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCampaign(camp);
                                  setCampaignRecipientSearch("");
                                  setCampaignRecipientFilter("all");
                                  setIsViewStatsOpen(true);
                                }}
                                className="h-8 px-3 bg-primary/10 group-hover:bg-primary group-hover:text-white text-primary rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                              >
                                <Eye size={13} /> Analytics & Recipients
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "segments" && (
                <div className="space-y-6">
                  {loadingSegments ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="animate-spin text-primary h-8 w-8" />
                    </div>
                  ) : segments.length === 0 ? (
                    <div className="text-center py-20 border rounded-2xl bg-card">
                      <Users size={48} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                      <h3 className="text-base font-bold">No Lists & Segments Configured</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                        Create list & segment filters or upload static mailing lists via CSV files to target your campaigns.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {segments.map((seg) => (
                        <div
                          key={seg._id}
                          onClick={() => {
                            setSelectedSegmentForView(seg);
                            setViewSegmentSearchQuery("");
                            setIsViewSegmentModalOpen(true);
                          }}
                          className="bg-card rounded-2xl border border-border/80 border-t-2 border-t-primary p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-primary/50 cursor-pointer transition-all text-left group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border ${
                                seg.type === "csv" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" :
                                seg.type === "campaign" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                                "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
                              }`}>
                                {seg.type === "csv" ? "CSV Import" : seg.type === "campaign" ? "Sales Campaign" : "Static List"}
                              </span>
                              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 bg-accent/30 px-2 py-0.5 rounded-full">
                                <Users size={11} className="text-primary" /> {seg.contacts?.length || 0} Recipients
                              </span>
                            </div>

                            <h3 className="font-bold text-sm text-foreground mt-3 tracking-tight group-hover:text-primary transition-colors">{seg.name}</h3>
                            {seg.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{seg.description}</p>
                            )}

                            {seg.type === "campaign" && (
                              <div className="mt-3 pt-2.5 border-t border-border/60">
                                <span className="text-[11px] text-muted-foreground block">
                                  Funnel Campaign: <strong className="text-foreground">
                                    {typeof seg.filters?.campaignId === "object" ? seg.filters.campaignId.name : "Sales Campaign Leads"}
                                  </strong>
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSegmentForView(seg);
                                setViewSegmentSearchQuery("");
                                setIsViewSegmentModalOpen(true);
                              }}
                              className="h-8 px-3 bg-primary/10 group-hover:bg-primary group-hover:text-white text-primary rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                            >
                              <Eye size={13} /> View Recipients ({seg.contacts?.length || 0})
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSegment(seg._id);
                              }}
                              className="h-8 w-8 p-0 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl flex items-center justify-center transition-colors shrink-0"
                              title="Delete Segment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "templates" && (
                <div className="space-y-4">
                  {loadingTemplates ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="animate-spin text-primary h-7 w-7" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-card rounded-2xl border p-8 space-y-3">
                      <FileText className="h-10 w-10 opacity-30 text-primary" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">No Database Templates Found</p>
                        <p className="text-xs text-muted-foreground">Click "Generate AI Template" above to create one using Groq AI.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {templates.map(tpl => (
                        <div key={tpl._id} className="bg-card rounded-2xl border p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                tpl.isAiGenerated ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20" : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              }`}>
                                {tpl.isAiGenerated ? "✨ Groq AI" : tpl.category || "General"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {tpl.createdAt ? new Date(tpl.createdAt).toLocaleDateString() : ""}
                              </span>
                            </div>
                            <h3 className="font-bold text-sm text-foreground mt-2.5 truncate">{tpl.name}</h3>
                            <p className="text-xs font-medium text-primary mt-1 truncate">Subject: {tpl.subject}</p>
                            {tpl.aiPrompt && (
                              <p className="text-[11px] text-muted-foreground italic mt-1 line-clamp-2">"{tpl.aiPrompt}"</p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t">
                            <button
                              onClick={() => handleDeleteTemplate(tpl._id)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl flex items-center justify-center transition-colors"
                              title="Delete Template"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              onClick={() => injectDbTemplate(tpl)}
                              className="h-8 px-3.5 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-primary/95 transition-colors"
                            >
                              Use Template <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- WORKSPACE B: 1-to-1 EMAILING WORKSPACE (WhatsApp / Intercom Chat Interface) --- */}
        {workspace === "inbox" && (
          <div className="h-[calc(100vh-135px)] flex border rounded-2xl overflow-hidden bg-card/40 shadow-sm relative shrink-0">
            {/* 1. Left Sidebar conversations panel */}
            <div className="w-80 border-r flex flex-col shrink-0 bg-card h-full overflow-hidden">
              {/* Search & Sort dropdown header */}
              <div className="p-3.5 border-b space-y-2.5 shrink-0 bg-card">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search inbox..."
                      value={conversationsSearch}
                      onChange={e => setConversationsSearch(e.target.value)}
                      className="pl-8 h-8.5 input-field text-xs rounded-xl"
                    />
                  </div>
                  <select
                    value={conversationsSort}
                    onChange={e => setConversationsSort(e.target.value as "recent" | "name")}
                    className="h-8.5 input-field text-[11px] w-20 dark:bg-card shrink-0 px-2 rounded-xl"
                  >
                    <option value="recent">Recent</option>
                    <option value="name">Name</option>
                  </select>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1">
                  {[
                    { id: "all", label: "All" },
                    { id: "main_lead", label: "CRM" },
                    { id: "ea_lead", label: "EA" },
                    { id: "opted_out", label: "Opted Out" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setConversationsFilter(tab.id as any)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        conversationsFilter === tab.id
                          ? "bg-primary text-white border-primary shadow-2xs"
                          : "bg-accent/15 hover:bg-accent/40 text-muted-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Conversations list */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {loadingConversations ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="animate-spin text-primary h-5 w-5" />
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center px-4 space-y-2">
                    <Inbox className="text-muted-foreground opacity-40 h-8 w-8" />
                    <p className="text-xs font-semibold text-foreground">No Campaign Recipients Found</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Only contacts who have received campaign or 1-to-1 emails will appear in this inbox.
                    </p>
                  </div>
                ) : (
                  filteredConversations.map(conv => {
                    const isSelected = selectedConversation?._id === conv._id;
                    const initials = conv.name.substring(0, 2).toUpperCase();

                    return (
                      <div
                        key={conv._id}
                        onClick={() => setSelectedConversation(conv)}
                        className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-primary/10 border border-primary/20 text-foreground shadow-2xs" 
                            : "hover:bg-accent/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="h-9 w-9 rounded-full bg-primary/15 text-primary font-extrabold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs truncate text-foreground">{conv.name}</span>
                            <span className="text-[9px] text-muted-foreground shrink-0">
                              {new Date(conv.lastMessageTimestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground block truncate mt-0.5">{conv.email}</span>
                          <span className="text-[10px] text-foreground/80 block truncate mt-1 italic line-clamp-1">
                            {conv.lastMessage.replace(/<[^>]*>/g, "")}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. Right Messaging Frame (WhatsApp / SMS-Style Chat Thread) */}
            <div className="flex-1 flex flex-col min-w-0 bg-accent/5 h-full overflow-hidden">
              {selectedConversation ? (
                <>
                  {/* Chat Header (Pinned at Top) */}
                  <div className="p-3.5 px-4 border-b bg-card flex justify-between items-center shrink-0 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/15 text-primary font-extrabold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                        {selectedConversation.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-foreground truncate">{selectedConversation.name}</h3>
                          <span className="bg-primary/10 text-primary text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                            {selectedConversation.categoryTag || "Contact"}
                          </span>
                          {selectedConversation.isConsent === false && (
                            <span className="bg-destructive/15 text-destructive text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0">
                              Opted Out
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedConversation.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (selectedConversation.leadType === "ea_lead") {
                          navigate(`/ea-leads?search=${encodeURIComponent(selectedConversation.phone || selectedConversation.name)}`);
                        } else {
                          navigate(`/lead/${selectedConversation._id}`);
                        }
                      }}
                      className="h-8 px-3 bg-accent border hover:bg-accent/80 rounded-xl text-xs font-bold flex items-center gap-1.5 text-foreground shadow-2xs transition-colors cursor-pointer"
                    >
                      View Lead <ExternalLink size={12} />
                    </button>
                  </div>

                  {/* Scrollable Email WhatsApp-style Chat Stream (Auto Scrolls to Bottom) */}
                  <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0 bg-accent/5">
                    {loadingHistory ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-primary h-6 w-6" />
                      </div>
                    ) : emailHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-1">
                        <Mail className="opacity-40 h-8 w-8" />
                        <p className="text-xs font-semibold">No message history available for this contact.</p>
                      </div>
                    ) : (
                      emailHistory.map(email => {
                        const isDelivered = email.status === "delivered" || email.status === "open" || email.status === "click";
                        const isOpened = email.status === "open" || email.status === "click";
                        const isClicked = email.status === "click";
                        const isBouncedOrBlocked = email.status === "bounce" || email.status === "blocked" || email.status === "failed";

                        return (
                          <div 
                            key={email._id} 
                            className="flex flex-col items-end w-full space-y-1"
                          >
                            {/* WhatsApp / SMS Style Outbound Chat Bubble */}
                            <div className="max-w-[85%] sm:max-w-[75%] bg-card border border-primary/20 rounded-2xl rounded-tr-xs p-4 shadow-2xs space-y-2.5 text-left transition-all">
                              {/* Bubble Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1.5 ${
                                  email.type === "bulk" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20" : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                }`}>
                                  📌 {email.type === "bulk" ? `Campaign: ${email.campaignTitle || "Bulk Mail"}` : `Direct Gmail`}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {new Date(email.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>

                              {/* Subject */}
                              <div className="space-y-0.5">
                                <h4 className="text-xs font-bold text-foreground">Subject: {email.subject}</h4>
                                {email.cc && <p className="text-[10px] text-muted-foreground">Cc: {email.cc}</p>}
                              </div>

                              {/* HTML Body / Content */}
                              <div 
                                className="text-xs text-foreground/90 leading-relaxed border-t border-border/60 pt-2.5 max-h-72 overflow-y-auto custom-scrollbar bg-accent/10 rounded-xl p-3" 
                                dangerouslySetInnerHTML={{ __html: email.body }}
                              />

                              {/* Footer WhatsApp Checkmark Delivery Indicators */}
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                                {isBouncedOrBlocked ? (
                                  <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1" title={email.error || "Blocked by SendGrid/Gmail"}>
                                    ⚠️ Blocked / Failed
                                  </span>
                                ) : isClicked ? (
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1" title="Clicked Link">
                                    ✓✓ <MousePointerClick size={11} /> Clicked Link
                                  </span>
                                ) : isOpened ? (
                                  <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1" title="Opened">
                                    <span className="text-blue-500 font-extrabold text-xs">✓✓</span> Opened
                                  </span>
                                ) : isDelivered ? (
                                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1" title="Delivered to Inbox">
                                    ✓✓ Delivered
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1" title="Dispatched">
                                    ✓ Dispatched
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Bottom Docked Rich Compose Block (Matching Screenshot 3) */}
                  <div className="p-4 border-t bg-card shrink-0 space-y-3 shadow-md">
                    {/* Consent Warning Banner */}
                    {selectedConversation.isConsent === false ? (
                      <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-1.5 text-center animate-in fade-in duration-200 w-full">
                        <div className="flex items-center gap-1.5 text-destructive text-xs font-bold">
                          <AlertCircle size={15} /> Email Consent Revoked
                        </div>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          This contact has opted out (unsubscribed) from marketing campaigns. Outbound email is locked.
                        </p>
                      </div>
                    ) : !isComposeExpanded ? (
                      /* Collapsed Compact Single-Line Input Bar */
                      <div 
                        onClick={() => setIsComposeExpanded(true)}
                        className="flex items-center gap-2 p-2 px-3 bg-accent/20 hover:bg-accent/40 border border-border/80 rounded-2xl cursor-pointer transition-all group shadow-2xs"
                      >
                        <div className="flex-1 text-xs text-muted-foreground font-medium px-1 truncate flex items-center justify-between">
                          <span className="truncate">
                            {composeForm.subject ? `Subject: ${composeForm.subject}` : "Type a message or subject to reply... (Click to expand editor)"}
                          </span>
                          <Maximize2 size={13} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-2" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsComposeExpanded(true);
                            setShowComposeAiPanel(true);
                          }}
                          className="h-8 px-3 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-2xs hover:bg-violet-500/20 transition-all"
                        >
                          <Sparkles size={12} /> AI Composer
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsComposeExpanded(true);
                          }}
                          className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0 transition-all"
                        >
                          <Send size={12} /> Reply
                        </button>
                      </div>
                    ) : (
                      /* Expanded Full Rich Compose Form */
                      <form onSubmit={handleSendOneToOneEmail} className="space-y-2.5">
                        {/* Top Input Row: Subject Line & CC */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Subject line..."
                            value={composeForm.subject}
                            onChange={e => setComposeForm({ ...composeForm, subject: e.target.value })}
                            className="h-9 input-field text-xs rounded-xl bg-accent/20 border-border/80 focus:bg-background transition-all"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Cc (optional, separate with commas)..."
                            value={composeForm.cc}
                            onChange={e => setComposeForm({ ...composeForm, cc: e.target.value })}
                            className="h-9 input-field text-xs rounded-xl bg-accent/20 border-border/80 focus:bg-background transition-all"
                          />
                        </div>

                        {/* Rich Text Editor Box */}
                        <div className="[&_.ql-editor]:min-h-[80px] [&_.ql-editor]:max-h-[140px] [&_.ql-toolbar]:py-1 [&_.ql-toolbar]:px-2 rounded-xl overflow-hidden border border-border/80">
                          <ReactQuill
                            theme="snow"
                            value={composeForm.body}
                            placeholder="Type your message body..."
                            onChange={val => setComposeForm({ ...composeForm, body: val })}
                          />
                        </div>

                        {/* Action Toolbar Row */}
                        <div className="flex items-center justify-between gap-4 pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setShowComposeAiPanel(prev => !prev)}
                              className={`h-8 px-3 rounded-full border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                showComposeAiPanel
                                  ? "bg-violet-500/20 border-violet-500/40 text-violet-600 dark:text-violet-400"
                                  : "bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-600 dark:text-violet-400"
                              }`}
                            >
                              <Sparkles size={13} /> AI Composer
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsComposeExpanded(false)}
                              className="h-8 px-3 rounded-full border border-border/80 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent/40 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Minimize2 size={12} /> Minimize
                            </button>
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmitting || !composeForm.subject || !composeForm.body}
                            className="h-8.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isSubmitting ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <><Send size={13} /> Send Email</>
                            )}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Quick AI Compose Prompt overlay */}
                    {showComposeAiPanel && selectedConversation.isConsent !== false && (
                      <div className="p-3.5 rounded-xl border border-violet-500/30 bg-violet-500/5 mt-2 space-y-2 animate-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">Describe email goals</span>
                          <button 
                            type="button" 
                            onClick={() => { setShowComposeAiPanel(false); setAiPrompt(""); }}
                            className="text-muted-foreground hover:text-foreground text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. 'Invite parent for speed program consultation on Monday'"
                          className="input-field text-xs"
                          value={aiPrompt}
                          onChange={e => setAiPrompt(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={handleAiDraftGenerate}
                          disabled={aiGenerating}
                          className="h-7 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1"
                        >
                          {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : "Draft with Claude"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-muted-foreground bg-accent/5">
                  <Inbox size={48} className="opacity-40 mb-3" />
                  <h4 className="font-bold text-sm">No Conversation Selected</h4>
                  <p className="text-xs mt-1 max-w-xs">Select a contact from the left sidebar to compose messages or view conversation history.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- DIALOG 1: CAMPAIGN MODAL WIZARD --- */}
      <Dialog open={isCampaignModalOpen} onOpenChange={setIsCampaignModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar p-0 flex flex-col dark:bg-card">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle>Create Marketing Campaign</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="flex-1 flex flex-col md:flex-row gap-6 p-6 min-h-0">
            <div className="flex-1 space-y-4 min-w-0">
              <div className="grid gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Campaign Title <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Speed Clinic Fall 2026 Promo"
                  className="input-field text-sm"
                  value={campaignForm.title}
                  onChange={e => setCampaignForm({ ...campaignForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Email Subject <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  placeholder="Subject line seen by recipient"
                  className="input-field text-sm"
                  value={campaignForm.subject}
                  onChange={e => setCampaignForm({ ...campaignForm, subject: e.target.value })}
                  required
                />
              </div>

              {/* Select Reusable Template Dropdown */}
              <div className="grid gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Select Reusable Template (Optional)</label>
                  <span className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold">MongoDB Collection</span>
                </div>
                <select
                  className="w-full h-10 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-medium cursor-pointer shadow-2xs leading-normal"
                  value={campaignForm.templateId || ""}
                  onChange={e => {
                    const selectedId = e.target.value;
                    const foundTpl = templates.find(t => t._id === selectedId);
                    if (foundTpl) {
                      setCampaignForm(prev => ({
                        ...prev,
                        templateId: foundTpl._id,
                        subject: foundTpl.subject,
                        content: foundTpl.content
                      }));
                      toast.success(`Loaded template: "${foundTpl.name}"`);
                    } else {
                      setCampaignForm(prev => ({ ...prev, templateId: null }));
                    }
                  }}
                >
                  <option value="">-- Custom Blank Template --</option>
                  {templates.map(tpl => (
                    <option key={tpl._id} value={tpl._id}>
                      {tpl.isAiGenerated ? "✨ " : ""}{tpl.name} ({tpl.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Message Content <span className="text-destructive">*</span></label>
                <div className="[&_.ql-editor]:min-h-[220px]">
                  <ReactQuill
                    theme="snow"
                    value={campaignForm.content}
                    placeholder="Compose email body. Supporting placeholder tags: {{name}}"
                    onChange={val => setCampaignForm({ ...campaignForm, content: val })}
                  />
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 space-y-5 border-t md:border-t-0 md:border-l pt-5 md:pt-0 md:pl-6 shrink-0 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="grid gap-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Recipient Segment <span className="text-destructive">*</span></label>
                  <select
                    className="input-field text-sm dark:bg-card"
                    value={campaignForm.segmentId}
                    onChange={e => setCampaignForm({ ...campaignForm, segmentId: e.target.value })}
                    required
                  >
                    <option value="">Select Target List...</option>
                    {segments.map(seg => (
                      <option key={seg._id} value={seg._id}>{seg.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="schedule-chk"
                      checked={campaignForm.isScheduled}
                      onChange={e => setCampaignForm({ ...campaignForm, isScheduled: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="schedule-chk" className="text-xs font-bold text-foreground cursor-pointer select-none">
                      Schedule for later?
                    </label>
                  </div>
                  {campaignForm.isScheduled && (
                    <div className="mt-2.5">
                      <input
                        type="datetime-local"
                        className="input-field text-sm dark:bg-card"
                        value={campaignForm.sendAt}
                        onChange={e => setCampaignForm({ ...campaignForm, sendAt: e.target.value })}
                        required={campaignForm.isScheduled}
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-2 mt-4">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-violet-500 animate-pulse" />
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400">AI Copywriter Assistant</span>
                  </div>
                  <textarea
                    placeholder="Describe email goals (e.g. 'Invite parents to soccer training consultation')"
                    className="input-field text-xs bg-background border-border min-h-[50px] resize-none"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAiDraftGenerate}
                    disabled={aiGenerating}
                    className="w-full btn-primary h-7 text-[10px] font-semibold gap-1 bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-sm"
                  >
                    {aiGenerating ? (
                      <><Loader2 size={12} className="animate-spin" /> Generating Draft...</>
                    ) : "Compose with Claude"}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(false)}
                  className="btn-secondary flex-1 text-xs h-9"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1 text-white shadow-sm"
                >
                  {isSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : campaignForm.isScheduled ? (
                    <><Calendar size={14} /> Schedule</>
                  ) : (
                    <><Send size={14} /> Send Now</>
                  )}
                </button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* --- DIALOG 2: SEGMENT BUILDER DIALOG --- */}
      <Dialog open={isSegmentModalOpen} onOpenChange={setIsSegmentModalOpen}>
        <DialogContent className={`w-[95vw] transition-all duration-300 ${segmentForm.type === "dynamic" ? "max-w-lg" : "max-w-3xl"} max-h-[85vh] p-0 flex flex-col overflow-hidden dark:bg-card`}>
          <DialogHeader className="p-5 pb-3 border-b shrink-0">
            <DialogTitle>Create List & Segment</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSegment} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
              {/* Common Segment Form Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">List / Segment Name <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Interested Football Leads"
                    className="input-field text-sm"
                    value={segmentForm.name}
                    onChange={e => setSegmentForm({ ...segmentForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Description</label>
                  <input
                    type="text"
                    placeholder="Describe this segment list targeting"
                    className="input-field text-sm"
                    value={segmentForm.description}
                    onChange={e => setSegmentForm({ ...segmentForm, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Segment Selection Method Toggle Pills */}
              <div className="grid gap-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Segment Selection Method</label>
                <div className="flex bg-accent/40 border p-1 rounded-xl w-full gap-1">
                  <button
                    type="button"
                    onClick={() => setSegmentForm({ ...segmentForm, type: "csv" })}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                      segmentForm.type === "csv" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Import CSV File
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentForm({ ...segmentForm, type: "static" })}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                      segmentForm.type === "static" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Manual Contacts
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentForm({ ...segmentForm, type: "campaign" })}
                    className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                      segmentForm.type === "campaign" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sales Campaign
                  </button>
                </div>
              </div>

              {/* Compact Sleek Audience Summary Strip */}
              <div className="py-2 px-3.5 bg-accent/20 border border-border/70 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-primary shrink-0" />
                  <span className="font-semibold text-foreground">Target Audience Summary:</span>
                  <span className="font-bold text-primary">{selectionBreakdown.totalUnique} Selected</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {selectionBreakdown.csvCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      CSV: {selectionBreakdown.csvCount}
                    </span>
                  )}
                  {selectionBreakdown.crmCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      CRM: {selectionBreakdown.crmCount}
                    </span>
                  )}
                  {selectionBreakdown.eaCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      EA: {selectionBreakdown.eaCount}
                    </span>
                  )}
                  {selectionBreakdown.teamCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Team: {selectionBreakdown.teamCount}
                    </span>
                  )}
                  {selectionBreakdown.campaignCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Campaign: {selectionBreakdown.campaignCount}
                    </span>
                  )}
                  {selectionBreakdown.customCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      Custom: {selectionBreakdown.customCount}
                    </span>
                  )}
                  {selectionBreakdown.totalUnique === 0 && (
                    <span className="text-muted-foreground italic text-[11px]">Select contacts below</span>
                  )}
                </div>
              </div>

              {/* Selection Method Specific Body */}
              {segmentForm.type === "csv" ? (
                /* 2-Column Responsive Grid for CSV File Import */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4 animate-in fade-in duration-200">
                  {/* Left Column: File Upload Picker */}
                  <div className="space-y-4 text-left">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase text-primary">Import Contacts from CSV File</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Upload a standard CSV file containing recipient names and email addresses. Headers like "Name" and "Email" will be detected automatically.
                      </p>
                    </div>

                    <div className="p-4 border-2 border-dashed border-border hover:border-primary/50 rounded-2xl bg-accent/5 text-center space-y-3 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center mx-auto">
                        <Upload size={20} />
                      </div>
                      <div className="space-y-1">
                        <label className="btn-secondary text-xs cursor-pointer inline-block py-1.5 px-3">
                          <span>Browse CSV File</span>
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleInlineCsvSelect}
                          />
                        </label>
                        <p className="text-[10px] text-muted-foreground">Supported format: .csv</p>
                      </div>
                    </div>

                    {csvFileName && (
                      <div className="p-3 border rounded-xl bg-violet-500/5 border-violet-500/20 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-violet-600 dark:text-violet-400 truncate">{csvFileName}</span>
                          <span className="text-[10px] bg-violet-500/10 text-violet-500 px-2 py-0.5 rounded-full font-bold">
                            {csvParsedContacts.length} Contacts
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Searchable CSV Contacts Checklist with Checkboxes */}
                  <div className="space-y-3 flex flex-col h-full min-h-0 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase text-primary">CSV Contacts Checklist</h4>
                      <span className="text-[10px] bg-violet-500/10 text-violet-500 px-2 py-0.5 rounded-full font-bold">
                        {csvSelectedEmails.length} / {csvParsedContacts.length} Selected
                      </span>
                    </div>

                    {/* Search Filter */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Filter CSV contacts..."
                        value={csvSearchQuery}
                        onChange={e => setCsvSearchQuery(e.target.value)}
                        className="pl-8 h-8.5 input-field text-xs"
                      />
                    </div>

                    {/* Select All / Deselect All */}
                    <div className="flex justify-between gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredEmails = filteredCsvParsedContacts.map(c => c.email);
                          setCsvSelectedEmails(prev => Array.from(new Set([...prev, ...allFilteredEmails])));
                        }}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Select All Filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredEmails = filteredCsvParsedContacts.map(c => c.email);
                          setCsvSelectedEmails(prev => prev.filter(email => !allFilteredEmails.includes(email)));
                        }}
                        className="text-[10px] text-destructive hover:underline font-semibold"
                      >
                        Deselect All Filtered
                      </button>
                    </div>

                    {/* Parsed List Container */}
                    <div className="max-h-60 overflow-y-auto border border-border rounded-xl p-2.5 space-y-1.5 bg-accent/5 custom-scrollbar flex-1">
                      {csvParsedContacts.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-10">Upload a CSV file on the left to preview contacts.</p>
                      ) : filteredCsvParsedContacts.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-10">No contacts matching search query.</p>
                      ) : (
                        filteredCsvParsedContacts.map((contact, idx) => {
                          const isSelected = csvSelectedEmails.includes(contact.email);
                          return (
                            <div
                              key={contact.email || idx}
                              onClick={() => {
                                setCsvSelectedEmails(prev =>
                                  prev.includes(contact.email)
                                    ? prev.filter(e => e !== contact.email)
                                    : [...prev, contact.email]
                                );
                              }}
                              className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                                isSelected
                                  ? "bg-violet-500/5 border-violet-500/20 text-foreground"
                                  : "hover:bg-accent/30 border-transparent text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded mt-0.5 pointer-events-none shrink-0"
                              />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-1.5 justify-between">
                                  <span className="font-bold text-xs truncate text-foreground leading-tight">
                                    {contact.name}
                                  </span>
                                  <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-violet-500/10 text-violet-500 shrink-0">
                                    CSV
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                                  {contact.email}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : segmentForm.type === "static" ? (
                /* 2-Column Responsive Grid for Static Selection */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                  {/* Left Column: Custom Contact Insertion */}
                  <div className="space-y-4">
                    <div className="space-y-2.5 text-left">
                      <div className="flex justify-between items-center">
                        <h5 className="text-xs font-bold uppercase text-primary">Insert Custom Contact</h5>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full font-bold">
                          {segmentForm.customContacts.length} Custom Added
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-0.5">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase">Contact Name</label>
                          <input
                            type="text"
                            placeholder="e.g. John Doe"
                            value={customContactName}
                            onChange={e => setCustomContactName(e.target.value)}
                            className="h-8 input-field text-xs bg-background"
                          />
                        </div>
                        <div className="grid gap-0.5">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase">Email Address</label>
                          <input
                            type="email"
                            placeholder="e.g. john@example.com"
                            value={customContactEmail}
                            onChange={e => setCustomContactEmail(e.target.value)}
                            className="h-8 input-field text-xs bg-background"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddCustomContact}
                        className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Plus size={12} /> Add Custom Contact
                      </button>

                      {segmentForm.customContacts.length > 0 && (
                        <div className="border border-indigo-500/20 bg-indigo-500/5 rounded-xl p-2 max-h-36 overflow-y-auto custom-scrollbar space-y-1 mt-2">
                          {segmentForm.customContacts.map((contact, idx) => (
                            <div key={idx} className="flex justify-between items-center gap-2 p-1.5 bg-card border rounded-lg text-xs">
                              <div className="min-w-0 flex-1">
                                <span className="font-bold block text-foreground truncate">{contact.name}</span>
                                <span className="text-[10px] text-muted-foreground block truncate">{contact.email}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomContact(contact.email)}
                                className="h-5 w-5 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center shrink-0 transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Searchable CRM/EA/Team Contact Checklist */}
                  <div className="space-y-3 flex flex-col h-full min-h-0 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase text-primary">Select Contacts Checklist</h4>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        {segmentForm.leadIds.length} Selected
                      </span>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex bg-accent/30 border p-0.5 rounded-lg gap-0.5">
                      {[
                        { id: "all", label: "All" },
                        { id: "main_lead", label: "CRM Leads" },
                        { id: "ea_lead", label: "EA Leads" },
                        { id: "team_member", label: "Team" }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setContactCategoryFilter(cat.id as any)}
                          className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors ${
                            contactCategoryFilter === cat.id
                              ? "bg-primary text-white shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Search box */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={contactsSearchQuery}
                        onChange={e => setContactsSearchQuery(e.target.value)}
                        className="pl-8 h-8.5 input-field text-xs"
                      />
                    </div>

                    {/* Select All / Deselect All */}
                    <div className="flex justify-between gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredIds = filteredContactsForSelection.map(c => c._id);
                          setSegmentForm(prev => {
                            const newIds = Array.from(new Set([...prev.leadIds, ...allFilteredIds]));
                            return { ...prev, leadIds: newIds };
                          });
                        }}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Select All Filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredIds = filteredContactsForSelection.map(c => c._id);
                          setSegmentForm(prev => {
                            const newIds = prev.leadIds.filter(id => !allFilteredIds.includes(id));
                            return { ...prev, leadIds: newIds };
                          });
                        }}
                        className="text-[10px] text-destructive hover:underline font-semibold"
                      >
                        Deselect All Filtered
                      </button>
                    </div>

                    {/* Checklist Container */}
                    <div className="max-h-60 overflow-y-auto border border-border rounded-xl p-2.5 space-y-1.5 bg-accent/5 custom-scrollbar flex-1">
                      {loadingContacts ? (
                        <div className="flex justify-center items-center py-10">
                          <Loader2 className="animate-spin text-primary h-5 w-5" />
                        </div>
                      ) : filteredContactsForSelection.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-8">No contacts match filter.</p>
                      ) : (
                        filteredContactsForSelection.map(contact => {
                          const isSelected = segmentForm.leadIds.includes(contact._id);
                          return (
                            <div
                              key={contact._id}
                              onClick={() => toggleContactSelection(contact._id, contact.leadType)}
                              className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                                isSelected
                                  ? "bg-primary/5 border-primary/20 text-foreground"
                                  : "hover:bg-accent/30 border-transparent text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded mt-0.5 pointer-events-none shrink-0"
                              />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-1.5 justify-between">
                                  <span className="font-bold text-xs truncate text-foreground leading-tight">
                                    {contact.name}
                                  </span>
                                  <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                    contact.leadType === "ea_lead" ? "bg-violet-500/10 text-violet-500" :
                                    contact.leadType === "team_member" ? "bg-emerald-500/10 text-emerald-500" :
                                    "bg-blue-500/10 text-blue-500"
                                  }`}>
                                    {contact.leadType === "ea_lead" ? "EA" : contact.leadType === "team_member" ? "Team" : "CRM"}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                                  {contact.email}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : segmentForm.type === "campaign" ? (
                /* Target Sales Campaign 2-Column Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4 animate-in fade-in duration-200">
                  {/* Left Column: Target Sales Campaign Selector */}
                  <div className="space-y-4">
                    <div className="space-y-1 text-left">
                      <h4 className="text-xs font-bold uppercase text-primary">Target CRM Sales Campaign</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Select a Sales Campaign from your sales funnel. All contacts attached to leads inside this campaign will be automatically targeted.
                      </p>
                    </div>

                    <div className="grid gap-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Select Sales Campaign <span className="text-destructive">*</span></label>
                      <select
                        className="input-field text-xs dark:bg-card"
                        value={segmentForm.filters.campaignId}
                        onChange={e => setSegmentForm({
                          ...segmentForm,
                          filters: { ...segmentForm.filters, campaignId: e.target.value }
                        })}
                        required={segmentForm.type === "campaign"}
                      >
                        <option value="">Select Sales Campaign...</option>
                        {salesCampaigns.map(camp => (
                          <option key={camp._id} value={camp._id}>{camp.name}</option>
                        ))}
                      </select>
                    </div>

                    {segmentForm.filters.campaignId && (
                      <div className="p-3 border rounded-xl bg-amber-500/5 border-amber-500/20 text-xs space-y-1 text-left">
                        <span className="font-bold text-amber-600 dark:text-amber-400 block">Campaign Target Selected</span>
                        <p className="text-[11px] text-muted-foreground">
                          Contacts matching this sales campaign will be resolved automatically upon campaign delivery.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Live Searchable Campaign Contacts Checklist with Checkboxes */}
                  <div className="space-y-3 flex flex-col h-full min-h-0 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold uppercase text-primary">Campaign Contacts Checklist</h4>
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-bold">
                        {campaignSelectedIds.length} / {campaignPreviewContacts.length} Selected
                      </span>
                    </div>

                    {/* Search Box for Preview Contacts */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Filter contacts by name or email..."
                        value={campaignPreviewSearch}
                        onChange={e => setCampaignPreviewSearch(e.target.value)}
                        className="pl-8 h-8.5 input-field text-xs"
                      />
                    </div>

                    {/* Select All / Deselect All */}
                    <div className="flex justify-between gap-2 px-1">
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredIds = filteredCampaignPreviewContacts.map((c: any) => c.leadId || c.email);
                          setCampaignSelectedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                        }}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Select All Filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredIds = filteredCampaignPreviewContacts.map((c: any) => c.leadId || c.email);
                          setCampaignSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                        }}
                        className="text-[10px] text-destructive hover:underline font-semibold"
                      >
                        Deselect All Filtered
                      </button>
                    </div>

                    {/* Contacts List Container */}
                    <div className="max-h-60 overflow-y-auto border border-border rounded-xl p-2.5 space-y-1.5 bg-accent/5 custom-scrollbar flex-1">
                      {!segmentForm.filters.campaignId ? (
                        <p className="text-[11px] text-muted-foreground text-center py-10">Select a Sales Campaign on the left to view contacts.</p>
                      ) : loadingCampaignPreview ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2 className="animate-spin text-primary h-5 w-5" />
                        </div>
                      ) : filteredCampaignPreviewContacts.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground text-center py-10">No leads or active contacts found for this campaign.</p>
                      ) : (
                        filteredCampaignPreviewContacts.map((contact: any, idx: number) => {
                          const contactId = contact.leadId || contact.email;
                          const isSelected = campaignSelectedIds.includes(contactId);
                          return (
                            <div
                              key={contactId || idx}
                              onClick={() => {
                                setCampaignSelectedIds(prev =>
                                  prev.includes(contactId)
                                    ? prev.filter(id => id !== contactId)
                                    : [...prev, contactId]
                                );
                              }}
                              className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                                isSelected
                                  ? "bg-amber-500/5 border-amber-500/20 text-foreground"
                                  : "hover:bg-accent/30 border-transparent text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded mt-0.5 pointer-events-none shrink-0"
                              />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-1.5 justify-between">
                                  <span className="font-bold text-xs truncate text-foreground leading-tight">
                                    {contact.name}
                                  </span>
                                  <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 shrink-0">
                                    Lead
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                                  {contact.email}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Dynamic Rule Filters Single Column */
                <div className="space-y-3 pt-2 border-t animate-in fade-in duration-200">
                  <h4 className="text-xs font-bold uppercase text-primary">Dynamic Rule Filters</h4>
                  
                  <div className="grid gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Source Filter</label>
                    <input
                      type="text"
                      placeholder="e.g. Website Inbound"
                      className="input-field text-xs"
                      value={segmentForm.filters.source}
                      onChange={e => setSegmentForm({
                        ...segmentForm,
                        filters: { ...segmentForm.filters, source: e.target.value }
                      })}
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Location/City Filter</label>
                    <input
                      type="text"
                      placeholder="e.g. Washington"
                      className="input-field text-xs"
                      value={segmentForm.filters.location}
                      onChange={e => setSegmentForm({
                        ...segmentForm,
                        filters: { ...segmentForm.filters, location: e.target.value }
                      })}
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Lead Status Filter</label>
                    <select
                      className="input-field text-xs dark:bg-card"
                      value={segmentForm.filters.status}
                      onChange={e => setSegmentForm({
                        ...segmentForm,
                        filters: { ...segmentForm.filters, status: e.target.value }
                      })}
                    >
                      <option value="">Any Status...</option>
                      <option value="Not Contacted">Not Contacted</option>
                      <option value="Interested">Interested</option>
                      <option value="Proposal Sent">Proposal Sent</option>
                      <option value="Program Confirmed">Program Confirmed</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="p-4 border-t bg-card shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${selectionBreakdown.totalUnique > 0 ? "bg-emerald-400 opacity-75" : "bg-muted opacity-40"}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${selectionBreakdown.totalUnique > 0 ? "bg-emerald-500" : "bg-muted-foreground"}`}></span>
                </span>
                <span className="font-semibold text-muted-foreground">
                  <strong className="text-foreground font-extrabold">{selectionBreakdown.totalUnique}</strong> unique recipients ready
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSegmentModalOpen(false)}
                  className="btn-secondary text-xs h-9"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary text-xs h-9 bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1 text-white shadow-sm"
                >
                  {isSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>Save Segment</>
                  )}
                </button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 3: CSV IMPORT DIALOG --- */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="w-[90vw] max-w-sm dark:bg-card">
          <DialogHeader>
            <DialogTitle>Import Email List via CSV</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCsvImport} className="space-y-4">
            <div className="grid gap-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Segment List Name <span className="text-destructive">*</span></label>
              <input
                type="text"
                placeholder="e.g. High School Soccer Coach List"
                className="input-field text-sm"
                value={importSegmentName}
                onChange={e => setImportSegmentName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2 pt-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">CSV File Upload <span className="text-destructive">*</span></label>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors bg-accent/15 cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setImportFile(file);
                    if (file && !importSegmentName) {
                      setImportSegmentName(file.name.replace(/\.[^/.]+$/, ""));
                    }
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  required
                />
                <Upload className="mx-auto text-muted-foreground h-8 w-8 mb-2 opacity-50" />
                <span className="text-xs font-bold block text-foreground">
                  {importFile ? importFile.name : "Click to select CSV File"}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Must contain headers like "email" and "name"
                </span>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="btn-secondary text-xs h-9"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary text-xs h-9 bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1 text-white shadow-sm"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : "Start CSV Import"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 4: CAMPAIGN PERFORMANCE & RECIPIENT TRACKING INSPECTOR --- */}
      <Dialog open={isViewStatsOpen} onOpenChange={setIsViewStatsOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] p-0 flex flex-col overflow-hidden dark:bg-card">
          <DialogHeader className="p-5 pb-3 border-b shrink-0 flex flex-row items-center justify-between bg-card">
            <div className="text-left space-y-0.5 min-w-0 pr-4">
              <DialogTitle className="text-base flex items-center gap-2 text-foreground truncate">
                <BarChart3 className="text-primary h-5 w-5 shrink-0" />
                {selectedCampaign?.title || "Campaign Analytics"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                Subject: <span className="font-semibold text-foreground">{selectedCampaign?.subject}</span>
              </p>
            </div>
            <span className={`text-[10px] px-3 py-1 rounded-full font-extrabold uppercase shrink-0 border ${
              selectedCampaign?.status === "sent" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
              selectedCampaign?.status === "scheduled" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
              "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
            }`}>
              {selectedCampaign?.status || "draft"}
            </span>
          </DialogHeader>

          {selectedCampaign && (
            <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
              {/* Top 5 KPI Summary Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
                {[
                  { label: "Sent", val: selectedCampaign.stats?.sent || 0, icon: Mail, color: "text-zinc-500", bg: "bg-zinc-500/10" },
                  { label: "Delivered", val: selectedCampaign.stats?.delivered || 0, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { label: "Opens", val: selectedCampaign.stats?.opens || 0, icon: Eye, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { label: "Clicks", val: selectedCampaign.stats?.clicks || 0, icon: MousePointerClick, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                  { label: "Unsubscribed", val: selectedCampaign.stats?.unsubscribes || 0, icon: UserX, color: "text-amber-500", bg: "bg-amber-500/10" }
                ].map(stat => (
                  <div key={stat.label} className="border border-border/80 rounded-xl p-3 bg-card text-left flex flex-col justify-between shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-extrabold text-muted-foreground">{stat.label}</span>
                      <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                        <stat.icon className={`${stat.color} h-3.5 w-3.5`} />
                      </div>
                    </div>
                    <span className="text-base font-extrabold text-foreground mt-2">{stat.val}</span>
                  </div>
                ))}
              </div>

              {/* Recipient Logs Section Header with Search and Category Filter Pills */}
              <div className="space-y-2.5 min-h-0 flex flex-col flex-1">
                <div className="flex flex-col sm:flex-row gap-2.5 justify-between sm:items-center">
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filter campaign recipients by name or email..."
                      value={campaignRecipientSearch}
                      onChange={e => setCampaignRecipientSearch(e.target.value)}
                      className="pl-8.5 h-8.5 input-field text-xs w-full dark:bg-card"
                    />
                  </div>

                  {/* Filter Category Pills */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px] shrink-0">
                    {[
                      { id: "all", label: `All (${selectedCampaign.recipientLogs?.length || 0})` },
                      { id: "open", label: `Opened (${selectedCampaign.stats?.opens || 0})` },
                      { id: "click", label: `Clicked (${selectedCampaign.stats?.clicks || 0})` },
                      { id: "unsubscribe", label: `Unsubscribed (${selectedCampaign.stats?.unsubscribes || 0})` },
                      { id: "bounce", label: `Bounced (${selectedCampaign.stats?.bounces || 0})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCampaignRecipientFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                          campaignRecipientFilter === tab.id
                            ? "bg-primary text-white border-primary"
                            : "bg-accent/20 hover:bg-accent/40 text-muted-foreground border-border/60"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient Logs Scrollable List */}
                <div className="flex-1 border rounded-2xl overflow-y-auto custom-scrollbar bg-accent/5 p-3 space-y-2 min-h-[220px]">
                  {!selectedCampaign.recipientLogs || selectedCampaign.recipientLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                      <Mail size={36} className="opacity-40 mb-2" />
                      <p className="text-xs font-semibold">No recipient dispatch logs found for this campaign.</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Logs will populate automatically when the campaign is dispatched.</p>
                    </div>
                  ) : filteredCampaignRecipients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                      <Search size={36} className="opacity-40 mb-2" />
                      <p className="text-xs font-semibold">No recipients matching search or status filter.</p>
                    </div>
                  ) : (
                    filteredCampaignRecipients.map((log, idx) => {
                      const displayName = log.name || log.email.split('@')[0];
                      const initials = displayName.substring(0, 2).toUpperCase();
                      const isCopied = copiedEmail === log.email;

                      const isDelivered = log.status === "delivered" || log.status === "open" || log.status === "click";
                      const isOpened = log.status === "open" || log.status === "click";
                      const isClicked = log.status === "click";
                      const isUnsubscribed = log.status === "unsubscribe";
                      const isBouncedOrBlocked = log.status === "bounce" || log.status === "blocked" || log.status === "failed";

                      return (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card border border-border/80 hover:border-primary/40 rounded-xl text-xs shadow-2xs transition-all">
                          {/* Left: Contact Details & Error Details */}
                          <div className="flex items-center gap-3 min-w-0 text-left flex-1">
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-extrabold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-foreground block truncate">{displayName}</span>
                              <span className="text-[11px] text-muted-foreground block truncate mt-0.5">{log.email}</span>
                              {log.error && (
                                <span className="text-[10px] text-rose-500 font-semibold block truncate mt-0.5" title={log.error}>
                                  ⚠️ {log.error}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyEmail(log.email)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-accent/40 rounded-lg flex items-center justify-center transition-colors shrink-0"
                              title="Copy email address"
                            >
                              {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            </button>
                          </div>

                          {/* Right: Event Badges Stack */}
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-start sm:justify-end">
                            {/* Delivery / Blocked Badge */}
                            <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                              isDelivered ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                              isBouncedOrBlocked ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                              "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            }`}>
                              {isDelivered ? "Delivered" : isBouncedOrBlocked ? "Blocked / Bounced" : "Dispatched (Pending Webhook)"}
                            </span>

                            {/* Open Badge */}
                            <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                              isOpened ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : "bg-accent/40 text-muted-foreground border-border/50"
                            }`}>
                              {isOpened ? "Opened" : "Not Opened"}
                            </span>

                            {/* Click Badge */}
                            {isClicked && (
                              <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                Clicked Link
                              </span>
                            )}

                            {/* Unsubscribe Badge */}
                            {isUnsubscribed && (
                              <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Unsubscribed
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t bg-card shrink-0 flex items-center justify-between gap-2">
            {selectedCampaign && (
              <button
                type="button"
                onClick={() => {
                  setCampaignToRerun(selectedCampaign);
                  setIsConfirmRerunOpen(true);
                }}
                className="btn-primary text-xs h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw size={13} /> Run Again Campaign
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsViewStatsOpen(false)}
              className="btn-secondary text-xs h-9 px-4"
            >
              Close Analytics
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 5: VIEW SEGMENT RECIPIENTS DIALOG --- */}
      <Dialog open={isViewSegmentModalOpen} onOpenChange={setIsViewSegmentModalOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden dark:bg-card">
          <DialogHeader className="p-5 pb-3 border-b shrink-0 flex flex-row items-center justify-between bg-card">
            <div className="text-left space-y-0.5 min-w-0 pr-4">
              <DialogTitle className="text-base flex items-center gap-2 text-foreground truncate">
                <Users className="text-primary h-5 w-5 shrink-0" />
                {selectedSegmentForView?.name || "Segment Contacts"}
              </DialogTitle>
              {selectedSegmentForView?.description && (
                <p className="text-xs text-muted-foreground truncate">{selectedSegmentForView.description}</p>
              )}
            </div>
            <span className={`text-[10px] px-3 py-1 rounded-full font-extrabold uppercase shrink-0 border ${
              selectedSegmentForView?.type === "csv" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" :
              selectedSegmentForView?.type === "campaign" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
              "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
            }`}>
              {selectedSegmentForView?.type === "csv" ? "CSV Import" :
               selectedSegmentForView?.type === "campaign" ? "Sales Campaign" :
               selectedSegmentForView?.type || "Static List"}
            </span>
          </DialogHeader>

          <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
            {/* Header stats and search bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter recipients by name or email..."
                  value={viewSegmentSearchQuery}
                  onChange={e => setViewSegmentSearchQuery(e.target.value)}
                  className="pl-9 h-9 input-field text-xs w-full dark:bg-card"
                />
              </div>
              <span className="text-xs font-bold text-muted-foreground px-3.5 py-1.5 bg-accent/30 rounded-xl border border-border/50 shrink-0 text-left sm:text-right">
                Saved Contacts: <strong className="text-primary font-extrabold">{selectedSegmentForView?.contacts?.length || 0}</strong>
              </span>
            </div>

            {/* Contacts Cards Grid / Scrollable List */}
            <div className="flex-1 border rounded-2xl overflow-y-auto custom-scrollbar bg-accent/5 p-3 space-y-2 min-h-[220px]">
              {!selectedSegmentForView?.contacts || selectedSegmentForView.contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                  <UserX size={36} className="opacity-40 mb-2" />
                  <p className="text-xs font-semibold">No contacts saved in this segment.</p>
                </div>
              ) : filteredViewSegmentContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                  <Search size={36} className="opacity-40 mb-2" />
                  <p className="text-xs font-semibold">No contacts matching search query.</p>
                </div>
              ) : (
                filteredViewSegmentContacts.map((contact, idx) => {
                  const displayName = contact.name || contact.email.split('@')[0];
                  const initials = displayName.substring(0, 2).toUpperCase();
                  const isCopied = copiedEmail === contact.email;

                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-card border border-border/80 hover:border-primary/40 rounded-xl text-xs shadow-2xs transition-all">
                      <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-extrabold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-foreground block truncate">{displayName}</span>
                          <span className="text-[11px] text-muted-foreground block truncate mt-0.5">{contact.email}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(contact.email)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-accent/40 rounded-lg flex items-center justify-center transition-colors"
                          title="Copy email address"
                        >
                          {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                        <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shrink-0 border flex items-center gap-1 ${
                          contact.status === "active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          {contact.status || "active"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-card shrink-0">
            <button
              type="button"
              onClick={() => setIsViewSegmentModalOpen(false)}
              className="btn-secondary text-xs h-9 px-4"
            >
              Close Inspector
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 6: CONFIRM RE-RUN CAMPAIGN MODAL --- */}
      <Dialog open={isConfirmRerunOpen} onOpenChange={setIsConfirmRerunOpen}>
        <DialogContent className="w-[90vw] max-w-md p-6 dark:bg-card">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-base flex items-center gap-2 text-foreground">
              <RotateCcw className="text-indigo-500 h-5 w-5 shrink-0" />
              Re-run Campaign Confirmation
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-left space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to re-run <strong className="text-foreground">{campaignToRerun?.title}</strong>?
            </p>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-600 dark:text-amber-400 space-y-1">
              <span className="font-bold block">Important Notice:</span>
              <p>This will re-dispatch the campaign email to all current contacts in the target segment and reset campaign metrics.</p>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsConfirmRerunOpen(false);
                setCampaignToRerun(null);
              }}
              disabled={isRerunning}
              className="btn-secondary text-xs h-9"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteRerun}
              disabled={isRerunning}
              className="btn-primary text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
            >
              {isRerunning ? (
                <><Loader2 size={13} className="animate-spin" /> Re-dispatching...</>
              ) : (
                <><RotateCcw size={13} /> Confirm & Re-run Campaign</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- GROQ AI TEMPLATE GENERATOR & LIVE PREVIEW WORKSPACE MODAL --- */}
      <Dialog open={isAiTemplateModalOpen} onOpenChange={setIsAiTemplateModalOpen}>
        <DialogContent className="sm:max-w-[1150px] w-[95vw] max-h-[90vh] p-0 rounded-3xl border shadow-2xl overflow-hidden bg-card flex flex-col">
          {/* Modal Header */}
          <div className="p-5 border-b bg-card flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-foreground">Groq AI Email Template Builder</h2>
                  <span className="bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border border-violet-500/20">
                    Live HTML Preview
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Describe your email campaign idea to generate responsive HTML layouts in real time.</p>
              </div>
            </div>
          </div>

          {/* Modal Body - 2 Column Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
            {/* LEFT COLUMN: Controls & Settings (5 Cols) */}
            <div className="lg:col-span-5 p-6 space-y-4 overflow-y-auto custom-scrollbar bg-card/50 flex flex-col justify-between">
              <form onSubmit={handleGenerateAiTemplate} className="space-y-4 text-left">
                {/* 1. FIRST PRIORITY: Template Name & Subject Line Inputs */}
                <div className="space-y-3 bg-accent/20 p-3.5 rounded-2xl border border-border/80">
                  <div>
                    <label className="text-xs font-extrabold text-foreground block mb-1">
                      Template Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={templateNameInput}
                      onChange={e => {
                        setTemplateNameInput(e.target.value);
                        if (aiDraftTemplate) setAiDraftTemplate({ ...aiDraftTemplate, name: e.target.value });
                      }}
                      placeholder="e.g. Summer Youth Basketball Camp Invitation"
                      className="w-full h-10 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 font-bold shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-extrabold text-foreground block mb-1">
                      Default Subject Line <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={templateSubjectInput}
                      onChange={e => {
                        setTemplateSubjectInput(e.target.value);
                        if (aiDraftTemplate) setAiDraftTemplate({ ...aiDraftTemplate, subject: e.target.value });
                      }}
                      placeholder="e.g. Unlock Your Child's Basketball Potential This Summer!"
                      className="w-full h-10 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 font-medium shadow-2xs"
                    />
                  </div>
                </div>

                {/* 2. Preset Prompt Suggestions */}
                <div>
                  <label className="text-xs font-bold text-foreground block mb-2">
                    Quick Preset Topics
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "🏀 Basketball Camp", prompt: "Write a high-converting email template inviting parents to register for our summer youth basketball skill camp." },
                      { label: "📰 Monthly Newsletter", prompt: "Create a monthly newsletter template with training tips, athlete spotlight, and upcoming schedule." },
                      { label: "🏆 Varsity Tryouts", prompt: "Write a polite email invitation for athlete tryouts and team evaluation sessions." },
                      { label: "⚡ Early Bird Discount", prompt: "Write an urgent promotional email offering 20% off early registration for athletic conditioning clinics." }
                    ].map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAiPromptInput(preset.prompt)}
                        className="text-[11px] font-semibold bg-accent/60 hover:bg-accent border text-foreground px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Prompt Textarea */}
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Describe your Template Idea <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Write an email template inviting school athletic directors to schedule a consultation meeting for speed & agility camps..."
                    value={aiPromptInput}
                    onChange={e => setAiPromptInput(e.target.value)}
                    className="w-full p-3 text-xs bg-background text-foreground border border-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none leading-relaxed shadow-2xs font-medium"
                    required
                  />
                </div>

                {/* 4. Category & Tone Selectors */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">Category</label>
                    <select
                      value={aiCategoryInput}
                      onChange={e => setAiCategoryInput(e.target.value)}
                      className="w-full h-10 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 font-medium cursor-pointer shadow-2xs leading-normal"
                    >
                      <option value="General">General Marketing</option>
                      <option value="Announcement">Announcement</option>
                      <option value="Promotional">Promotional</option>
                      <option value="Newsletter">Newsletter</option>
                      <option value="Follow-up">Sales Follow-up</option>
                      <option value="Event Invitation">Event Invitation</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">Writing Style / Tone</label>
                    <select
                      value={aiToneInput}
                      onChange={e => setAiToneInput(e.target.value)}
                      className="w-full h-10 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 font-medium cursor-pointer shadow-2xs leading-normal"
                    >
                      <option value="Professional & Warm">Professional & Warm</option>
                      <option value="High Energy & Inspiring">High Energy & Inspiring</option>
                      <option value="Urgent & Sales-Focused">Urgent & Sales-Focused</option>
                      <option value="Short & Direct">Short & Direct</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGeneratingAiTemplate || !aiPromptInput.trim()}
                  className="w-full h-10 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {isGeneratingAiTemplate ? (
                    <><Loader2 size={15} className="animate-spin" /> Generating HTML Layout with Groq AI...</>
                  ) : (
                    <><Sparkles size={15} /> Generate HTML Template (Groq AI)</>
                  )}
                </button>
              </form>

              {/* Action Area */}
              <div className="mt-4 pt-4 border-t flex items-center gap-2 text-left">
                <button
                  type="button"
                  onClick={handleSaveDraftTemplate}
                  disabled={isSavingTemplate || !aiDraftTemplate}
                  className="flex-1 h-9 bg-primary text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingTemplate ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} /> Save to Database</>}
                </button>
                <button
                  type="button"
                  onClick={handleUseDraftInCampaign}
                  disabled={!aiDraftTemplate}
                  className="flex-1 h-9 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  Use in Campaign <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Visual Preview & Editor Canvas (7 Cols) */}
            <div className="lg:col-span-7 bg-accent/10 p-5 flex flex-col min-h-0 space-y-3 overflow-hidden text-left">
              {/* Header Bar with View Switcher */}
              <div className="flex items-center justify-between shrink-0 bg-card p-2 px-3 rounded-xl border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Eye size={14} className="text-primary" /> Email Preview Window
                  </span>
                </div>

                <div className="flex items-center bg-accent/60 p-0.5 rounded-lg border text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("visual")}
                    className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      previewTab === "visual" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    👁️ Visual Live
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("code")}
                    className={`px-3 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      previewTab === "code" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ✏️ HTML Source
                  </button>
                </div>
              </div>

              {/* Rendered Canvas / Frame */}
              <div className="flex-1 border rounded-2xl overflow-y-auto custom-scrollbar bg-card shadow-inner flex flex-col min-h-0">
                {isGeneratingAiTemplate ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-3 text-center flex-1">
                    <Loader2 className="animate-spin text-violet-600 h-10 w-10" />
                    <p className="text-xs font-bold text-foreground">Groq AI is designing your template layout...</p>
                    <p className="text-[11px] text-muted-foreground">Writing responsive HTML, CSS styles, and content.</p>
                  </div>
                ) : !aiDraftTemplate ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-3 text-center flex-1 p-6">
                    <div className="h-12 w-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                      <Sparkles size={24} />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <h4 className="text-sm font-bold text-foreground">Ready to Generate</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Enter your topic or choose a quick preset on the left, then click <strong>Generate HTML Template</strong> to see the live visual layout here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col min-h-full">
                    {/* Content View */}
                    {previewTab === "visual" ? (
                      <div 
                        className="p-6 flex-1 text-foreground text-sm space-y-3 prose dark:prose-invert max-w-none custom-scrollbar overflow-y-auto"
                        dangerouslySetInnerHTML={{ 
                          __html: aiDraftTemplate.content.replace(/\{\{name\}\}/gi, "John Doe") 
                        }}
                      />
                    ) : (
                      <div className="p-4 flex-1 bg-slate-950 text-emerald-400 font-mono text-xs overflow-y-auto custom-scrollbar">
                        <textarea
                          value={aiDraftTemplate.content}
                          onChange={e => setAiDraftTemplate({ ...aiDraftTemplate, content: e.target.value })}
                          className="w-full h-full bg-transparent border-none outline-none resize-none text-emerald-400 font-mono"
                          rows={15}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
