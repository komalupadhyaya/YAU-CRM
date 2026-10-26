import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../api/api";
import AppLayout from "../layout/AppLayout";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
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
  AlertTriangle,
  Info,
  Clock,
  Eye,
  Settings,
  ChevronRight,
  TrendingUp,
  Inbox,
  MousePointerClick,
  UserX,
  UserCheck,
  Search,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table,
  Copy,
  Scissors,
  Shapes,
  Check,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Code2,
  PenLine,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Tag,
  Highlighter,
  Palette,
  Pipette,
  Type,
  Folder,
  X,
  HelpCircle,
  Edit2,
  UserPlus,
  User,
  Phone,
  Shield,
  ShieldCheck,
  Smartphone,
  Globe,
  GraduationCap,
  Layers,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";

interface MarketingContactItem {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  entryPoint?: string;
  source?: string;
  schoolName?: string;
  schoolId?: string;
  locationName?: string;
  locationId?: string;
}

const matchMarketingChannel = (source: string | undefined, entryPoint: string | undefined, filterId: string) => {
  if (!filterId || filterId === "all") return true;
  const src = (source || entryPoint || "").toLowerCase().trim();
  if (filterId === "mobile") {
    return src.includes("mobile");
  }
  if (filterId === "web_portal" || filterId === "portal") {
    return src.includes("portal") || src.includes("web");
  }
  if (filterId === "afterschool" || filterId === "school") {
    return src.includes("afterschool") || src.includes("after school") || src.includes("school");
  }
  if (filterId === "manual") {
    return src.includes("manual") || src.includes("crm");
  }
  return src.includes(filterId.toLowerCase());
};

const getMarketingChannelInfo = (source: string | undefined, entryPoint: string | undefined) => {
  const src = (source || entryPoint || "").toLowerCase().trim();
  if (src.includes("mobile")) {
    return {
      id: "mobile",
      label: "Mobile",
      badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
      icon: "smartphone"
    };
  }
  if (src.includes("portal") || src.includes("web")) {
    return {
      id: "web_portal",
      label: "Web Portal",
      badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      icon: "globe"
    };
  }
  if (src.includes("afterschool") || src.includes("after school") || src.includes("school")) {
    return {
      id: "afterschool",
      label: "After School",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      icon: "graduation-cap"
    };
  }
  if (src.includes("manual") || src.includes("crm")) {
    return {
      id: "manual",
      label: "Manual CRM",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      icon: "user-plus"
    };
  }
  return {
    id: "other",
    label: source || "Marketing",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
    icon: "sparkles"
  };
};
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useNavigate, useSearchParams } from "react-router-dom";
import AiPersonalizedCampaignModal from "../components/email/AiPersonalizedCampaignModal";
import TemplateImageModal from "../components/email/TemplateImageModal";
import GoogleDocsColorPickerPopover, { normalizeHex } from "../components/common/GoogleDocsColorPickerPopover";
import { useEmailCenter, Segment } from "../context/EmailCenterContext";

interface Campaign {
  _id: string;
  title: string;
  subject: string;
  content: string;
  segmentId: Segment | null;
  segmentIds?: Segment[];
  templateId?: {
    _id: string;
    name: string;
    category?: string;
    isAiGenerated?: boolean;
    subject?: string;
  } | string | null;
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
  leadId?: string;
}

interface EmailHistoryItem {
  _id: string;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  cc?: string;
  to: string;
  timestamp: string;
  sentAt?: string;
  createdAt?: string;
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
  const socket = useSocket();

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

  // Consume Global EmailCenterContext (Promise.all concurrent loading & memory cache)
  const {
    campaigns,
    setCampaigns,
    segments,
    setSegments,
    templates,
    setTemplates,
    conversations,
    setConversations,
    selectedConversation,
    setSelectedConversation,
    emailHistory,
    setEmailHistory,
    loadingCampaigns,
    loadingSegments,
    loadingTemplates,
    loadingConversations,
    loadingHistory,
    resubscribing,
    isMarketingDataLoaded,
    isConversationsLoaded,
    loadInitialMarketingData,
    fetchCampaigns,
    fetchSegments,
    fetchTemplates,
    fetchConversations,
    fetchHistory,
    resubscribeContact
  } = useEmailCenter();

  // Webhook Integration Guide State
  const [isWebhookGuideOpen, setIsWebhookGuideOpen] = useState(false);
  const [copiedWebhookPayload, setCopiedWebhookPayload] = useState<string | null>(null);
  const [webhookPayloadTab, setWebhookPayloadTab] = useState<"full" | "school" | "location" | "app" | "admin">("full");

  // Database Template & Groq AI States
  const [isAiTemplateModalOpen, setIsAiTemplateModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [templateSubjectInput, setTemplateSubjectInput] = useState("");
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [aiCategoryInput, setAiCategoryInput] = useState("General");
  const [aiToneInput, setAiToneInput] = useState("Professional & Warm");
  const [isGeneratingAiTemplate, setIsGeneratingAiTemplate] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Scope embedded CSS in template HTML so that :root, body, and html selectors do not leak into the CRM application
  const scopeTemplateHtml = useCallback((html: string): string => {
    if (!html || !html.includes('<style')) return html;
    return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (match, attrs, css) => {
      const scoped = css
        .replace(/:root(\[[^\]]*\])?/gi, '.email-template-canvas')
        .replace(/(^|[\s},;])body(?=[\s{,])/gi, '$1.email-template-canvas')
        .replace(/(^|[\s},;])html(?=[\s{,])/gi, '$1.email-template-canvas');
      return `<style${attrs}>${scoped}</style>`;
    });
  }, []);

  const unscopeTemplateHtml = useCallback((html: string): string => {
    if (!html || !html.includes('<style')) return html;
    return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (match, attrs, css) => {
      const unscoped = css.replace(/\.email-template-canvas/gi, ':root');
      return `<style${attrs}>${unscoped}</style>`;
    });
  }, []);

  // Manual & Edit Template Builder State
  const [isManualTemplateModalOpen, setIsManualTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [manualTemplateMode, setManualTemplateMode] = useState<'editor' | 'html'>('editor');
  const [manualTemplateName, setManualTemplateName] = useState('');
  const [manualTemplateSubject, setManualTemplateSubject] = useState('');
  const [manualTemplateCategory, setManualTemplateCategory] = useState('General');
  const [manualTemplateHtml, setManualTemplateHtml] = useState('');
  const [savingManualTemplate, setSavingManualTemplate] = useState(false);
  const [isTemplateImageModalOpen, setIsTemplateImageModalOpen] = useState(false);
  const manualEditorRef = useRef<HTMLDivElement>(null);
  const manualLivePreviewRef = useRef<HTMLDivElement>(null);
  const editorViewportRef = useRef<HTMLDivElement>(null);

  // Canva-Style Image Manipulation in Manual Template Editor
  const [selectedEditorImage, setSelectedEditorImage] = useState<HTMLImageElement | null>(null);
  const [imageOverlayRect, setImageOverlayRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);
  const draggedEditorNodeRef = useRef<HTMLElement | null>(null);
  const copiedTemplateImageHtmlRef = useRef<string | null>(null);
  const [isImageShapePickerOpen, setIsImageShapePickerOpen] = useState(false);

  // Manual / Edit Template Content History Stack (Undo / Redo / Ctrl+Z support)
  const [manualTemplateHistory, setManualTemplateHistory] = useState<string[]>([]);
  const [manualTemplateHistoryIndex, setManualTemplateHistoryIndex] = useState<number>(-1);
  const debounceManualHistoryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleOpenEditTemplate = (tpl: DbTemplate) => {
    const rawContent = tpl.content || '';
    const scopedContent = scopeTemplateHtml(rawContent);
    setEditingTemplateId(tpl._id);
    setManualTemplateName(tpl.name || '');
    setManualTemplateSubject(tpl.subject || '');
    setManualTemplateCategory(tpl.category || 'General');
    setManualTemplateHtml(rawContent);
    setManualTemplateMode('editor');
    setManualTemplateHistory([scopedContent]);
    setManualTemplateHistoryIndex(0);
    setIsManualTemplateModalOpen(true);
    setTimeout(() => {
      if (manualEditorRef.current) {
        manualEditorRef.current.innerHTML = scopedContent;
      }
    }, 50);
  };

  // Safety net: ensure manual editor DOM keeps its content in sync with state if empty
  useEffect(() => {
    if (isManualTemplateModalOpen && manualEditorRef.current && manualTemplateHtml) {
      const scoped = scopeTemplateHtml(manualTemplateHtml);
      if (!manualEditorRef.current.innerHTML.trim() && scoped.trim()) {
        manualEditorRef.current.innerHTML = scoped;
      }
    }
  }, [isManualTemplateModalOpen, manualTemplateHtml, scopeTemplateHtml]);

  // Direct Template Preview Modal State
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<DbTemplate | null>(null);
  const [isTemplatePreviewModalOpen, setIsTemplatePreviewModalOpen] = useState(false);
  const [templatePreviewMode, setTemplatePreviewMode] = useState<'visual' | 'html'>('visual');

  // Live AI Draft Template State
  const [aiDraftTemplate, setAiDraftTemplate] = useState<{
    name: string;
    subject: string;
    content: string;
    category: string;
  } | null>(null);

  const [previewTab, setPreviewTab] = useState<"visual" | "editor" | "code">("visual");
  const aiTemplateEditorRef = useRef<HTMLDivElement>(null);
  const [isAiHighlighterOpen, setIsAiHighlighterOpen] = useState(false);
  const [isAiColorPickerOpen, setIsAiColorPickerOpen] = useState(false);
  const [aiTextColor, setAiTextColor] = useState('#000000');
  const [aiHighlightColor, setAiHighlightColor] = useState('transparent');
  const [aiEditorActiveFormats, setAiEditorActiveFormats] = useState<{ [key: string]: any }>({
    bold: false,
    italic: false,
    underline: false,
    h1: false,
    h2: false,
    h3: false,
    p: false,
    ul: false,
    ol: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    fontSize: '',
  });

  // 1-to-1 Emailing Filter & Search States
  const [conversationsSearch, setConversationsSearch] = useState("");
  const [conversationsFilter, setConversationsFilter] = useState<"all" | "ea_lead" | "main_lead" | "opted_out">("all");
  const [conversationsSort, setConversationsSort] = useState<"recent" | "name">("recent");

  // 1-to-1 Compose Form
  const [composeForm, setComposeForm] = useState({
    subject: "",
    body: ""
  });
  const [isComposeExpanded, setIsComposeExpanded] = useState(false);

  // Toolbar configuration for 1-to-1 compose editor (pure button controls, no unlabeled select dropdowns)
  const composeQuillModules = React.useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'clean']
    ]
  }), []);

  // DOM Safeguard: Ensure all inputs and select controls inside Quill toolbars have unique id, name, and aria-label attributes
  useEffect(() => {
    if (isComposeExpanded && workspace === "inbox") {
      const timer = setTimeout(() => {
        const selects = document.querySelectorAll<HTMLSelectElement>('.ql-toolbar select');
        selects.forEach((sel, idx) => {
          if (!sel.id) sel.id = `quill-toolbar-select-${idx}`;
          if (!sel.name) sel.name = `quill_toolbar_select_${idx}`;
          if (!sel.getAttribute('aria-label')) sel.setAttribute('aria-label', `Formatting option ${idx + 1}`);
        });
        const inputs = document.querySelectorAll<HTMLInputElement>('.ql-toolbar input');
        inputs.forEach((inp, idx) => {
          if (!inp.id) inp.id = `quill-toolbar-input-${idx}`;
          if (!inp.name) inp.name = `quill_toolbar_input_${idx}`;
          if (!inp.getAttribute('aria-label')) inp.setAttribute('aria-label', `Formatting input ${idx + 1}`);
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isComposeExpanded, workspace]);

  // Loader States
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog States
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isAiPersonalizedModalOpen, setIsAiPersonalizedModalOpen] = useState(false);
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isViewStatsOpen, setIsViewStatsOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Full View & Global Synchronized View Mode
  const [isStatsModalExpanded, setIsStatsModalExpanded] = useState(false);
  const [isSegmentModalExpanded, setIsSegmentModalExpanded] = useState(false);
  const [marketingViewMode, setMarketingViewModeState] = useState<'grid' | 'table'>(() => {
    try {
      return (localStorage.getItem('yau_marketing_view_mode') as 'grid' | 'table') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const setMarketingViewMode = (mode: 'grid' | 'table') => {
    setMarketingViewModeState(mode);
    try {
      localStorage.setItem('yau_marketing_view_mode', mode);
    } catch {
      // ignore
    }
  };

  const [campaignsSearchQuery, setCampaignsSearchQuery] = useState("");
  const [segmentsSearchQuery, setSegmentsSearchQuery] = useState("");
  const [segmentTypeFilter, setSegmentTypeFilter] = useState<"all" | "csv" | "static" | "campaign" | "afterschool" | "evening_activities" | "mobile_app" | "school" | "location" | "app_members" | "manual" | "ea_leads" | "legacy_cc">("all");
  const [templatesSearchQuery, setTemplatesSearchQuery] = useState("");

  // Delete Campaign Confirmation State
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);
  const [isDeleteCampaignModalOpen, setIsDeleteCampaignModalOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  // Delete Segment / List Confirmation State
  const [segmentToDelete, setSegmentToDelete] = useState<Segment | null>(null);
  const [isDeleteSegmentModalOpen, setIsDeleteSegmentModalOpen] = useState(false);
  const [deletingSegment, setDeletingSegment] = useState(false);

  // Delete Template Confirmation State
  const [templateToDelete, setTemplateToDelete] = useState<DbTemplate | null>(null);
  const [isDeleteTemplateModalOpen, setIsDeleteTemplateModalOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  // Campaign Form State
  const [campaignForm, setCampaignForm] = useState({
    title: "",
    subject: "",
    content: "",
    segmentId: "",
    segmentIds: [] as string[],
    sendAt: "",
    isScheduled: false,
    templateId: null as string | null
  });
  const [campaignSegmentSearchQuery, setCampaignSegmentSearchQuery] = useState("");
  const [isSegmentDropdownOpen, setIsSegmentDropdownOpen] = useState(false);
  const segmentDropdownRef = useRef<HTMLDivElement>(null);
  const [campaignEditorMode, setCampaignEditorMode] = useState<'preview' | 'editor' | 'html'>('preview');
  const [showCampaignAiPanel, setShowCampaignAiPanel] = useState(false);
  const [isCampaignPreviewFullscreen, setIsCampaignPreviewFullscreen] = useState(false);

  // Campaign State Content & Template History Stack (Undo / Redo / Ctrl+Z support)
  const [campaignHistory, setCampaignHistory] = useState<{ content: string; templateId?: string | null }[]>([]);
  const [campaignHistoryIndex, setCampaignHistoryIndex] = useState<number>(-1);
  const debounceCampaignHistoryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Segment Form State
  const [segmentForm, setSegmentForm] = useState({
    name: "",
    description: "",
    type: "csv" as "csv" | "static" | "campaign" | "dynamic" | "marketing",
    filters: {
      source: "",
      sport: "",
      location: "",
      status: "",
      campaignId: "",
      campaignIds: [] as string[]
    },
    leadIds: [] as string[],
    leadModel: "Lead" as "Lead" | "EALead",
    customContacts: [] as { name: string; email: string }[]
  });

  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [salesCampaigns, setSalesCampaigns] = useState<any[]>([]);
  const [salesCampaignSearch, setSalesCampaignSearch] = useState("");
  const [isSalesCampaignDropdownOpen, setIsSalesCampaignDropdownOpen] = useState(false);
  const salesCampaignDropdownRef = useRef<HTMLDivElement>(null);
  const [contactCategoryFilter, setContactCategoryFilter] = useState<"all" | "main_lead" | "ea_lead" | "team_member">("all");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [customContactName, setCustomContactName] = useState("");
  const [customContactEmail, setCustomContactEmail] = useState("");

  const [campaignPreviewContacts, setCampaignPreviewContacts] = useState<{ name: string; email: string }[]>([]);
  const [loadingCampaignPreview, setLoadingCampaignPreview] = useState(false);
  const [campaignPreviewSearch, setCampaignPreviewSearch] = useState("");
  const [campaignSelectedIds, setCampaignSelectedIds] = useState<string[]>([]);
  const loadedCampaignIdsRef = useRef<string>("");

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

  // State for Quick Add / Append inside View Segment Modal
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddEmail, setQuickAddEmail] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [isAppendingCsv, setIsAppendingCsv] = useState(false);
  const appendCsvFileInputRef = useRef<HTMLInputElement>(null);

  // Add Contact to List Modal State
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [addContactTargetSegmentIds, setAddContactTargetSegmentIds] = useState<string[]>([]);
  const [isAddContactListDropdownOpen, setIsAddContactListDropdownOpen] = useState(false);
  const [addContactListSearch, setAddContactListSearch] = useState("");
  const addContactListDropdownRef = useRef<HTMLDivElement>(null);
  const [addContactMode, setAddContactMode] = useState<"individual" | "crm" | "paste">("individual");
  const [addContactSingleName, setAddContactSingleName] = useState("");
  const [addContactSingleEmail, setAddContactSingleEmail] = useState("");
  const [addContactSinglePhone, setAddContactSinglePhone] = useState("");
  const [addContactSingleSource, setAddContactSingleSource] = useState("");
  const [addContactCrmSelectedIds, setAddContactCrmSelectedIds] = useState<string[]>([]);
  const [addContactCrmSearch, setAddContactCrmSearch] = useState("");
  const [addContactCrmCategory, setAddContactCrmCategory] = useState<"all" | "main_lead" | "ea_lead" | "team_member">("all");
  const [addContactPasteText, setAddContactPasteText] = useState("");
  const [isSubmittingAddContact, setIsSubmittingAddContact] = useState(false);

  // State for Edit / Builder Segment Modal
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [existingSegmentContacts, setExistingSegmentContacts] = useState<{ name: string; email: string; status?: string }[]>([]);
  const [existingSelectedEmails, setExistingSelectedEmails] = useState<string[]>([]);
  const [existingContactsSearch, setExistingContactsSearch] = useState("");
  const [segmentTab, setSegmentTab] = useState<"existing" | "csv" | "static" | "campaign" | "marketing">("csv");
  const [customContactsSearch, setCustomContactsSearch] = useState("");

  // Marketing List Segment State
  const [marketingListContacts, setMarketingListContacts] = useState<MarketingContactItem[]>([]);
  const [selectedMarketingIds, setSelectedMarketingIds] = useState<string[]>([]);
  const [loadingMarketingContacts, setLoadingMarketingContacts] = useState(false);
  const [marketingSearchQuery, setMarketingSearchQuery] = useState("");
  const [marketingChannelFilter, setMarketingChannelFilter] = useState<string>("all");

  const filteredExistingContacts = React.useMemo(() => {
    if (!existingContactsSearch.trim()) return existingSegmentContacts;
    const q = existingContactsSearch.toLowerCase().trim();
    return existingSegmentContacts.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      c.email.toLowerCase().includes(q)
    );
  }, [existingSegmentContacts, existingContactsSearch]);

  const filteredCustomContacts = React.useMemo(() => {
    if (!customContactsSearch.trim()) return segmentForm.customContacts;
    const q = customContactsSearch.toLowerCase().trim();
    return segmentForm.customContacts.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }, [segmentForm.customContacts, customContactsSearch]);

  const marketingChannelCounts = React.useMemo(() => {
    return {
      all: marketingListContacts.length,
      mobile: marketingListContacts.filter(c => matchMarketingChannel(c.source, c.entryPoint, "mobile")).length,
      web_portal: marketingListContacts.filter(c => matchMarketingChannel(c.source, c.entryPoint, "web_portal")).length,
      afterschool: marketingListContacts.filter(c => matchMarketingChannel(c.source, c.entryPoint, "afterschool")).length,
      manual: marketingListContacts.filter(c => matchMarketingChannel(c.source, c.entryPoint, "manual")).length,
    };
  }, [marketingListContacts]);

  const filteredMarketingContacts = React.useMemo(() => {
    let list = marketingListContacts;
    if (marketingChannelFilter && marketingChannelFilter !== "all") {
      list = list.filter(c => matchMarketingChannel(c.source, c.entryPoint, marketingChannelFilter));
    }
    if (marketingSearchQuery.trim()) {
      const q = marketingSearchQuery.toLowerCase().trim();
      list = list.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.source && c.source.toLowerCase().includes(q)) ||
        (c.schoolName && c.schoolName.toLowerCase().includes(q)) ||
        (c.locationName && c.locationName.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }
    return list;
  }, [marketingListContacts, marketingChannelFilter, marketingSearchQuery]);

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

  // Comprehensive Bounce Identifier for SendGrid 550 / 5.1.1 / dropped / blocked / mailbox not found
  const isLogBounced = (log: any) =>
    Boolean(
      log && (
        log.status === "bounce" ||
        log.status === "bounced" ||
        log.status === "blocked" ||
        log.status === "failed" ||
        (log.error && (
          log.error.includes("550") ||
          log.error.includes("5.1.1") ||
          log.error.toLowerCase().includes("does not exist") ||
          log.error.toLowerCase().includes("user unknown") ||
          log.error.toLowerCase().includes("bounce") ||
          log.error.toLowerCase().includes("rejected") ||
          log.error.toLowerCase().includes("invalid") ||
          log.error.toLowerCase().includes("nosuchuser")
        ))
      )
    );

  const formatLogErrorMessage = (error?: string | null) => {
    if (!error) return null;
    if (error.includes("550") || error.includes("5.1.1") || error.toLowerCase().includes("does not exist") || error.toLowerCase().includes("user unknown") || error.toLowerCase().includes("nosuchuser")) {
      return "Bounced: Recipient email account does not exist (550 5.1.1)";
    }
    if (error.toLowerCase().includes("rejected") || error.toLowerCase().includes("blocked") || error.toLowerCase().includes("spam")) {
      return "Delivery blocked by receiving mail server";
    }
    if (error.toLowerCase().includes("quota") || error.toLowerCase().includes("full")) {
      return "Recipient mailbox is full / over quota";
    }
    return error.length > 80 ? `${error.slice(0, 80)}...` : error;
  };

  const filteredCampaignRecipients = React.useMemo(() => {
    if (!selectedCampaign?.recipientLogs) return [];
    let list = selectedCampaign.recipientLogs;

    if (campaignRecipientFilter === "open" || campaignRecipientFilter === "opened") {
      list = list.filter(log => !isLogBounced(log) && (log.status === "open" || log.status === "opened" || log.status === "click" || log.status === "clicked" || log.status === "unsubscribe" || log.status === "unsubscribed"));
    } else if (campaignRecipientFilter === "click" || campaignRecipientFilter === "clicked") {
      list = list.filter(log => !isLogBounced(log) && (log.status === "click" || log.status === "clicked" || log.status === "unsubscribe" || log.status === "unsubscribed"));
    } else if (campaignRecipientFilter === "unsubscribe" || campaignRecipientFilter === "unsubscribed") {
      list = list.filter(log => !isLogBounced(log) && (log.status === "unsubscribe" || log.status === "unsubscribed"));
    } else if (campaignRecipientFilter === "bounce" || campaignRecipientFilter === "bounced") {
      list = list.filter(log => isLogBounced(log));
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
      toast.success(res.data?.message || "Campaign sent & delivered successfully!");
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

  const handleExportCampaignData = (camp: Campaign) => {
    if (!camp.recipientLogs || camp.recipientLogs.length === 0) {
      toast.error("No recipient logs available to export.");
      return;
    }

    const headers = ["Recipient Name", "Email Address", "Status", "Error Message", "SendGrid Message ID"];
    const rows = camp.recipientLogs.map(log => [
      log.name || "",
      log.email || "",
      log.status || "pending",
      log.error || "",
      log.messageId || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Campaign_Export_${camp.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Campaign data exported successfully!");
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

  const filteredCampaigns = React.useMemo(() => {
    if (!campaignsSearchQuery.trim()) return campaigns;
    const q = campaignsSearchQuery.toLowerCase().trim();
    return campaigns.filter(c =>
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.subject && c.subject.toLowerCase().includes(q)) ||
      (c.segmentId?.name && c.segmentId.name.toLowerCase().includes(q))
    );
  }, [campaigns, campaignsSearchQuery]);

  const filteredSegments = React.useMemo(() => {
    let list = segments;
    if (segmentTypeFilter !== "all") {
      if (segmentTypeFilter === "afterschool" || segmentTypeFilter === "school") {
        list = list.filter(s => s.category === "afterschool" || s.category === "school");
      } else if (segmentTypeFilter === "evening_activities" || segmentTypeFilter === "location") {
        list = list.filter(s => s.category === "evening_activities" || s.category === "location");
      } else if (segmentTypeFilter === "mobile_app" || segmentTypeFilter === "app_members") {
        list = list.filter(s => s.category === "mobile_app" || s.category === "app_members");
      } else if (segmentTypeFilter === "legacy_cc") {
        list = list.filter(s => s.category === "legacy_cc" || (s.name && (s.name.includes("— Legacy CC") || s.name.includes("Legacy CC"))));
      } else if (["ea_leads", "manual"].includes(segmentTypeFilter)) {
        list = list.filter(s => s.category === segmentTypeFilter);
      } else {
        list = list.filter(s => s.type === segmentTypeFilter);
      }
    }
    if (segmentsSearchQuery.trim()) {
      const q = segmentsSearchQuery.toLowerCase().trim();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.type.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [segments, segmentsSearchQuery, segmentTypeFilter]);

  // Alphabetized lists memo for Add Contact Dropdown and general list selection
  const alphabetizedSegments = React.useMemo(() => {
    return [...segments].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
  }, [segments]);

  // Filtered alphabetized segments for Create Marketing Campaign multi-select
  const campaignFilteredSegments = React.useMemo(() => {
    let list = alphabetizedSegments;
    if (campaignSegmentSearchQuery.trim()) {
      const q = campaignSegmentSearchQuery.toLowerCase().trim();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.type && s.type.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [alphabetizedSegments, campaignSegmentSearchQuery]);

  // Live Deduplicated Recipient Calculation for Campaign Creation
  const campaignSelectedRecipientsStats = React.useMemo(() => {
    const selectedSegs = segments.filter(s => (campaignForm.segmentIds || []).includes(s._id));
    const uniqueEmails = new Set<string>();
    let rawTotalContacts = 0;

    for (const seg of selectedSegs) {
      if (seg.contacts && Array.isArray(seg.contacts)) {
        for (const c of seg.contacts) {
          if (c?.email) {
            rawTotalContacts++;
            const norm = c.email.toLowerCase().trim();
            if (c.status !== 'opted_out') {
              uniqueEmails.add(norm);
            }
          }
        }
      }
    }

    const duplicatesEliminated = Math.max(0, rawTotalContacts - uniqueEmails.size);
    return {
      selectedListsCount: selectedSegs.length,
      uniqueRecipientsCount: uniqueEmails.size,
      rawTotalContacts,
      duplicatesEliminated
    };
  }, [segments, campaignForm.segmentIds]);

  // Filtered alphabetized segments for Add Contact Dropdown search
  const filteredAlphabetizedSegments = React.useMemo(() => {
    let list = alphabetizedSegments;
    if (addContactListSearch.trim()) {
      const q = addContactListSearch.toLowerCase().trim();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.type && s.type.toLowerCase().includes(q))
      );
    }
    return list;
  }, [alphabetizedSegments, addContactListSearch]);

  const addContactTargetSegments = React.useMemo(() => {
    return segments.filter(s => addContactTargetSegmentIds.includes(s._id));
  }, [segments, addContactTargetSegmentIds]);

  const addContactTargetEmailSet = React.useMemo(() => {
    const set = new Set<string>();
    addContactTargetSegments.forEach(seg => {
      (seg.contacts || []).forEach(c => {
        if (c.email) set.add(c.email.toLowerCase().trim());
      });
    });
    return set;
  }, [addContactTargetSegments]);

  const filteredAddContactCrmContacts = React.useMemo(() => {
    let list = availableContacts;
    if (addContactCrmCategory !== "all") {
      list = list.filter(c => c.leadType === addContactCrmCategory);
    }
    if (addContactCrmSearch.trim()) {
      const q = addContactCrmSearch.toLowerCase().trim();
      list = list.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.leadName && c.leadName.toLowerCase().includes(q)) ||
        (c.categoryTag && c.categoryTag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [availableContacts, addContactCrmCategory, addContactCrmSearch]);

  const parsedAddContactPastedContacts = React.useMemo(() => {
    if (!addContactPasteText.trim()) return [];
    const tokens = addContactPasteText.split(/[\r\n,;]+/).map(t => t.trim()).filter(Boolean);
    const results: { name: string; email: string }[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      const match = token.match(/(?:([^<]+)<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:>)?/);
      if (match) {
        const email = match[2].toLowerCase().trim();
        const rawName = match[1] ? match[1].replace(/["']/g, '').trim() : '';
        const name = rawName || email.split('@')[0];
        if (!seen.has(email)) {
          seen.add(email);
          results.push({ name, email });
        }
      }
    }
    return results;
  }, [addContactPasteText]);

  const filteredTemplates = React.useMemo(() => {
    if (!templatesSearchQuery.trim()) return templates;
    const q = templatesSearchQuery.toLowerCase().trim();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.aiPrompt && t.aiPrompt.toLowerCase().includes(q))
    );
  }, [templates, templatesSearchQuery]);

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
    const marketingCount = selectedMarketingIds.length;

    const totalSet = new Set<string>();

    // 0. Existing Retained Contacts (when editing)
    let existingCount = 0;
    if (editingSegmentId) {
      existingSegmentContacts.forEach(c => {
        if (existingSelectedEmails.includes(c.email)) {
          totalSet.add(c.email.toLowerCase().trim());
          existingCount++;
        }
      });
    }

    // 1. CSV
    csvParsedContacts.forEach(c => {
      if (csvSelectedEmails.includes(c.email)) totalSet.add(c.email.toLowerCase().trim());
    });

    // 2. Manual CRM
    segmentForm.leadIds.forEach(id => {
      const found = availableContacts.find(c => c._id === id);
      if (found?.email) totalSet.add(found.email.toLowerCase().trim());
    });

    // 3. Custom Manual
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

    // 5. Marketing List
    marketingListContacts.forEach(c => {
      if (selectedMarketingIds.includes(c._id) && c.email) {
        totalSet.add(c.email.toLowerCase().trim());
      }
    });

    return {
      totalUnique: totalSet.size,
      existingCount,
      csvCount,
      crmCount,
      eaCount,
      teamCount,
      campaignCount,
      customCount,
      marketingCount
    };
  }, [editingSegmentId, existingSegmentContacts, existingSelectedEmails, csvSelectedEmails, csvParsedContacts, segmentForm.leadIds, availableContacts, segmentForm.customContacts, campaignSelectedIds, campaignPreviewContacts, selectedMarketingIds, marketingListContacts]);

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

  const fetchSalesCampaigns = useCallback(async () => {
    try {
      const res = await api.get("/campaigns");
      if (Array.isArray(res.data)) {
        setSalesCampaigns(res.data);
      }
    } catch (err) {
      console.error("Failed to load sales campaigns", err);
    }
  }, []);

  const getSalesCampaignName = (c: any): string => {
    if (!c) return 'Unnamed Campaign';
    return c.name || c.title || c.campaignName || c.campaign_name || 'Unnamed Campaign';
  };

  const filteredSalesCampaigns = React.useMemo(() => {
    if (!salesCampaignSearch.trim()) return salesCampaigns;
    const q = salesCampaignSearch.toLowerCase().trim();
    return salesCampaigns.filter(c => getSalesCampaignName(c).toLowerCase().includes(q));
  }, [salesCampaigns, salesCampaignSearch]);

  // Click outside listener for Sales Campaign multi-select dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        salesCampaignDropdownRef.current &&
        !salesCampaignDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSalesCampaignDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Click outside listener for Add Contact multi-select list dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addContactListDropdownRef.current &&
        !addContactListDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAddContactListDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Click outside listener for Campaign Recipient Segment dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        segmentDropdownRef.current &&
        !segmentDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSegmentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch campaign contact preview whenever segmentForm.filters.campaignIds / campaignId changes
  useEffect(() => {
    const rawIds = segmentForm.filters.campaignIds && segmentForm.filters.campaignIds.length > 0
      ? segmentForm.filters.campaignIds
      : (segmentForm.filters.campaignId ? [segmentForm.filters.campaignId] : []);

    const idsKey = rawIds.slice().sort().join(',');

    if (rawIds.length > 0) {
      if (loadedCampaignIdsRef.current !== idsKey) {
        loadedCampaignIdsRef.current = idsKey;
        setLoadingCampaignPreview(true);
        api.get(`/emails/segments/preview-campaign/${rawIds.join(',')}`)
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
            loadedCampaignIdsRef.current = "";
          })
          .finally(() => {
            setLoadingCampaignPreview(false);
          });
      }
    } else {
      if (loadedCampaignIdsRef.current !== "") {
        loadedCampaignIdsRef.current = "";
        setCampaignPreviewContacts([]);
        setCampaignSelectedIds([]);
      }
    }
  }, [segmentForm.filters.campaignId, segmentForm.filters.campaignIds]);

  const fetchAvailableContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const [contactsRes, campRes] = await Promise.allSettled([
        api.get("/emails/segments/available-contacts"),
        api.get("/campaigns")
      ]);

      if (contactsRes.status === "fulfilled" && Array.isArray(contactsRes.value.data)) {
        setAvailableContacts(contactsRes.value.data);
      }

      if (campRes.status === "fulfilled" && Array.isArray(campRes.value.data)) {
        setSalesCampaigns(campRes.value.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load contacts for selection");
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const fetchMarketingListContacts = useCallback(async () => {
    setLoadingMarketingContacts(true);
    try {
      const res = await api.get("/emails/segments/marketing-contacts");
      if (res.data?.success && Array.isArray(res.data.contacts)) {
        setMarketingListContacts(res.data.contacts);
      }
    } catch (err) {
      console.error("Failed to load marketing contacts for segment:", err);
    } finally {
      setLoadingMarketingContacts(false);
    }
  }, []);

  // Auto-fetch sales campaigns on mount and when opening segment modal
  useEffect(() => {
    fetchSalesCampaigns();
  }, [fetchSalesCampaigns]);

  useEffect(() => {
    if (isSegmentModalOpen) {
      fetchSalesCampaigns();
      fetchAvailableContacts();
      fetchMarketingListContacts();
    }
  }, [isSegmentModalOpen, fetchSalesCampaigns, fetchAvailableContacts, fetchMarketingListContacts]);

  // CSV Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSegmentName, setImportSegmentName] = useState("");
  const [importCsvParsedContacts, setImportCsvParsedContacts] = useState<{ name: string; email: string }[]>([]);
  const [importCsvSelectedEmails, setImportCsvSelectedEmails] = useState<string[]>([]);
  const [importCsvSearchQuery, setImportCsvSearchQuery] = useState("");

  const handleImportModalCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    if (!importSegmentName) {
      setImportSegmentName(file.name.replace(/\.[^/.]+$/, ""));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const cleanText = text.replace(/^\uFEFF/, '');
      const lines = cleanText.split(/\r\n|\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      let emailIdx = headers.findIndex(h => h === 'email' || h.includes('email') || h.includes('e-mail') || h.includes('mail'));
      let nameIdx = headers.findIndex(h => h.includes('name') || h.includes('first') || h.includes('contact'));

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

      setImportCsvParsedContacts(parsed);
      setImportCsvSelectedEmails(parsed.map(c => c.email));
      if (parsed.length > 0) {
        toast.success(`Loaded ${parsed.length} contacts from CSV!`);
      } else {
        toast.error("No valid email addresses found in this CSV.");
      }
    };
    reader.readAsText(file);
  };

  const filteredImportCsvContacts = React.useMemo(() => {
    if (!importCsvSearchQuery.trim()) return importCsvParsedContacts;
    const q = importCsvSearchQuery.toLowerCase().trim();
    return importCsvParsedContacts.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [importCsvParsedContacts, importCsvSearchQuery]);

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showComposeAiPanel, setShowComposeAiPanel] = useState(false);



  // Helper to clean and extract pure HTML table layout from AI responses
  const extractCleanHtml = (raw: string): string => {
    if (!raw) return '';
    let str = raw.trim();

    // 1. If it's a JSON response with a "content" field, extract the content
    try {
      const match = str.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.content) return parsed.content;
      }
    } catch {
      // ignore
    }

    try {
      const contentFieldMatch = str.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (contentFieldMatch && contentFieldMatch[1]) {
        const extractedContent = contentFieldMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        if (extractedContent.includes('<') && extractedContent.includes('>')) {
          str = extractedContent;
        }
      }
    } catch {
      // ignore
    }

    // 2. Extract complete HTML table layout if present anywhere in the string
    const tableMatch = str.match(/<table[\s\S]*<\/table>/i);
    if (tableMatch) {
      return tableMatch[0];
    }

    // 3. Extract HTML div or section container if present
    const containerMatch = str.match(/<(?:div|section|article)[\s\S]*<\/(?:div|section|article)>/i);
    if (containerMatch) {
      return containerMatch[0];
    }

    // 4. Strip markdown code fences (e.g. ```json or ```html ... ```)
    str = str.replace(/^```(?:html|json|xml)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // 5. If it starts with conversational preamble before an HTML tag, trim to first HTML tag
    const firstTagIndex = str.indexOf('<');
    if (firstTagIndex > 0 && firstTagIndex < 200) {
      str = str.slice(firstTagIndex);
    }

    return str;
  };

  // Groq AI Template Generator Handler (Updates Live Draft Preview with Iterative Context)
  const handleGenerateAiTemplate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiPromptInput.trim()) {
      toast.error("Please enter a prompt for Anthropic AI!");
      return;
    }
    setIsGeneratingAiTemplate(true);
    try {
      const fullPrompt = `${aiPromptInput.trim()}. Preferred Tone/Style: ${aiToneInput}.`;

      const payload: { prompt: string; category: string; existingContent?: string } = {
        prompt: fullPrompt,
        category: aiCategoryInput || "AI Generated"
      };

      const res = await api.post("/templates/ai-generate", payload);
      toast.info("Anthropic API key is hit", { description: "Model: Claude Sonnet 4.6" });
      toast.success(`Template layout generated with Anthropic Claude!`);

      // Clean and sanitize HTML layout
      const cleanContent = extractCleanHtml(res.data.content || '');

      // Preserve user's manual inputs if already filled; otherwise auto-fill from AI response
      const resolvedName = templateNameInput.trim() ? templateNameInput.trim() : (res.data.name || "AI Generated Template");
      const resolvedSubject = templateSubjectInput.trim() ? templateSubjectInput.trim() : (res.data.subject || "Email Update");

      if (!templateNameInput.trim()) {
        setTemplateNameInput(resolvedName);
      }
      if (!templateSubjectInput.trim()) {
        setTemplateSubjectInput(resolvedSubject);
      }

      setAiDraftTemplate({
        name: resolvedName,
        subject: resolvedSubject,
        content: cleanContent,
        category: res.data.category || aiCategoryInput
      });

      if (aiTemplateEditorRef.current) {
        aiTemplateEditorRef.current.innerHTML = cleanContent;
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to generate AI template");
    } finally {
      setIsGeneratingAiTemplate(false);
    }
  };

  // Save Current Live AI Draft Template to MongoDB
  const handleSaveDraftTemplate = async () => {
    const activeEditorContent = (previewTab === 'editor' && aiTemplateEditorRef.current)
      ? aiTemplateEditorRef.current.innerHTML
      : aiDraftTemplate?.content;

    const finalName = templateNameInput.trim() || aiDraftTemplate?.name;
    const finalSubject = templateSubjectInput.trim() || aiDraftTemplate?.subject;
    const finalContent = activeEditorContent || aiDraftTemplate?.content;

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
      fetchTemplates(true);
      setIsAiTemplateModalOpen(false);
      setAiDraftTemplate(null);
    } catch (err) {
      toast.error("Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Use Current Live AI Draft in Campaign: Saves to DB first, then pre-selects the saved template in Campaign Wizard
  const handleUseDraftInCampaign = async () => {
    const activeEditorContent = (previewTab === 'editor' && aiTemplateEditorRef.current)
      ? aiTemplateEditorRef.current.innerHTML
      : aiDraftTemplate?.content;

    const finalName = templateNameInput.trim() || aiDraftTemplate?.name || "AI Generated Template";
    const finalSubject = templateSubjectInput.trim() || aiDraftTemplate?.subject;
    const finalContent = activeEditorContent || aiDraftTemplate?.content;

    if (!finalSubject || !finalContent) {
      toast.error("Please generate a template first!");
      return;
    }

    setIsSavingTemplate(true);
    try {
      // 1. Save template to database
      const res = await api.post("/templates", {
        name: finalName,
        category: aiCategoryInput || aiDraftTemplate?.category || "General",
        subject: finalSubject,
        content: finalContent,
        isAiGenerated: true,
        aiPrompt: aiPromptInput.trim()
      });

      const savedTemplate = res.data;
      toast.success("Template saved and loaded into campaign builder!");

      // 2. Add to templates list in state and revalidate
      setTemplates(prev => [savedTemplate, ...prev.filter(t => t._id !== savedTemplate._id)]);
      fetchTemplates(true);

      // 3. Configure campaign form with the saved template
      setCampaignForm(prev => ({
        ...prev,
        title: prev.title || finalName,
        subject: savedTemplate.subject || finalSubject,
        content: savedTemplate.content || finalContent,
        templateId: savedTemplate._id
      }));
      pushCampaignHistory(savedTemplate.content || finalContent, savedTemplate.subject || finalSubject);
      setCampaignEditorMode('preview');

      // 4. Close AI template modal & open Campaign wizard
      setIsAiTemplateModalOpen(false);
      setAiDraftTemplate(null);
      setIsCampaignModalOpen(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to save template for campaign");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Confirm and Delete Email Template
  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setDeletingTemplate(true);
    try {
      await api.delete(`/templates/${templateToDelete._id}`);
      toast.success(`Template "${templateToDelete.name}" deleted successfully!`);
      setTemplates(prev => prev.filter(t => t._id !== templateToDelete._id));
      fetchTemplates(true);
      setIsDeleteTemplateModalOpen(false);
      setTemplateToDelete(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to delete template");
    } finally {
      setDeletingTemplate(false);
    }
  };

  // Save or Update Manual / Edited Template to MongoDB
  const handleSaveManualTemplate = async () => {
    const rawContent = manualTemplateMode === 'html'
      ? manualTemplateHtml.trim()
      : (manualEditorRef.current?.innerHTML || '').trim();
    const content = unscopeTemplateHtml(rawContent);

    if (!manualTemplateName.trim()) {
      toast.error('Please enter a template name.');
      return;
    }
    if (!content || content === '<br>' || content === '<div><br></div>') {
      toast.error('Template content cannot be empty.');
      return;
    }
    setSavingManualTemplate(true);
    try {
      if (editingTemplateId) {
        const res = await api.put(`/templates/${editingTemplateId}`, {
          name: manualTemplateName.trim(),
          subject: manualTemplateSubject.trim() || manualTemplateName.trim(),
          category: manualTemplateCategory || 'General',
          content,
        });
        toast.success('Template updated successfully!');
        setTemplates(prev => prev.map(t => t._id === editingTemplateId ? res.data : t));
      } else {
        const res = await api.post('/templates', {
          name: manualTemplateName.trim(),
          subject: manualTemplateSubject.trim() || manualTemplateName.trim(),
          category: manualTemplateCategory || 'General',
          content,
          isAiGenerated: false,
        });
        toast.success('Template saved successfully!');
        setTemplates(prev => [res.data, ...prev]);
      }
      fetchTemplates(true);
      setIsManualTemplateModalOpen(false);
      resetManualTemplateModalState();
    } catch (err: any) {
      toast.error(err.response?.data?.error || (editingTemplateId ? 'Failed to update template.' : 'Failed to save template.'));
    } finally {
      setSavingManualTemplate(false);
    }
  };

  // Rich Text Editor active format state
  const [editorActiveFormats, setEditorActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    h1: false,
    h2: false,
    h3: false,
    p: false,
    ul: false,
    ol: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    fontSize: '',
  });

  const [isHighlighterOpen, setIsHighlighterOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [manualTextColor, setManualTextColor] = useState('#000000');
  const [manualHighlightColor, setManualHighlightColor] = useState('transparent');

  // Persistent selection range tracker across all contentEditable instances
  const savedSelectionRangeRef = useRef<Range | null>(null);

  const saveSelectionRange = useCallback(() => {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedSelectionRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    } catch {
      // ignore
    }
  }, []);

  const restoreSelectionRange = useCallback(() => {
    try {
      if (savedSelectionRangeRef.current) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedSelectionRangeRef.current);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const getSelectedFontSize = (editorRef: React.RefObject<HTMLDivElement>): string => {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && editorRef.current) {
        const range = selection.getRangeAt(0);
        let node: Node | null = range.commonAncestorContainer;
        if (node && node.nodeType === Node.TEXT_NODE) {
          node = node.parentElement;
        }
        if (node && node instanceof Element && editorRef.current.contains(node)) {
          const computedSize = window.getComputedStyle(node).fontSize;
          const pxVal = parseInt(computedSize, 10);
          if (!isNaN(pxVal)) {
            return `${pxVal}px`;
          }
        }
      }
    } catch {
      // ignore
    }
    return '';
  };

  const getSelectedColor = (command: 'foreColor' | 'hiliteColor'): string => {
    try {
      const val = document.queryCommandValue(command);
      if (val) {
        const norm = normalizeHex(val);
        if (norm) return norm;
      }
    } catch {
      // ignore
    }
    return '';
  };

  const updateEditorActiveFormats = useCallback(() => {
    try {
      const block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      setEditorActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        h1: block === 'h1' || block.includes('h1'),
        h2: block === 'h2' || block.includes('h2'),
        h3: block === 'h3' || block.includes('h3'),
        p: block === 'p' || block.includes('p'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        alignLeft: document.queryCommandState('justifyLeft'),
        alignCenter: document.queryCommandState('justifyCenter'),
        alignRight: document.queryCommandState('justifyRight'),
        fontSize: getSelectedFontSize(manualEditorRef),
      });
      const fore = getSelectedColor('foreColor');
      if (fore) setManualTextColor(fore);
      const back = getSelectedColor('hiliteColor');
      if (back) setManualHighlightColor(back);
    } catch {
      // ignore
    }
  }, []);

  // Selection-Targeted Heading Formatter with Native Undo/Redo (H1, H2, H3, P)
  const applyCustomHeadingFormat = (
    editorRef: React.RefObject<HTMLDivElement>,
    tagValue: string,
    updateFormatsCallback: () => void
  ) => {
    const rawTag = tagValue.replace(/[<>]/g, '').toLowerCase();
    const selection = window.getSelection();

    if (selection && !selection.isCollapsed && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        const selectedHtml = container.innerHTML || selection.toString();

        let formattedHtml = '';
        if (rawTag === 'h1') {
          formattedHtml = `<span style="font-size: 24px; font-weight: 800; display: inline-block; margin: 4px 0; line-height: 1.2;">${selectedHtml}</span>`;
        } else if (rawTag === 'h2') {
          formattedHtml = `<span style="font-size: 20px; font-weight: 700; display: inline-block; margin: 3px 0; line-height: 1.25;">${selectedHtml}</span>`;
        } else if (rawTag === 'h3') {
          formattedHtml = `<span style="font-size: 16px; font-weight: 700; display: inline-block; margin: 2px 0; line-height: 1.3;">${selectedHtml}</span>`;
        } else if (rawTag === 'p') {
          formattedHtml = `<span style="font-size: 14px; font-weight: normal; display: inline; line-height: 1.5;">${selectedHtml}</span>`;
        }

        // document.execCommand('insertHTML') registers directly into browser's Ctrl+Z Undo stack!
        document.execCommand('insertHTML', false, formattedHtml);
        editorRef.current.focus();
        updateFormatsCallback();
        return;
      }
    }

    // Fallback to standard formatBlock
    document.execCommand('formatBlock', false, tagValue);
    editorRef.current?.focus();
    updateFormatsCallback();
  };

  // Selection-Targeted Font Size Formatter with Native Undo/Redo
  const applyCustomFontSize = (
    editorRef: React.RefObject<HTMLDivElement>,
    sizePx: string,
    updateFormatsCallback: () => void
  ) => {
    if (!sizePx) return;
    const selection = window.getSelection();

    if (selection && !selection.isCollapsed && selection.rangeCount > 0 && editorRef.current) {
      const range = selection.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        const selectedHtml = container.innerHTML || selection.toString();
        const formattedHtml = `<span style="font-size: ${sizePx}; display: inline; line-height: 1.4;">${selectedHtml}</span>`;
        document.execCommand('insertHTML', false, formattedHtml);
        editorRef.current.focus();
        updateFormatsCallback();
        return;
      }
    }
  };

  // Rich Text Editor exec command helper
  const execFormat = (command: string, value?: string) => {
    if (command === 'formatBlock' && value) {
      applyCustomHeadingFormat(manualEditorRef, value, updateEditorActiveFormats);
      return;
    }
    document.execCommand(command, false, value);
    manualEditorRef.current?.focus();
    updateEditorActiveFormats();
  };

  // Campaign Writer Ref & Formatting Tools
  const campaignWriterRef = useRef<HTMLDivElement>(null);
  const [campaignActiveFormats, setCampaignActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    h1: false,
    h2: false,
    h3: false,
    p: false,
    ul: false,
    ol: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    fontSize: '',
  });
  const [isCampaignHighlighterOpen, setIsCampaignHighlighterOpen] = useState(false);
  const [isCampaignColorPickerOpen, setIsCampaignColorPickerOpen] = useState(false);
  const [campaignTextColor, setCampaignTextColor] = useState('#000000');
  const [campaignHighlightColor, setCampaignHighlightColor] = useState('transparent');

  const updateCampaignActiveFormats = useCallback(() => {
    try {
      const block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      setCampaignActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        h1: block === 'h1' || block.includes('h1'),
        h2: block === 'h2' || block.includes('h2'),
        h3: block === 'h3' || block.includes('h3'),
        p: block === 'p' || block.includes('p'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        alignLeft: document.queryCommandState('justifyLeft'),
        alignCenter: document.queryCommandState('justifyCenter'),
        alignRight: document.queryCommandState('justifyRight'),
        fontSize: getSelectedFontSize(campaignWriterRef),
      });
      const fore = getSelectedColor('foreColor');
      if (fore) setCampaignTextColor(fore);
      const back = getSelectedColor('hiliteColor');
      if (back) setCampaignHighlightColor(back);
    } catch {
      // ignore
    }
  }, []);

  // Campaign Content & Template History Management (Debounced Real-Time History Tracking)
  const pushCampaignHistory = useCallback((content: string, templateId?: string | null, immediate = false) => {
    if (debounceCampaignHistoryTimerRef.current) {
      clearTimeout(debounceCampaignHistoryTimerRef.current);
    }
    const applyPush = (newContent: string, newTplId?: string | null) => {
      setCampaignHistory(prev => {
        if (prev.length > 0 && campaignHistoryIndex >= 0 && campaignHistoryIndex < prev.length) {
          const current = prev[campaignHistoryIndex];
          if (current.content === newContent && current.templateId === (newTplId ?? null)) {
            return prev;
          }
        }
        const truncated = prev.slice(0, campaignHistoryIndex + 1);
        const updated = [...truncated, { content: newContent, templateId: newTplId ?? null }];
        return updated.length > 40 ? updated.slice(updated.length - 40) : updated;
      });
      setCampaignHistoryIndex(prev => Math.min(prev + 1, 39));
    };

    if (immediate) {
      applyPush(content, templateId);
    } else {
      debounceCampaignHistoryTimerRef.current = setTimeout(() => {
        applyPush(content, templateId);
      }, 400);
    }
  }, [campaignHistoryIndex]);

  const handleCampaignUndo = useCallback(() => {
    if (debounceCampaignHistoryTimerRef.current) {
      clearTimeout(debounceCampaignHistoryTimerRef.current);
    }
    if (campaignHistoryIndex > 0 && campaignHistory.length > 0) {
      const targetIdx = campaignHistoryIndex - 1;
      const targetState = campaignHistory[targetIdx];
      if (targetState) {
        setCampaignForm(prev => ({
          ...prev,
          content: targetState.content,
          templateId: targetState.templateId !== undefined ? targetState.templateId : prev.templateId
        }));
        if (campaignWriterRef.current) {
          campaignWriterRef.current.innerHTML = targetState.content;
        }
        setCampaignHistoryIndex(targetIdx);
        toast.info("Undo: Restored previous content", { id: 'campaign-undo-toast' });
      }
    } else {
      toast.info("No earlier content changes to undo", { id: 'campaign-undo-toast' });
    }
  }, [campaignHistory, campaignHistoryIndex]);

  const handleCampaignRedo = useCallback(() => {
    if (debounceCampaignHistoryTimerRef.current) {
      clearTimeout(debounceCampaignHistoryTimerRef.current);
    }
    if (campaignHistoryIndex < campaignHistory.length - 1 && campaignHistory.length > 0) {
      const targetIdx = campaignHistoryIndex + 1;
      const targetState = campaignHistory[targetIdx];
      if (targetState) {
        setCampaignForm(prev => ({
          ...prev,
          content: targetState.content,
          templateId: targetState.templateId !== undefined ? targetState.templateId : prev.templateId
        }));
        if (campaignWriterRef.current) {
          campaignWriterRef.current.innerHTML = targetState.content;
        }
        setCampaignHistoryIndex(targetIdx);
        toast.info("Redo: Restored next content change", { id: 'campaign-undo-toast' });
      }
    } else {
      toast.info("No further changes to redo", { id: 'campaign-undo-toast' });
    }
  }, [campaignHistory, campaignHistoryIndex]);

  // Manual / Edit Template Content History Management
  const pushManualTemplateHistory = useCallback((content: string, immediate = false) => {
    if (debounceManualHistoryTimerRef.current) {
      clearTimeout(debounceManualHistoryTimerRef.current);
    }
    const applyPush = (newContent: string) => {
      setManualTemplateHistory(prev => {
        if (prev.length > 0 && manualTemplateHistoryIndex >= 0 && manualTemplateHistoryIndex < prev.length) {
          if (prev[manualTemplateHistoryIndex] === newContent) {
            return prev;
          }
        }
        const truncated = prev.slice(0, manualTemplateHistoryIndex + 1);
        const updated = [...truncated, newContent];
        return updated.length > 40 ? updated.slice(updated.length - 40) : updated;
      });
      setManualTemplateHistoryIndex(prev => Math.min(prev + 1, 39));
    };

    if (immediate) {
      applyPush(content);
    } else {
      debounceManualHistoryTimerRef.current = setTimeout(() => {
        applyPush(content);
      }, 400);
    }
  }, [manualTemplateHistoryIndex]);

  const handleManualTemplateUndo = useCallback(() => {
    if (debounceManualHistoryTimerRef.current) {
      clearTimeout(debounceManualHistoryTimerRef.current);
    }
    if (manualTemplateHistoryIndex > 0 && manualTemplateHistory.length > 0) {
      const targetIdx = manualTemplateHistoryIndex - 1;
      const targetContent = manualTemplateHistory[targetIdx];
      if (typeof targetContent === 'string') {
        setManualTemplateHtml(unscopeTemplateHtml(targetContent));
        if (manualEditorRef.current) {
          manualEditorRef.current.innerHTML = scopeTemplateHtml(targetContent);
        }
        setManualTemplateHistoryIndex(targetIdx);
        toast.info("Undo: Restored previous template content", { id: 'manual-undo-toast' });
      }
    } else {
      toast.info("No earlier content changes to undo", { id: 'manual-undo-toast' });
    }
  }, [manualTemplateHistory, manualTemplateHistoryIndex, scopeTemplateHtml, unscopeTemplateHtml]);

  const handleManualTemplateRedo = useCallback(() => {
    if (debounceManualHistoryTimerRef.current) {
      clearTimeout(debounceManualHistoryTimerRef.current);
    }
    if (manualTemplateHistoryIndex < manualTemplateHistory.length - 1 && manualTemplateHistory.length > 0) {
      const targetIdx = manualTemplateHistoryIndex + 1;
      const targetContent = manualTemplateHistory[targetIdx];
      if (typeof targetContent === 'string') {
        setManualTemplateHtml(unscopeTemplateHtml(targetContent));
        if (manualEditorRef.current) {
          manualEditorRef.current.innerHTML = scopeTemplateHtml(targetContent);
        }
        setManualTemplateHistoryIndex(targetIdx);
        toast.info("Redo: Restored next template content", { id: 'manual-undo-toast' });
      }
    } else {
      toast.info("No further changes to redo", { id: 'manual-undo-toast' });
    }
  }, [manualTemplateHistory, manualTemplateHistoryIndex, scopeTemplateHtml, unscopeTemplateHtml]);

  // Insert image HTML into Manual Template Builder at saved cursor range or end of content
  const handleInsertTemplateImage = useCallback((imageHtml: string) => {
    manualEditorRef.current?.focus();
    restoreSelectionRange();

    let inserted = false;
    try {
      inserted = document.execCommand('insertHTML', false, imageHtml);
    } catch {
      inserted = false;
    }

    if (!inserted && manualEditorRef.current) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && manualEditorRef.current.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const el = document.createElement('div');
        el.innerHTML = imageHtml;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = el.firstChild)) {
          frag.appendChild(node);
        }
        range.insertNode(frag);
      } else {
        manualEditorRef.current.innerHTML += imageHtml;
      }
    }

    if (manualEditorRef.current) {
      const newHtml = manualEditorRef.current.innerHTML || '';
      setManualTemplateHtml(unscopeTemplateHtml(newHtml));
      pushManualTemplateHistory(newHtml, false);
    }
    updateEditorActiveFormats();
  }, [restoreSelectionRange, unscopeTemplateHtml, pushManualTemplateHistory, updateEditorActiveFormats]);

  // Direct clipboard paste support for cut/copied images & screenshots
  const handleTemplateEditorPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    // 1. If an image was previously cut (Ctrl+X) or copied (Ctrl+C) within the editor
    const htmlData = e.clipboardData?.getData('text/html') || '';
    if (copiedTemplateImageHtmlRef.current && (htmlData.includes('<img') || !htmlData)) {
      e.preventDefault();
      document.execCommand('insertHTML', false, copiedTemplateImageHtmlRef.current);
      if (manualEditorRef.current) {
        const newHtml = manualEditorRef.current.innerHTML || '';
        setManualTemplateHtml(unscopeTemplateHtml(newHtml));
        pushManualTemplateHistory(newHtml, false);
      }
      toast.success('Image pasted at cursor position!');
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        toast.info('Uploading pasted image to Cloudinary...', { id: 'paste-img-toast' });
        try {
          const formData = new FormData();
          formData.append('image', file);

          const res = await api.post('/media-assets/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (res.data?.success && res.data?.url) {
            const imgUrl = res.data.url;
            const imgHtml = `<div style="text-align: center; margin: 16px 0;"><img src="${imgUrl}" alt="Pasted Image" style="max-width: 100%; width: 400px; height: auto; border: 0; display: inline-block;" /></div>`;
            handleInsertTemplateImage(imgHtml);
            toast.success('Pasted image uploaded & inserted!', { id: 'paste-img-toast' });
          } else {
            throw new Error(res.data?.error || 'Failed to upload image');
          }
        } catch (err: any) {
          const errMsg = err.response?.data?.error || err.message || 'Failed to upload pasted image';
          toast.error(`Paste upload failed: ${errMsg}`, { id: 'paste-img-toast' });
        }
        return;
      }
    }
  };

  // Track start of dragging an internal element inside the template editor
  const handleTemplateEditorDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      // Determine the container wrapper if the image is wrapped in a dedicated div/p with alignment
      let nodeToMove: HTMLElement = target;
      const parent = target.parentElement;
      if (
        parent &&
        parent !== manualEditorRef.current &&
        (parent.tagName === 'DIV' || parent.tagName === 'P') &&
        parent.children.length === 1
      ) {
        nodeToMove = parent;
      }

      draggedEditorNodeRef.current = nodeToMove;
      e.dataTransfer.setData('application/x-crm-editor-node', 'internal');
      e.dataTransfer.setData('text/html', nodeToMove.outerHTML);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleTemplateEditorDragEnd = () => {
    draggedEditorNodeRef.current = null;
  };

  // Drag and drop image insertion or movement directly on the template editor canvas
  const handleTemplateEditorDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const isInternalMove =
      draggedEditorNodeRef.current !== null ||
      e.dataTransfer.getData('application/x-crm-editor-node') === 'internal';

    // SCENARIO 1: Internal re-positioning of an existing image (MOVE - NO DUPLICATION)
    if (isInternalMove && draggedEditorNodeRef.current) {
      e.preventDefault();
      const sourceNode = draggedEditorNodeRef.current;
      const previousParent = sourceNode.parentElement;

      // Locate target insertion range at drop point
      let range: Range | null = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }

      // Check if dropped inside the editor and not on itself
      if (range && manualEditorRef.current && manualEditorRef.current.contains(range.commonAncestorContainer)) {
        // Prevent dropping inside itself
        if (!sourceNode.contains(range.commonAncestorContainer)) {
          // Atomically insert the existing node at the drop point
          // insertNode automatically detaches sourceNode from its previous position!
          range.insertNode(sourceNode);

          // Clean up empty previous container if left behind
          if (
            previousParent &&
            previousParent !== manualEditorRef.current &&
            previousParent.parentNode &&
            (!previousParent.innerText.trim() && !previousParent.querySelector('img'))
          ) {
            previousParent.remove();
          }

          // Select the moved image so resize handles align immediately
          const movedImg = sourceNode.tagName === 'IMG' ? sourceNode : sourceNode.querySelector('img');
          if (movedImg) {
            setSelectedEditorImage(movedImg as HTMLImageElement);
          }
        }
      } else if (manualEditorRef.current) {
        // Fallback: append to end if range could not be resolved
        manualEditorRef.current.appendChild(sourceNode);
        if (
          previousParent &&
          previousParent !== manualEditorRef.current &&
          previousParent.parentNode &&
          (!previousParent.innerText.trim() && !previousParent.querySelector('img'))
        ) {
          previousParent.remove();
        }
      }

      draggedEditorNodeRef.current = null;

      if (manualEditorRef.current) {
        const newHtml = manualEditorRef.current.innerHTML || '';
        setManualTemplateHtml(unscopeTemplateHtml(newHtml));
        pushManualTemplateHistory(newHtml, false);
      }
      toast.success("Image moved to new position!", { id: "move-img-toast" });
      updateEditorActiveFormats();
      return;
    }

    // SCENARIO 2: External image insertion (from Media & Image Assets modal or clipboard)
    const htmlData = e.dataTransfer.getData('text/html');
    const textData = e.dataTransfer.getData('text/plain');

    if (htmlData || (textData && /^https?:\/\//i.test(textData.trim()))) {
      e.preventDefault();

      const imageHtmlToInsert =
        htmlData ||
        `<div style="text-align: center; margin: 16px 0;"><img src="${textData.trim()}" alt="Dropped Graphic" style="max-width: 100%; width: 320px; height: auto; border: 0; display: inline-block;" /></div>`;

      manualEditorRef.current?.focus();

      let range: Range | null = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if ((document as any).caretPositionFromPoint) {
        const pos = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      }

      const sel = window.getSelection();
      if (range && sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      let inserted = false;
      try {
        inserted = document.execCommand('insertHTML', false, imageHtmlToInsert);
      } catch {
        inserted = false;
      }

      if (!inserted && manualEditorRef.current) {
        if (range && manualEditorRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          const el = document.createElement('div');
          el.innerHTML = imageHtmlToInsert;
          const frag = document.createDocumentFragment();
          let node;
          while ((node = el.firstChild)) {
            frag.appendChild(node);
          }
          range.insertNode(frag);
        } else {
          manualEditorRef.current.innerHTML += imageHtmlToInsert;
        }
      }

      if (manualEditorRef.current) {
        const newHtml = manualEditorRef.current.innerHTML || '';
        setManualTemplateHtml(unscopeTemplateHtml(newHtml));
        pushManualTemplateHistory(newHtml, false);
        setTimeout(() => {
          if (manualEditorRef.current) {
            const imgs = manualEditorRef.current.querySelectorAll('img');
            if (imgs.length > 0) {
              setSelectedEditorImage(imgs[imgs.length - 1] as HTMLImageElement);
            }
          }
        }, 60);
      }
      setIsTemplateImageModalOpen(false);
      toast.success("Image dropped into template!", { id: "drop-img-toast" });
      updateEditorActiveFormats();
    }
  };

  // Canva Image Resizer: Recalculate overlay bounding rectangle relative to editor viewport
  const updateSelectedImageRect = useCallback(() => {
    if (!selectedEditorImage) {
      setImageOverlayRect(null);
      return;
    }
    if (!selectedEditorImage.isConnected) {
      setSelectedEditorImage(null);
      setImageOverlayRect(null);
      return;
    }
    const containerEl = editorViewportRef.current;
    if (!containerEl) {
      setImageOverlayRect(null);
      return;
    }

    const containerRect = containerEl.getBoundingClientRect();
    const imgRect = selectedEditorImage.getBoundingClientRect();

    if (imgRect.width === 0 || imgRect.height === 0) {
      setImageOverlayRect(null);
      return;
    }

    // Hide if image is completely scrolled outside visible viewport of container
    if (imgRect.bottom <= containerRect.top || imgRect.top >= containerRect.bottom) {
      setImageOverlayRect(null);
      return;
    }

    setImageOverlayRect({
      top: imgRect.top - containerRect.top,
      left: imgRect.left - containerRect.left,
      width: imgRect.width,
      height: imgRect.height,
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
    });
  }, [selectedEditorImage]);

  // Click on image inside manual editor to select it
  const handleManualEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      e.stopPropagation();
      setSelectedEditorImage(target as HTMLImageElement);
    } else if (!target.closest('.canva-image-resizer-overlay')) {
      setSelectedEditorImage(null);
    }
  };

  // Image Resize Presets (Canva-style)
  const handleResizeImagePreset = (size: number | '100%') => {
    if (!selectedEditorImage) return;
    if (size === '100%') {
      selectedEditorImage.style.width = '100%';
      selectedEditorImage.style.maxWidth = '100%';
    } else {
      selectedEditorImage.style.width = `${size}px`;
      selectedEditorImage.style.maxWidth = '100%';
    }
    selectedEditorImage.style.height = 'auto';

    if (manualEditorRef.current) {
      const newHtml = manualEditorRef.current.innerHTML || '';
      setManualTemplateHtml(unscopeTemplateHtml(newHtml));
      pushManualTemplateHistory(newHtml, false);
    }
    setTimeout(updateSelectedImageRect, 30);
  };

  // Image Alignment (Left, Center, Right)
  const handleAlignSelectedImage = (align: 'left' | 'center' | 'right') => {
    if (!selectedEditorImage) return;
    const parent = selectedEditorImage.parentElement;
    if (parent && parent !== manualEditorRef.current && (parent.tagName === 'DIV' || parent.tagName === 'P')) {
      parent.style.textAlign = align;
    } else {
      const wrapper = document.createElement('div');
      wrapper.style.textAlign = align;
      wrapper.style.margin = '16px 0';
      selectedEditorImage.parentNode?.insertBefore(wrapper, selectedEditorImage);
      wrapper.appendChild(selectedEditorImage);
    }

    if (manualEditorRef.current) {
      const newHtml = manualEditorRef.current.innerHTML || '';
      setManualTemplateHtml(unscopeTemplateHtml(newHtml));
      pushManualTemplateHistory(newHtml, false);
    }
    setTimeout(updateSelectedImageRect, 30);
  };

  // Helper to get HTML representation of the selected image or its alignment wrapper
  const getSelectedImageHtml = useCallback(() => {
    if (!selectedEditorImage) return null;
    let nodeToCopy: HTMLElement = selectedEditorImage;
    const parent = selectedEditorImage.parentElement;
    if (
      parent &&
      parent !== manualEditorRef.current &&
      (parent.tagName === 'DIV' || parent.tagName === 'P') &&
      parent.children.length === 1 &&
      !parent.innerText.trim()
    ) {
      nodeToCopy = parent;
    }
    return {
      html: nodeToCopy.outerHTML,
      node: nodeToCopy,
    };
  }, [selectedEditorImage]);

  // Copy selected image (Ctrl+C)
  const handleCopySelectedImage = useCallback(() => {
    const data = getSelectedImageHtml();
    if (!data) return;

    copiedTemplateImageHtmlRef.current = data.html;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([data.html], { type: 'text/html' });
        const blobText = new Blob([selectedEditorImage?.src || data.html], { type: 'text/plain' });
        navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText,
          }),
        ]).catch(() => {
          navigator.clipboard?.writeText?.(data.html);
        });
      } else if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(data.html);
      }
    } catch {
      // Handled via copiedTemplateImageHtmlRef fallback
    }

    toast.info('Image copied! Click where you want it and press Ctrl+V to paste.', { id: 'img-cut-copy-toast' });
  }, [getSelectedImageHtml, selectedEditorImage]);

  // Cut selected image (Ctrl+X)
  const handleCutSelectedImage = useCallback(() => {
    const data = getSelectedImageHtml();
    if (!data || !selectedEditorImage) return;

    // 1. Copy to clipboard & ref
    copiedTemplateImageHtmlRef.current = data.html;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([data.html], { type: 'text/html' });
        const blobText = new Blob([selectedEditorImage.src || data.html], { type: 'text/plain' });
        navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText,
          }),
        ]).catch(() => {
          navigator.clipboard?.writeText?.(data.html);
        });
      } else if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(data.html);
      }
    } catch {
      // Handled via copiedTemplateImageHtmlRef fallback
    }

    // 2. Remove node from DOM
    data.node.remove();
    setSelectedEditorImage(null);
    setImageOverlayRect(null);

    // 3. Update template state & history
    if (manualEditorRef.current) {
      const newHtml = manualEditorRef.current.innerHTML || '';
      setManualTemplateHtml(unscopeTemplateHtml(newHtml));
      pushManualTemplateHistory(newHtml, false);
    }

    toast.info('Image cut! Click where you want it in the template and press Ctrl+V to paste.', { id: 'img-cut-copy-toast' });
  }, [getSelectedImageHtml, selectedEditorImage, unscopeTemplateHtml, pushManualTemplateHistory]);

  // Helper to determine current active shape of selectedEditorImage
  const getCurrentImageShape = useCallback(() => {
    if (!selectedEditorImage) return 'rectangle';
    const br = selectedEditorImage.style.borderRadius;
    if (br === '50%') return 'circle';
    if (br === '9999px') return 'pill';
    if (br === '28%') return 'squircle';
    if (br === '16px') return 'rounded-lg';
    if (br === '8px') return 'rounded-sm';
    return 'rectangle';
  }, [selectedEditorImage]);

  // Apply Canva shape directly to selected image
  const handleApplyImageShape = useCallback((shape: 'rectangle' | 'rounded-sm' | 'rounded-lg' | 'squircle' | 'circle' | 'pill') => {
    if (!selectedEditorImage) return;

    switch (shape) {
      case 'rectangle':
        selectedEditorImage.style.borderRadius = '0px';
        selectedEditorImage.style.aspectRatio = '';
        selectedEditorImage.style.objectFit = '';
        break;
      case 'rounded-sm':
        selectedEditorImage.style.borderRadius = '8px';
        selectedEditorImage.style.aspectRatio = '';
        selectedEditorImage.style.objectFit = '';
        break;
      case 'rounded-lg':
        selectedEditorImage.style.borderRadius = '16px';
        selectedEditorImage.style.aspectRatio = '';
        selectedEditorImage.style.objectFit = '';
        break;
      case 'squircle':
        selectedEditorImage.style.borderRadius = '28%';
        selectedEditorImage.style.aspectRatio = '1 / 1';
        selectedEditorImage.style.objectFit = 'cover';
        break;
      case 'circle':
        selectedEditorImage.style.borderRadius = '50%';
        selectedEditorImage.style.aspectRatio = '1 / 1';
        selectedEditorImage.style.objectFit = 'cover';
        break;
      case 'pill':
        selectedEditorImage.style.borderRadius = '9999px';
        selectedEditorImage.style.aspectRatio = '';
        selectedEditorImage.style.objectFit = 'cover';
        break;
    }

    setTimeout(updateSelectedImageRect, 30);

    if (manualEditorRef.current) {
      const newHtml = manualEditorRef.current.innerHTML || '';
      setManualTemplateHtml(unscopeTemplateHtml(newHtml));
      pushManualTemplateHistory(newHtml, false);
    }

    setIsImageShapePickerOpen(false);
    toast.success(`Shape updated!`);
  }, [selectedEditorImage, updateSelectedImageRect, unscopeTemplateHtml, pushManualTemplateHistory]);

  // Delete selected image
  const handleDeleteSelectedImage = useCallback(() => {
    if (!selectedEditorImage) return;
    const parent = selectedEditorImage.parentElement;
    selectedEditorImage.remove();
    if (parent && parent !== manualEditorRef.current && (!parent.innerText.trim() && !parent.querySelector('img'))) {
      parent.remove();
    }
    setSelectedEditorImage(null);
    setImageOverlayRect(null);
    setIsImageShapePickerOpen(false);

    if (manualEditorRef.current) {
      const newHtml = manualEditorRef.current.innerHTML || '';
      setManualTemplateHtml(unscopeTemplateHtml(newHtml));
      pushManualTemplateHistory(newHtml, false);
    }
    toast.success('Image removed from template');
  }, [selectedEditorImage, unscopeTemplateHtml, pushManualTemplateHistory]);

  // Drag-to-resize handles
  const handleStartDragResize = (handle: 'nw' | 'ne' | 'se' | 'sw' | 'e' | 'w', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedEditorImage) return;

    const startX = e.clientX;
    const startWidth = selectedEditorImage.getBoundingClientRect().width;
    const editorWidth = manualEditorRef.current?.getBoundingClientRect().width || 800;
    const maxWidth = Math.max(100, editorWidth - 40);

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth;

      if (handle === 'se' || handle === 'ne' || handle === 'e') {
        newWidth = startWidth + deltaX;
      } else if (handle === 'sw' || handle === 'nw' || handle === 'w') {
        newWidth = startWidth - deltaX;
      }

      const clampedWidth = Math.max(40, Math.min(maxWidth, Math.round(newWidth)));
      selectedEditorImage.style.width = `${clampedWidth}px`;
      selectedEditorImage.style.maxWidth = '100%';
      selectedEditorImage.style.height = 'auto';

      updateSelectedImageRect();
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (manualEditorRef.current) {
        const newHtml = manualEditorRef.current.innerHTML || '';
        setManualTemplateHtml(unscopeTemplateHtml(newHtml));
        pushManualTemplateHistory(newHtml, false);
      }
      updateSelectedImageRect();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Sync overlay position on selected image change, window resize, or editor scroll
  useEffect(() => {
    if (!selectedEditorImage) {
      setImageOverlayRect(null);
      setIsImageShapePickerOpen(false);
      return;
    }

    updateSelectedImageRect();

    const handleScrollOrResize = () => {
      updateSelectedImageRect();
    };

    const editorEl = manualEditorRef.current;
    if (editorEl) {
      editorEl.addEventListener('scroll', handleScrollOrResize, { passive: true });
    }
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    // Click outside to deselect
    const handleDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        !target.closest('.canva-image-resizer-overlay') &&
        target !== selectedEditorImage
      ) {
        setSelectedEditorImage(null);
        setIsImageShapePickerOpen(false);
      }
    };

    // Keyboard delete / escape / cut (Ctrl+X) / copy (Ctrl+C)
    const handleDocKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') {
        setSelectedEditorImage(null);
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'x') {
        const target = e.target as HTMLElement;
        const isInputField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target.isContentEditable && target !== manualEditorRef.current));
        if (!isInputField && selectedEditorImage) {
          e.preventDefault();
          e.stopPropagation();
          handleCutSelectedImage();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === 'c') {
        const target = e.target as HTMLElement;
        const isInputField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target.isContentEditable && target !== manualEditorRef.current));
        if (!isInputField && selectedEditorImage) {
          e.preventDefault();
          e.stopPropagation();
          handleCopySelectedImage();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        const isInputField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target.isContentEditable && target !== manualEditorRef.current));
        if (!isInputField && selectedEditorImage) {
          e.preventDefault();
          handleDeleteSelectedImage();
        }
      }
    };

    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleDocKeyDown);

    return () => {
      if (editorEl) {
        editorEl.removeEventListener('scroll', handleScrollOrResize);
      }
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleDocKeyDown);
    };
  }, [selectedEditorImage, updateSelectedImageRect, handleDeleteSelectedImage, handleCutSelectedImage, handleCopySelectedImage]);

  // Global Keyboard Listener for Undo (Ctrl+Z / Cmd+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    if (!isCampaignModalOpen && !isManualTemplateModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && target.getAttribute('type') === 'text') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          if (isCampaignModalOpen) handleCampaignRedo();
          else if (isManualTemplateModalOpen) handleManualTemplateRedo();
        } else {
          if (isCampaignModalOpen) handleCampaignUndo();
          else if (isManualTemplateModalOpen) handleManualTemplateUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        if (isCampaignModalOpen) handleCampaignRedo();
        else if (isManualTemplateModalOpen) handleManualTemplateRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCampaignModalOpen, isManualTemplateModalOpen, handleCampaignUndo, handleCampaignRedo, handleManualTemplateUndo, handleManualTemplateRedo]);

  const execCampaignFormat = (command: string, value?: string) => {
    if (command === 'undo') {
      handleCampaignUndo();
      return;
    }
    if (command === 'redo') {
      handleCampaignRedo();
      return;
    }
    if (command === 'formatBlock' && value) {
      applyCustomHeadingFormat(campaignWriterRef, value, updateCampaignActiveFormats);
      return;
    }
    document.execCommand(command, false, value);
    campaignWriterRef.current?.focus();
    updateCampaignActiveFormats();
  };

  const updateAiEditorActiveFormats = useCallback(() => {
    try {
      const block = (document.queryCommandValue('formatBlock') || '').toLowerCase();
      setAiEditorActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        h1: block === 'h1' || block.includes('h1'),
        h2: block === 'h2' || block.includes('h2'),
        h3: block === 'h3' || block.includes('h3'),
        p: block === 'p' || block.includes('p'),
        ul: document.queryCommandState('insertUnorderedList'),
        ol: document.queryCommandState('insertOrderedList'),
        alignLeft: document.queryCommandState('justifyLeft'),
        alignCenter: document.queryCommandState('justifyCenter'),
        alignRight: document.queryCommandState('justifyRight'),
        fontSize: getSelectedFontSize(aiTemplateEditorRef),
      });
      const fore = getSelectedColor('foreColor');
      if (fore) setAiTextColor(fore);
      const back = getSelectedColor('hiliteColor');
      if (back) setAiHighlightColor(back);
    } catch {
      // ignore
    }
  }, []);

  const execAiEditorFormat = (command: string, value?: string) => {
    if (command === 'formatBlock' && value) {
      applyCustomHeadingFormat(aiTemplateEditorRef, value, updateAiEditorActiveFormats);
      return;
    }
    document.execCommand(command, false, value);
    aiTemplateEditorRef.current?.focus();
    updateAiEditorActiveFormats();
  };

  // Sync Campaign Writer Ref on Mode Switch or Template Injection
  useEffect(() => {
    if (isCampaignModalOpen && campaignEditorMode === 'editor' && campaignWriterRef.current) {
      if (campaignWriterRef.current.innerHTML !== campaignForm.content) {
        campaignWriterRef.current.innerHTML = campaignForm.content || '';
      }
    }
  }, [isCampaignModalOpen, campaignEditorMode]);

  // Inject Database Template into Campaign Form
  const injectDbTemplate = (tpl: DbTemplate) => {
    setCampaignForm(prev => ({
      ...prev,
      subject: tpl.subject,
      content: tpl.content,
      templateId: tpl._id
    }));
    setCampaignEditorMode('preview');
    toast.success(`Template "${tpl.name}" applied!`);
    setIsCampaignModalOpen(true);
  };

  // Direct Open Template Inspector / Preview Modal
  const handleOpenTemplateDirectly = async (tplRef: any) => {
    if (!tplRef) return;
    setIsViewStatsOpen(false);

    if (typeof tplRef === 'object' && tplRef.content) {
      setSelectedTemplateForPreview(tplRef);
      setTemplatePreviewMode('visual');
      setIsTemplatePreviewModalOpen(true);
      return;
    }

    const tplId = typeof tplRef === 'object' ? tplRef._id : tplRef;
    const found = templates.find(t => t._id === tplId);
    if (found) {
      setSelectedTemplateForPreview(found);
      setTemplatePreviewMode('visual');
      setIsTemplatePreviewModalOpen(true);
      return;
    }

    try {
      const res = await api.get(`/templates/${tplId}`);
      if (res.data) {
        setSelectedTemplateForPreview(res.data);
        setTemplatePreviewMode('visual');
        setIsTemplatePreviewModalOpen(true);
      }
    } catch {
      toast.error('Could not load template details.');
    }
  };

  // Confirm and Execute Campaign Deletion
  const handleConfirmDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    setDeletingCampaign(true);
    try {
      await api.delete(`/emails/campaigns/${campaignToDelete._id}`);
      setCampaigns(prev => prev.filter(c => c._id !== campaignToDelete._id));
      fetchCampaigns(true);
      toast.success(`Campaign "${campaignToDelete.title}" deleted successfully.`);
      setIsDeleteCampaignModalOpen(false);
      if (selectedCampaign?._id === campaignToDelete._id) {
        setIsViewStatsOpen(false);
        setSelectedCampaign(null);
      }
      setCampaignToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete campaign.');
    } finally {
      setDeletingCampaign(false);
    }
  };

  const prevTabRef = useRef(activeTab);
  const prevWorkspaceRef = useRef(workspace);

  // SWR Pattern: On workspace switch or initial entry, revalidate the active workspace in background
  useEffect(() => {
    if (workspace === "campaigns") {
      loadInitialMarketingData();
    } else {
      fetchConversations();
    }
    prevWorkspaceRef.current = workspace;
  }, [workspace, loadInitialMarketingData, fetchConversations]);

  // SWR Pattern: On explicit tab switch within marketing workspace, silently refresh that specific tab
  useEffect(() => {
    if (workspace === "campaigns" && prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      if (activeTab === "campaigns") {
        fetchCampaigns(true);
      } else if (activeTab === "segments") {
        fetchSegments(true);
      } else if (activeTab === "templates") {
        fetchTemplates(true);
      }
    } else {
      prevTabRef.current = activeTab;
    }
  }, [workspace, activeTab, fetchCampaigns, fetchSegments, fetchTemplates]);

  // Sync selected campaign analytics modal state with campaigns array
  useEffect(() => {
    if (selectedCampaign) {
      const updated = campaigns.find(c => c._id === selectedCampaign._id);
      if (updated) {
        setSelectedCampaign(updated);
      }
    }
  }, [campaigns, selectedCampaign]);

  // Auto-poll campaign status/statistics when dispatching or when stats inspector is open
  useEffect(() => {
    const hasSendingCampaign = campaigns.some(c => c.status === "sending");
    const shouldPoll = hasSendingCampaign || isViewStatsOpen;
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      fetchCampaigns(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns, fetchCampaigns, isViewStatsOpen]);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatBottomAnchorRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto') => {
    if (chatBottomAnchorRef.current) {
      chatBottomAnchorRef.current.scrollIntoView({ behavior, block: 'end' });
    } else if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchHistory(selectedConversation._id);
    }
  }, [selectedConversation, fetchHistory]);

  // Robust multi-phase auto-scroll to the latest message whenever entering inbox, switching contact, or loading history
  useEffect(() => {
    if (workspace === "inbox" && selectedConversation) {
      scrollToBottom('auto');
      const t1 = setTimeout(() => scrollToBottom('auto'), 50);
      const t2 = setTimeout(() => scrollToBottom('auto'), 150);
      const t3 = setTimeout(() => scrollToBottom('smooth'), 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [workspace, selectedConversation?._id, emailHistory.length, loadingHistory, scrollToBottom]);

  // --- MODAL STATE RESET FUNCTIONS (Wipes uncommitted draft state on close/cancel) ---
  const resetCampaignModalState = useCallback(() => {
    setCampaignForm({
      title: "",
      subject: "",
      content: "",
      segmentId: "",
      segmentIds: [],
      sendAt: "",
      isScheduled: false,
      templateId: null
    });
    setCampaignSegmentSearchQuery("");
    setIsSegmentDropdownOpen(false);
    setCampaignEditorMode('preview');
    setAiPrompt('');
    setShowCampaignAiPanel(false);
    setCampaignHistory([]);
    setCampaignHistoryIndex(-1);
    if (debounceCampaignHistoryTimerRef.current) {
      clearTimeout(debounceCampaignHistoryTimerRef.current);
    }
    if (campaignWriterRef.current) {
      campaignWriterRef.current.innerHTML = '';
    }
  }, []);

  const resetAiTemplateModalState = useCallback(() => {
    setTemplateNameInput('');
    setTemplateSubjectInput('');
    setAiPromptInput('');
    setAiCategoryInput('General');
    setAiToneInput('Professional & Warm');
    setAiDraftTemplate(null);
    setPreviewTab('visual');
    if (aiTemplateEditorRef.current) {
      aiTemplateEditorRef.current.innerHTML = '';
    }
  }, []);

  const resetManualTemplateModalState = useCallback(() => {
    setEditingTemplateId(null);
    setManualTemplateName('');
    setManualTemplateSubject('');
    setManualTemplateCategory('General');
    setManualTemplateHtml('');
    setManualTemplateMode('editor');
    setManualTemplateHistory([]);
    setManualTemplateHistoryIndex(-1);
    setIsTemplateImageModalOpen(false);
    setSelectedEditorImage(null);
    setImageOverlayRect(null);
    if (debounceManualHistoryTimerRef.current) {
      clearTimeout(debounceManualHistoryTimerRef.current);
    }
    if (manualEditorRef.current) {
      manualEditorRef.current.innerHTML = '';
    }
  }, []);

  const resetSegmentModalState = useCallback(() => {
    setSegmentForm({
      name: "",
      description: "",
      type: "csv",
      filters: {
        source: "",
        sport: "",
        location: "",
        status: "",
        campaignId: "",
        campaignIds: []
      },
      leadIds: [],
      leadModel: "Lead",
      customContacts: []
    });
    setContactCategoryFilter("all");
    setContactsSearchQuery("");
    setSalesCampaignSearch("");
    setCustomContactName("");
    setCustomContactEmail("");
    setCsvParsedContacts([]);
    setCsvFileName("");
    setCsvSearchQuery("");
    setCsvSelectedEmails([]);
    setCampaignPreviewContacts([]);
    setCampaignPreviewSearch("");
    setCampaignSelectedIds([]);
    setEditingSegmentId(null);
    setExistingSegmentContacts([]);
    setExistingSelectedEmails([]);
    setExistingContactsSearch("");
    setSegmentTab("csv");
    setCustomContactsSearch("");
    setSelectedMarketingIds([]);
    setMarketingSearchQuery("");
    setMarketingChannelFilter("all");
    loadedCampaignIdsRef.current = "";
  }, []);

  const resetImportModalState = useCallback(() => {
    setImportFile(null);
    setImportSegmentName("");
    setImportCsvParsedContacts([]);
    setImportCsvSelectedEmails([]);
    setImportCsvSearchQuery("");
  }, []);

  // Helper to get minimum local ISO datetime for scheduling (current time + 1 minute)
  const getMinScheduleDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  // Helper to compute unified recipient funnel KPIs for any campaign
  const getCampaignFunnelStats = (camp: Campaign) => {
    const logs = camp.recipientLogs || [];
    const allCount = logs.length;

    if (allCount > 0) {
      const bounceCount = logs.filter(isLogBounced).length;
      const unsubCount = logs.filter(l => !isLogBounced(l) && (l.status === "unsubscribe" || l.status === "unsubscribed")).length;
      const clickCount = logs.filter(l => !isLogBounced(l) && (l.status === "click" || l.status === "clicked" || l.status === "unsubscribe" || l.status === "unsubscribed")).length;
      const openCount = logs.filter(l => !isLogBounced(l) && (l.status === "open" || l.status === "opened" || l.status === "click" || l.status === "clicked" || l.status === "unsubscribe" || l.status === "unsubscribed")).length;

      const sentCount = allCount;
      const delCount = Math.max(0, sentCount - bounceCount);

      const delRate = sentCount > 0 ? Math.round((delCount / sentCount) * 100) : 0;
      const openRate = delCount > 0 ? Math.round((openCount / delCount) * 100) : 0;
      const clickRate = delCount > 0 ? Math.round((clickCount / delCount) * 100) : 0;

      return {
        sentCount,
        delCount,
        openCount,
        clickCount,
        unsubCount,
        bounceCount,
        delRate,
        openRate,
        clickRate
      };
    }

    // Fallback if no recipientLogs populated yet
    const sentCount = camp.stats?.sent || 0;
    const bounceCount = camp.stats?.bounces || 0;
    const delCount = Math.max(0, (camp.stats?.delivered || sentCount) - bounceCount);
    const openCount = camp.stats?.opens || 0;
    const clickCount = camp.stats?.clicks || 0;
    const unsubCount = camp.stats?.unsubscribes || 0;

    const delRate = sentCount > 0 ? Math.round((delCount / sentCount) * 100) : 0;
    const openRate = delCount > 0 ? Math.round((openCount / delCount) * 100) : 0;
    const clickRate = delCount > 0 ? Math.round((clickCount / delCount) * 100) : 0;

    return {
      sentCount,
      delCount,
      openCount,
      clickCount,
      unsubCount,
      bounceCount,
      delRate,
      openRate,
      clickRate
    };
  };

  // Handle Campaign Creation
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalContent = (campaignEditorMode === 'editor' && campaignWriterRef.current)
      ? (campaignWriterRef.current.innerHTML || campaignForm.content)
      : campaignForm.content;

    const targetSegmentIds = campaignForm.segmentIds && campaignForm.segmentIds.length > 0 
      ? campaignForm.segmentIds 
      : (campaignForm.segmentId ? [campaignForm.segmentId] : []);

    if (!campaignForm.title || !campaignForm.subject || !finalContent || targetSegmentIds.length === 0) {
      toast.error("Please fill in all required fields and select at least one recipient list");
      return;
    }

    if (campaignForm.isScheduled) {
      if (!campaignForm.sendAt) {
        toast.error("Please select a date and time to schedule the campaign");
        return;
      }
      const scheduledTime = new Date(campaignForm.sendAt).getTime();
      if (isNaN(scheduledTime) || scheduledTime <= Date.now()) {
        toast.error("Scheduled time must be in the future. Please choose an upcoming date and time.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. If a reusable template is selected, auto-sync and persist the latest content & subject back to the database template
      if (campaignForm.templateId) {
        try {
          await api.put(`/templates/${campaignForm.templateId}`, {
            subject: campaignForm.subject,
            content: finalContent
          });
          fetchTemplates(true);
        } catch (tplErr) {
          console.warn("Could not auto-sync template changes to database:", tplErr);
        }
      }

      const payload = {
        title: campaignForm.title,
        subject: campaignForm.subject,
        content: finalContent,
        segmentId: targetSegmentIds[0],
        segmentIds: targetSegmentIds,
        sendAt: campaignForm.isScheduled && campaignForm.sendAt ? campaignForm.sendAt : null,
        templateId: campaignForm.templateId
      };

      const res = await api.post("/emails/campaigns", payload);
      toast.success(campaignForm.isScheduled ? "Campaign scheduled!" : "Campaign draft created!");

      if (!campaignForm.isScheduled) {
        await api.post(`/emails/campaigns/${res.data._id}/send`);
        toast.success("Campaign sent & delivered successfully!");
      }

      setIsCampaignModalOpen(false);
      resetCampaignModalState();
      fetchCampaigns(true);
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
    if (!segmentForm.name.trim()) {
      toast.error("Segment name is required");
      return;
    }

    // 1. Retained Existing contacts (when editing)
    const retainedExistingContacts = editingSegmentId
      ? existingSegmentContacts
        .filter(c => existingSelectedEmails.includes(c.email))
        .map(c => ({ name: c.name, email: c.email, status: c.status || "active" }))
      : [];

    // 2. Newly selected CSV contacts
    const selectedCsvContacts = csvParsedContacts
      .filter(c => csvSelectedEmails.includes(c.email))
      .map(c => ({ name: c.name, email: c.email, status: "active" }));

    // 3. Selected Manual CRM/EA/Team contacts
    const selectedCRMContacts = segmentForm.leadIds.map(id => {
      const found = availableContacts.find(c => c._id === id);
      return found ? { name: found.name, email: found.email, status: "active" } : null;
    }).filter(Boolean) as { name: string; email: string; status: string }[];

    // 4. Custom contacts
    const selectedCustomContacts = segmentForm.customContacts.map(c => ({
      name: c.name,
      email: c.email,
      status: "active"
    }));

    // 5. Selected Sales Campaign contacts
    const selectedCampaignContacts = campaignPreviewContacts
      .filter((c: any) => campaignSelectedIds.includes(c.leadId || c.email))
      .map((c: any) => ({ name: c.name, email: c.email, status: "active" }));

    // 6. Selected Marketing List contacts (Active Subscribed Only)
    const selectedMarketingContacts = marketingListContacts
      .filter(c => selectedMarketingIds.includes(c._id))
      .map(c => ({ name: c.name, email: c.email, status: "active" }));

    let contacts = [
      ...retainedExistingContacts,
      ...selectedCsvContacts,
      ...selectedCRMContacts,
      ...selectedCustomContacts,
      ...selectedCampaignContacts,
      ...selectedMarketingContacts
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

    if (contacts.length === 0) {
      toast.error("Please retain or add at least 1 contact to save this list");
      return;
    }

    const activeCampaignIds = segmentForm.filters.campaignIds && segmentForm.filters.campaignIds.length > 0
      ? segmentForm.filters.campaignIds
      : (segmentForm.filters.campaignId ? [segmentForm.filters.campaignId] : []);

    let finalType = segmentForm.type;
    if (editingSegmentId) {
      finalType = segmentForm.type;
    } else if (selectedCsvContacts.length > 0 && selectedCRMContacts.length === 0 && selectedCustomContacts.length === 0 && selectedCampaignContacts.length === 0 && selectedMarketingContacts.length === 0) {
      finalType = "csv";
    } else if (selectedCampaignContacts.length > 0 && selectedCsvContacts.length === 0 && selectedCRMContacts.length === 0 && selectedCustomContacts.length === 0 && selectedMarketingContacts.length === 0) {
      finalType = "campaign";
    } else if (selectedMarketingContacts.length > 0 && selectedCsvContacts.length === 0 && selectedCRMContacts.length === 0 && selectedCustomContacts.length === 0 && selectedCampaignContacts.length === 0) {
      finalType = "marketing";
    } else {
      finalType = "static";
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: segmentForm.name.trim(),
        description: segmentForm.description,
        type: finalType,
        filters: finalType === "campaign" ? { campaignId: activeCampaignIds[0] || "", campaignIds: activeCampaignIds } : undefined,
        contacts: contacts
      };

      if (editingSegmentId) {
        const res = await api.put(`/emails/segments/${editingSegmentId}`, payload);
        toast.success("Segment updated successfully!");
        if (selectedSegmentForView?._id === editingSegmentId && res.data?.segment) {
          setSelectedSegmentForView(res.data.segment);
        }
      } else {
        await api.post("/emails/segments", payload);
        toast.success("Segment created successfully!");
      }

      setIsSegmentModalOpen(false);
      resetSegmentModalState();
      setCsvSelectedEmails([]);
      setCampaignSelectedIds([]);
      fetchSegments(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to save segment");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle CSV Contact Import
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importSegmentName.trim()) {
      toast.error("Please enter a list name");
      return;
    }

    const selectedContacts = importCsvParsedContacts
      .filter(c => importCsvSelectedEmails.includes(c.email))
      .map(c => ({ name: c.name, email: c.email, status: "active" }));

    if (selectedContacts.length === 0) {
      toast.error("Please upload a CSV and select at least one contact");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/emails/segments", {
        name: importSegmentName.trim(),
        description: `Imported CSV list (${selectedContacts.length} contacts)`,
        type: "csv",
        contacts: selectedContacts
      });
      toast.success(`Successfully imported ${selectedContacts.length} contacts!`);
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportSegmentName("");
      setImportCsvParsedContacts([]);
      setImportCsvSelectedEmails([]);
      setImportCsvSearchQuery("");
      fetchSegments(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to import CSV list");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prompt Delete Segment Modal
  const handlePromptDeleteSegment = (seg: Segment) => {
    setSegmentToDelete(seg);
    setIsDeleteSegmentModalOpen(true);
  };

  // Confirm and Execute Delete Segment
  const handleConfirmDeleteSegment = async () => {
    if (!segmentToDelete) return;
    try {
      setDeletingSegment(true);
      await api.delete(`/emails/segments/${segmentToDelete._id}`);
      toast.success(`Segment "${segmentToDelete.name}" deleted successfully`);
      setIsDeleteSegmentModalOpen(false);
      setSegmentToDelete(null);
      fetchSegments(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to delete segment");
    } finally {
      setDeletingSegment(false);
    }
  };

  // Open Unified Edit Segment Modal (Pre-populates existing contacts into dedicated panel)
  const handleOpenEditSegment = (seg: Segment) => {
    setEditingSegmentId(seg._id);
    const segType = seg.type === "dynamic" ? "dynamic" : seg.type === "campaign" ? "campaign" : seg.type === "csv" ? "csv" : seg.type === "marketing" ? "marketing" : "static";

    const activeCampId = typeof seg.filters?.campaignId === "object" && seg.filters?.campaignId ? (seg.filters.campaignId as any)._id : (seg.filters?.campaignId as string || "");
    const activeCampIds = (seg.filters as any)?.campaignIds || (activeCampId ? [activeCampId] : []);

    const existingContacts = (seg.contacts || []).map(c => ({
      name: c.name || c.email.split('@')[0],
      email: c.email.toLowerCase().trim(),
      status: c.status || "active"
    }));

    setExistingSegmentContacts(existingContacts);
    setExistingSelectedEmails(existingContacts.map(c => c.email));
    setExistingContactsSearch("");

    // Fresh, clean append states so existing contacts never mix with new inputs
    setSegmentForm({
      name: seg.name || "",
      description: seg.description || "",
      type: segType,
      filters: {
        source: seg.filters?.source || "",
        sport: seg.filters?.sport || "",
        location: seg.filters?.location || "",
        status: seg.filters?.status || "",
        campaignId: activeCampId,
        campaignIds: activeCampIds
      },
      leadIds: [],
      leadModel: "Lead",
      customContacts: []
    });

    setCsvParsedContacts([]);
    setCsvSelectedEmails([]);
    setCsvFileName("");
    setCsvSearchQuery("");
    setContactsSearchQuery("");
    setCustomContactName("");
    setCustomContactEmail("");
    setCampaignSelectedIds([]);
    setSegmentTab("existing"); // Open directly to the dedicated Existing Contacts tab!
    setIsSegmentModalOpen(true);
  };

  // Quick Add Contact directly from inside the View Recipients Modal
  const handleQuickAddContactToViewSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSegmentForView) return;
    if (!quickAddEmail.trim() || !quickAddEmail.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }

    const email = quickAddEmail.trim().toLowerCase();
    const name = quickAddName.trim() || email.split('@')[0];

    // Check if already in list
    if (selectedSegmentForView.contacts?.some(c => c.email.toLowerCase() === email)) {
      toast.warning("This email is already in this list");
      return;
    }

    setIsQuickAdding(true);
    try {
      const res = await api.put(`/emails/segments/${selectedSegmentForView._id}`, {
        newContacts: [{ name, email }]
      });

      if (res.data?.segment) {
        setSelectedSegmentForView(res.data.segment);
        setSegments(prev => prev.map(s => s._id === res.data.segment._id ? res.data.segment : s));
      }

      toast.success(`Added "${email}" to list!`);
      setQuickAddName("");
      setQuickAddEmail("");
      fetchSegments(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to add contact");
    } finally {
      setIsQuickAdding(false);
    }
  };

  // Append CSV directly from inside View Recipients Modal
  const handleAppendCsvToViewSegment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSegmentForView) return;

    setIsAppendingCsv(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post(`/emails/segments/${selectedSegmentForView._id}/append-csv`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data?.segment) {
        setSelectedSegmentForView(res.data.segment);
        setSegments(prev => prev.map(s => s._id === res.data.segment._id ? res.data.segment : s));
      }

      toast.success(res.data?.message || `Successfully appended contacts!`);
      fetchSegments(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to append CSV contacts");
    } finally {
      setIsAppendingCsv(false);
      if (appendCsvFileInputRef.current) {
        appendCsvFileInputRef.current.value = "";
      }
    }
  };

  // Remove Single Contact from View Recipients Modal
  const handleRemoveContactFromViewSegment = async (contactEmail: string) => {
    if (!selectedSegmentForView) return;

    try {
      const res = await api.delete(`/emails/segments/${selectedSegmentForView._id}/contacts/${encodeURIComponent(contactEmail)}`);

      if (res.data?.segment) {
        setSelectedSegmentForView(res.data.segment);
        setSegments(prev => prev.map(s => s._id === res.data.segment._id ? res.data.segment : s));
      } else {
        setSelectedSegmentForView(prev => prev ? {
          ...prev,
          contacts: (prev.contacts || []).filter(c => c.email.toLowerCase() !== contactEmail.toLowerCase())
        } : null);
      }

      toast.success(`Removed ${contactEmail}`);
      fetchSegments(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to remove contact");
    }
  };

  // Open "Add Contact to List" Modal
  const handleOpenAddContactModal = (preselectedSegmentId?: string) => {
    // If opened from a specific list card/row, pre-select it; otherwise default to NO list selected initially ([])
    const defaultIds = preselectedSegmentId ? [preselectedSegmentId] : [];
    setAddContactTargetSegmentIds(defaultIds);
    setIsAddContactListDropdownOpen(false);
    setAddContactListSearch("");
    setAddContactMode("individual");
    setAddContactSingleName("");
    setAddContactSingleEmail("");
    setAddContactSinglePhone("");
    setAddContactSingleSource("");
    setAddContactCrmSelectedIds([]);
    setAddContactCrmSearch("");
    setAddContactCrmCategory("all");
    setAddContactPasteText("");
    setIsAddContactModalOpen(true);
    if (availableContacts.length === 0) {
      fetchAvailableContacts();
    }
  };

  // Submit "Add Contact(s) to List"
  const handleSubmitAddContact = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (addContactTargetSegmentIds.length === 0) {
      toast.error("Please select at least one target list from the dropdown");
      return;
    }

    let contactsToSubmit: { name: string; email: string; phone?: string; source?: string }[] = [];

    if (addContactMode === "individual") {
      if (!addContactSingleEmail.trim() || !addContactSingleEmail.includes("@")) {
        toast.error("Please enter a valid email address");
        return;
      }
      const email = addContactSingleEmail.trim().toLowerCase();
      const name = addContactSingleName.trim() || email.split("@")[0];
      const phone = addContactSinglePhone.trim();
      const source = addContactSingleSource.trim() || "manual";

      contactsToSubmit = [{ name, email, phone, source }];
    } else if (addContactMode === "crm") {
      if (addContactCrmSelectedIds.length === 0) {
        toast.error("Please select at least one contact from the directory");
        return;
      }

      const selectedList = availableContacts.filter(c => addContactCrmSelectedIds.includes(c._id));
      contactsToSubmit = selectedList.map(c => ({
        name: c.name || c.email.split("@")[0],
        email: c.email.toLowerCase().trim(),
        phone: c.phone || "",
        source: c.categoryTag || "CRM"
      }));
    } else if (addContactMode === "paste") {
      if (parsedAddContactPastedContacts.length === 0) {
        toast.error("No valid email addresses found in the pasted text");
        return;
      }
      contactsToSubmit = parsedAddContactPastedContacts.map(c => ({
        name: c.name,
        email: c.email,
        source: "bulk_paste"
      }));
    }

    if (contactsToSubmit.length === 0) {
      toast.error("No valid contacts to add");
      return;
    }

    setIsSubmittingAddContact(true);
    try {
      // Dispatch additions across all selected lists in parallel
      const results = await Promise.allSettled(
        addContactTargetSegmentIds.map(segId =>
          api.post(`/emails/segments/${segId}/contacts`, { contacts: contactsToSubmit })
        )
      );

      let totalAdded = 0;
      let totalSkipped = 0;
      const updatedSegmentsMap = new Map<string, Segment>();

      results.forEach((res, index) => {
        const segId = addContactTargetSegmentIds[index];
        if (res.status === "fulfilled" && res.value.data?.segment) {
          const seg = res.value.data.segment;
          updatedSegmentsMap.set(seg._id, seg);
          totalAdded += res.value.data.addedCount || 0;
          totalSkipped += (res.value.data.alreadyPresentCount || 0) + (res.value.data.skippedOptOutCount || 0);
        } else if (res.status === "rejected") {
          console.error(`Failed to add contacts to segment ${segId}:`, res.reason);
        }
      });

      if (updatedSegmentsMap.size > 0) {
        setSegments(prev => prev.map(s => updatedSegmentsMap.get(s._id) || s));
        if (selectedSegmentForView && updatedSegmentsMap.has(selectedSegmentForView._id)) {
          setSelectedSegmentForView(updatedSegmentsMap.get(selectedSegmentForView._id)!);
        }
      }

      const listCount = updatedSegmentsMap.size;
      let successMsg = `Successfully added contact${contactsToSubmit.length > 1 ? "s" : ""} to ${listCount} list${listCount !== 1 ? "s" : ""}!`;
      if (totalSkipped > 0) {
        successMsg += ` (${totalSkipped} existing/opted-out skipped)`;
      }

      toast.success(successMsg);
      setIsAddContactModalOpen(false);
      fetchSegments(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to add contacts to list(s)");
    } finally {
      setIsSubmittingAddContact(false);
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
      if (workspace === "campaigns" || isCampaignModalOpen) {
        // Capture snapshot before AI modification for Ctrl+Z undo support
        const existingHtml = campaignForm.content || (campaignWriterRef.current ? campaignWriterRef.current.innerHTML : '');
        pushCampaignHistory(existingHtml, campaignForm.subject);

        // Use /templates/ai-generate to preserve exact HTML template styles and formatting
        const res = await api.post("/templates/ai-generate", {
          prompt: aiPrompt.trim(),
          existingContent: existingHtml
        });

        toast.info("Anthropic API key is hit", { description: "Model: Claude Sonnet 4.6" });

        if (!res.data || !res.data.content || typeof res.data.content !== 'string' || !res.data.content.trim()) {
          throw new Error("AI returned invalid content. Your template remains unchanged.");
        }

        const updatedSubject = res.data.subject || campaignForm.subject;
        const updatedContent = res.data.content;

        setCampaignForm(prev => ({
          ...prev,
          subject: updatedSubject,
          content: updatedContent
        }));

        if (campaignWriterRef.current) {
          campaignWriterRef.current.innerHTML = updatedContent;
        }

        // Push new state to history stack
        pushCampaignHistory(updatedContent, updatedSubject);

        const isPreservedTemplate = campaignEditorMode === 'preview' || !!campaignForm.templateId || (existingHtml && existingHtml.includes('<table'));
        toast.success(isPreservedTemplate ? "AI copy generated! Template style & design preserved." : "AI draft generated in campaign editor!");
        setAiPrompt("");
      } else {
        const res = await api.post("/emails/ai-generate-email", {
          leadId: selectedConversation?._id || undefined,
          leadType: selectedConversation?.leadType || "main_lead",
          contactName: selectedConversation?.name || undefined,
          leadName: selectedConversation?.name || undefined,
          recipientName: selectedConversation?.name || undefined,
          userPrompt: aiPrompt.trim()
        });

        toast.info("Anthropic API key is hit", { description: "Model: Claude Sonnet 4.6" });

        setComposeForm(prev => ({
          ...prev,
          subject: res.data.subject || prev.subject,
          body: res.data.body || prev.body
        }));
        toast.success("AI draft generated successfully!");
        setShowComposeAiPanel(false);
        setAiPrompt("");
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || "Failed to generate AI copy";
      toast.error(errorMsg);
      // Template content remains 100% untouched
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
      subject = "Elite Athletic Training & Development Clinic 🔥";
      content = `<h2>Youth Athlete Development & Conditioning</h2>
                 <p>Hi {{name}},</p>
                 <p>Are you looking to take your athletic speed, strength, and agility to the next level this season?</p>
                 <p>At Youth Athlete University, our elite coaching staff works directly with young athletes to develop college-ready athleticism, injury prevention mechanics, and championship discipline.</p>
                 <p>Explore our upcoming seasonal clinics and reserve a spot:</p>
                 <p><a href="https://youthathleteuniversity.org" target="_blank" rel="noopener noreferrer" style="background:#2563eb;color:#ffffff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">View Available Programs &rarr;</a></p>
                 <br/><p>Best regards,<br/>The YAU Coaching Team</p>`;
    }

    setCampaignForm(prev => ({ ...prev, subject, content, templateId: type }));
    toast.success("Template injected!");
  };

  // Helper to switch conversation and cleanly reset composer
  const handleSelectConversation = (conv: EmailConversation) => {
    if (selectedConversation?._id !== conv._id) {
      setComposeForm({ subject: "", body: "" });
      setIsComposeExpanded(false);
      setShowComposeAiPanel(false);
      setAiPrompt("");
    }
    setSelectedConversation(conv);
  };

  const handleResubscribeLead = (conv: EmailConversation) => {
    return resubscribeContact(conv);
  };

  // Send 1-to-1 Email via SendGrid
  const handleSendOneToOneEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation) return;
    if (!composeForm.subject.trim() || !composeForm.body.trim()) {
      toast.error("Subject and message body content are required!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        lead_id: selectedConversation._id,
        leadModel: selectedConversation.leadType === "ea_lead" ? "EALead" : "Lead",
        to: selectedConversation.email,
        subject: composeForm.subject.trim(),
        body: composeForm.body.trim()
      };

      await api.post("/emails/send", payload);
      toast.success("1-to-1 Email sent successfully via SendGrid!");

      // Update UI & history in real-time - clean reset state
      setComposeForm({ subject: "", body: "" });
      setIsComposeExpanded(false);
      setShowComposeAiPanel(false);
      setAiPrompt("");
      fetchHistory(selectedConversation._id);
      fetchConversations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to deliver email through SendGrid.");
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
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.leadName && c.leadName.toLowerCase().includes(q))
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

  const handleAddCustomContact = (e?: React.MouseEvent | React.KeyboardEvent | React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanEmail = customContactEmail.trim();
    if (!cleanEmail) {
      toast.error("Email address is required for custom contacts");
      return;
    }
    if (!cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    const exists = segmentForm.customContacts.some(
      c => c.email.toLowerCase() === cleanEmail.toLowerCase()
    );
    if (exists) {
      toast.error("A contact with this email has already been added");
      return;
    }
    const cleanName = customContactName.trim() || cleanEmail.split("@")[0];
    setSegmentForm(prev => ({
      ...prev,
      customContacts: [
        ...prev.customContacts,
        { name: cleanName, email: cleanEmail }
      ]
    }));
    setCustomContactName("");
    setCustomContactEmail("");
    toast.success(`Added "${cleanName}" to custom contacts!`);
  };

  const handleRemoveCustomContact = (email: string) => {
    setSegmentForm(prev => ({
      ...prev,
      customContacts: prev.customContacts.filter(c => c.email !== email)
    }));
  };

  const getSegmentBadge = (seg: Segment) => {
    if (seg.category === "legacy_cc" || (seg.name && (seg.name.includes("— Legacy CC") || seg.name.includes("Legacy CC")))) {
      return (
        <span className="text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
          📦 Legacy CC
        </span>
      );
    }
    if (seg.category === "afterschool" || seg.category === "school") {
      return (
        <span className="text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
          🏫 After School
        </span>
      );
    }
    if (seg.category === "evening_activities" || seg.category === "location") {
      return (
        <span className="text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">
          📍 Evening Activities
        </span>
      );
    }
    if (seg.category === "mobile_app" || seg.category === "app_members") {
      return (
        <span className="text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
          📱 Mobile App
        </span>
      );
    }
    if (seg.category === "ea_leads") {
      return (
        <span className="text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
          ⚡ EA Leads
        </span>
      );
    }
    if (seg.category === "manual") {
      return (
        <span className="text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          ✍️ Manual CRM
        </span>
      );
    }
    return (
      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border ${seg.type === "csv" ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" :
          seg.type === "campaign" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
            seg.type === "marketing" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
              "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20"
        }`}>
        {seg.type === "csv" ? "CSV Import" : seg.type === "campaign" ? "Sales Campaign" : seg.type === "marketing" ? "Marketing List" : "Static List"}
      </span>
    );
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
                  className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === tab
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${workspace === "campaigns"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Marketing Workspace
            </button>
            <button
              onClick={() => setWorkspace("inbox")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${workspace === "inbox"
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
            {/* Tier 2: Dynamic Contextual Action Bar (Two-Row Architecture: Row 1 = Title & CTAs, Row 2 = Search & Filters) */}
            <div className="bg-card p-3.5 sm:p-4 rounded-2xl border shadow-2xs shrink-0 space-y-3">
              {/* Row 1: Context Header & Primary Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {(() => {
                  const titleText = activeTab === "campaigns" ? "Email Marketing Campaigns" :
                    activeTab === "segments" ? "Recipient Lists & Segments" :
                      "Database Email Templates";
                  const subtitleText = activeTab === "campaigns" ? "Track email dispatches, open rates, click-throughs, and campaign performance." :
                    activeTab === "segments" ? "Target leads with CSV imports, static contact lists, or sales funnels." :
                      "Manage reusable HTML email layouts and generate new templates with Anthropic Claude.";

                  return (
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black tracking-tight text-foreground truncate">
                          {titleText}
                        </h3>
                        {activeTab === "segments" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {segments.length} Lists
                          </span>
                        )}
                        {activeTab === "campaigns" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {campaigns.length} Campaigns
                          </span>
                        )}
                        {activeTab === "templates" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                            {templates.length} Templates
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                        {subtitleText}
                      </p>
                    </div>
                  );
                })()}

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {activeTab === "campaigns" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsAiPersonalizedModalOpen(true)}
                        className="h-9 btn-primary !bg-gradient-to-r !from-purple-600 !via-indigo-600 !to-blue-600 hover:!from-purple-500 hover:!via-indigo-500 hover:!to-blue-500 !text-white flex items-center gap-2 shadow-md shadow-purple-500/25 shrink-0 cursor-pointer rounded-xl text-xs font-bold"
                        title="AI Personalized Campaign"
                      >
                        <Sparkles size={14} className="text-amber-300 shrink-0" />
                        <span>AI Personalized Campaign</span>
                      </button>
                      <button
                        onClick={() => {
                          resetCampaignModalState();
                          setCampaignHistory([{ content: '', templateId: null }]);
                          setCampaignHistoryIndex(0);
                          setIsCampaignModalOpen(true);
                        }}
                        className="h-9 btn-primary flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer rounded-xl text-xs font-bold"
                      >
                        <Plus size={14} /> New Campaign
                      </button>
                    </>
                  )}

                  {activeTab === "segments" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsWebhookGuideOpen(true)}
                        className="btn-secondary h-9 text-xs font-bold flex items-center gap-1.5 rounded-xl shrink-0"
                        title="API Bridge Documentation: Single Webhook Endpoint & JSON Payload"
                      >
                        <Code2 size={14} className="text-primary" /> Webhook API Guide
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddContactModal()}
                        className="h-9 px-3.5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:via-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                        title="Add individual or bulk contacts to any list"
                      >
                        <UserPlus size={14} className="shrink-0" />
                        <span>Add Contact</span>
                      </button>
                      <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="btn-secondary h-9 text-xs font-bold flex items-center gap-1.5 rounded-xl shrink-0"
                      >
                        <Upload size={14} /> Import List (CSV)
                      </button>
                      <button
                        onClick={() => {
                          fetchAvailableContacts();
                          setIsSegmentModalOpen(true);
                        }}
                        className="btn-primary h-9 text-xs font-bold flex items-center gap-1.5 shadow-sm rounded-xl shrink-0"
                      >
                        <Plus size={14} /> Create List & Segment
                      </button>
                    </>
                  )}

                  {activeTab === "templates" && (
                    <>
                      <button
                        onClick={() => {
                          resetManualTemplateModalState();
                          setManualTemplateHistory(['']);
                          setManualTemplateHistoryIndex(0);
                          setIsManualTemplateModalOpen(true);
                        }}
                        className="btn-primary h-9 text-xs font-bold flex items-center gap-1.5 shadow-sm rounded-xl shrink-0"
                      >
                        <Plus size={14} /> Create Template
                      </button>
                      <button
                        onClick={() => setIsAiTemplateModalOpen(true)}
                        className="btn-primary h-9 px-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer border-none shrink-0 rounded-xl"
                        title="Generate Email Template with Anthropic Claude AI"
                      >
                        <Sparkles size={13} className="animate-pulse text-amber-300" /> Generate AI Template
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Row 2: Search Input, Type Filters & View Mode Controls */}
              <div className="pt-2.5 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Search & Type Filters */}
                <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
                  {activeTab === "campaigns" && (
                    <div className="relative flex-1 max-w-xs min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="search-campaigns-input"
                        name="search_campaigns"
                        aria-label="Search marketing campaigns"
                        type="text"
                        placeholder="Search campaigns..."
                        value={campaignsSearchQuery}
                        onChange={e => setCampaignsSearchQuery(e.target.value)}
                        className="h-9 input-field text-xs !pl-9 pr-3 w-full dark:bg-card rounded-xl"
                      />
                    </div>
                  )}

                  {activeTab === "segments" && (
                    <>
                      <div className="relative flex-1 max-w-sm min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          id="search-segments-input"
                          name="search_segments"
                          aria-label="Search lists and segments"
                          type="text"
                          placeholder="Search lists & segments..."
                          value={segmentsSearchQuery}
                          onChange={e => setSegmentsSearchQuery(e.target.value)}
                          className="h-9 input-field text-xs !pl-9 pr-3 w-full dark:bg-card rounded-xl"
                        />
                      </div>

                      <select
                        id="segment-type-filter-select"
                        name="segment_type_filter"
                        aria-label="Filter lists and segments by Type"
                        value={segmentTypeFilter}
                        onChange={e => setSegmentTypeFilter(e.target.value as any)}
                        className="h-9 px-3 text-xs rounded-xl border border-border/80 bg-background dark:bg-card text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer shrink-0"
                        title="Filter lists and segments by Type"
                      >
                        <option value="all">All Types</option>
                        <option value="legacy_cc">📦 Legacy CC Lists</option>
                        <option value="afterschool">🏫 After School</option>
                        <option value="evening_activities">📍 Evening Activities</option>
                        <option value="mobile_app">📱 Mobile App</option>
                        <option value="manual">✍️ Manual CRM</option>
                        <option value="ea_leads">⚡ EA Leads</option>
                        <option value="csv">CSV Import</option>
                        <option value="static">Manual / Static List</option>
                        <option value="campaign">Sales Campaign</option>
                      </select>
                    </>
                  )}

                  {activeTab === "templates" && (
                    <div className="relative flex-1 max-w-xs min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="search-templates-input"
                        name="search_templates"
                        aria-label="Search templates"
                        type="text"
                        placeholder="Search templates..."
                        value={templatesSearchQuery}
                        onChange={e => setTemplatesSearchQuery(e.target.value)}
                        className="h-9 input-field text-xs !pl-9 pr-3 w-full dark:bg-card rounded-xl"
                      />
                    </div>
                  )}
                </div>

                {/* Right: Count Summary & View Mode Switcher */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  {activeTab === "segments" && (
                    <span className="text-[11px] text-muted-foreground font-semibold hidden md:inline-block">
                      Showing {filteredSegments.length} of {segments.length} Lists
                    </span>
                  )}
                  {activeTab === "campaigns" && (
                    <span className="text-[11px] text-muted-foreground font-semibold hidden md:inline-block">
                      Showing {filteredCampaigns.length} Campaigns
                    </span>
                  )}

                  <div className="flex items-center bg-accent/60 dark:bg-accent/20 border border-border/80 p-1 rounded-xl text-xs shrink-0 h-9 w-[150px] gap-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setMarketingViewMode('grid')}
                      className={`flex-1 h-full rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${marketingViewMode === 'grid'
                          ? 'bg-card text-foreground shadow-sm border border-border/50 font-bold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/40 font-medium'
                        }`}
                      title="Cards Grid View"
                    >
                      <LayoutGrid size={13} className={marketingViewMode === 'grid' ? 'text-primary' : 'text-muted-foreground'} />
                      <span>Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarketingViewMode('table')}
                      className={`flex-1 h-full rounded-lg text-xs transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${marketingViewMode === 'table'
                          ? 'bg-card text-foreground shadow-sm border border-border/50 font-bold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-card/40 font-medium'
                        }`}
                      title="Full Data Table View"
                    >
                      <Table size={13} className={marketingViewMode === 'table' ? 'text-primary' : 'text-muted-foreground'} />
                      <span>Table</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {activeTab === "campaigns" && (
                <div className="space-y-6">
                  {loadingCampaigns ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="animate-spin text-primary h-8 w-8" />
                    </div>
                  ) : filteredCampaigns.length === 0 ? (
                    <div className="text-center py-20 border rounded-2xl bg-card">
                      <Inbox size={48} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                      <h3 className="text-base font-bold">
                        {campaigns.length === 0 ? "No Campaigns Sent" : "No Campaigns Match Search"}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                        {campaigns.length === 0
                          ? "Start communicating with your leads by composing your first email marketing campaign!"
                          : "Try clearing your search query to see all email campaigns."
                        }
                      </p>
                    </div>
                  ) : marketingViewMode === 'table' ? (
                    /* FULL DATA TABLE VIEW */
                    <div className="border rounded-2xl overflow-hidden bg-card shadow-xs">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              <th className="p-3.5 pl-5 align-middle">Campaign</th>
                              <th className="p-3.5 align-middle">List & Segment</th>
                              <th className="p-3.5 align-middle">Template</th>
                              <th className="p-3.5 align-middle">Status & Date</th>
                              <th className="p-3.5 align-middle text-center">Delivered</th>
                              <th className="p-3.5 align-middle text-center">Open Rate</th>
                              <th className="p-3.5 align-middle text-center">Click Rate</th>
                              <th className="p-3.5 align-middle text-center w-[160px] whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {filteredCampaigns.map(camp => {
                              const stats = getCampaignFunnelStats(camp);
                              const tplObj = (typeof camp.templateId === 'object' && camp.templateId !== null)
                                ? camp.templateId
                                : templates.find(t => t._id === camp.templateId);

                              return (
                                <tr
                                  key={camp._id}
                                  onClick={() => {
                                    setSelectedCampaign(camp);
                                    setCampaignRecipientSearch("");
                                    setCampaignRecipientFilter("all");
                                    setIsViewStatsOpen(true);
                                  }}
                                  className="hover:bg-accent/30 transition-colors cursor-pointer group"
                                >
                                  <td className="p-3.5 pl-5 max-w-[220px] align-middle">
                                    <span className="font-bold text-foreground block truncate group-hover:text-primary transition-colors">{camp.title}</span>
                                    <span className="text-[11px] text-muted-foreground block truncate mt-0.5">Subject: {camp.subject}</span>
                                  </td>
                                  <td className="p-3.5 align-middle">
                                    {camp.segmentIds && camp.segmentIds.length > 1 ? (
                                      <span
                                        className="font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center gap-1.5 truncate max-w-[180px]"
                                        title={camp.segmentIds.map(s => s.name).join(", ")}
                                      >
                                        <Layers size={11} className="shrink-0 text-primary" />
                                        <span className="truncate">{camp.segmentIds.length} Lists ({camp.segmentIds[0]?.name})</span>
                                      </span>
                                    ) : (
                                      <span
                                        className="font-semibold text-foreground bg-accent/40 px-2.5 py-1 rounded-lg text-[11px] inline-flex items-center truncate max-w-[160px]"
                                        title={camp.segmentId?.name || "None"}
                                      >
                                        {camp.segmentId?.name || "None"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3.5 align-middle">
                                    {tplObj ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenTemplateDirectly(camp.templateId);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/20 transition-all cursor-pointer max-w-[160px] truncate shadow-2xs"
                                        title={tplObj.name || "View template preview"}
                                      >
                                        <FileText size={11} className="shrink-0" />
                                        <span className="truncate">{tplObj.name}</span>
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground italic">Custom</span>
                                    )}
                                  </td>
                                  <td className="p-3.5 align-middle">
                                    <div className="flex flex-col gap-1 justify-center">
                                      <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border w-fit ${camp.status === "sent" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                                        camp.status === "scheduled" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                                          "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                                        }`}>
                                        {camp.status}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {camp.sentAt ? new Date(camp.sentAt).toLocaleDateString() :
                                          camp.sendAt ? `Sched: ${new Date(camp.sendAt).toLocaleDateString()}` : "Draft"}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-center align-middle">
                                    <span className="font-extrabold text-foreground">{stats.delRate}%</span>
                                    <span className="text-[10px] text-muted-foreground block font-medium">({stats.delCount}/{stats.sentCount})</span>
                                  </td>
                                  <td className="p-3.5 text-center align-middle">
                                    <span className="font-extrabold text-primary">{stats.openRate}%</span>
                                    <span className="text-[10px] text-muted-foreground block font-medium">({stats.openCount})</span>
                                  </td>
                                  <td className="p-3.5 text-center align-middle">
                                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{stats.clickRate}%</span>
                                    <span className="text-[10px] text-muted-foreground block font-medium">({stats.clickCount})</span>
                                  </td>
                                  <td className="p-3.5 text-center align-middle whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCampaignToDelete(camp);
                                          setIsDeleteCampaignModalOpen(true);
                                        }}
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                                        title="Delete Campaign"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedCampaign(camp);
                                          setCampaignRecipientSearch("");
                                          setCampaignRecipientFilter("all");
                                          setIsViewStatsOpen(true);
                                        }}
                                        className="h-8 px-3 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                      >
                                        <Eye size={12} /> Analytics
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* CARDS GRID VIEW */
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredCampaigns.map((camp) => {
                        const stats = getCampaignFunnelStats(camp);

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
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border ${camp.status === "sent" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                                    camp.status === "scheduled" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                                      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                                    }`}>
                                    {camp.status}
                                  </span>
                                  {camp.recipientLogs && camp.recipientLogs.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleExportCampaignData(camp);
                                      }}
                                      className="h-6 px-2 bg-secondary hover:bg-secondary/80 text-foreground border rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                      title="Export Campaign Data (CSV)"
                                    >
                                      <Upload size={10} /> Export CSV
                                    </button>
                                  )}
                                </div>
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
                                      <div className="text-xs font-extrabold text-foreground">{stats.delRate}%</div>
                                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Delivered</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-extrabold text-primary">{stats.openRate}%</div>
                                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Open Rate</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{stats.clickRate}%</div>
                                      <div className="text-[9px] text-muted-foreground uppercase font-bold">Click Rate</div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Template Badge & Direct Preview Open */}
                              {(() => {
                                const tplObj = (typeof camp.templateId === 'object' && camp.templateId !== null)
                                  ? camp.templateId
                                  : templates.find(t => t._id === camp.templateId);

                                if (!tplObj) return null;

                                return (
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenTemplateDirectly(camp.templateId);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/20 transition-all cursor-pointer shadow-2xs group/btn"
                                      title="Click to view template preview directly"
                                    >
                                      <FileText size={11} className="text-violet-600 dark:text-violet-400" />
                                      <span className="truncate max-w-[170px]">Template: {tplObj.name}</span>
                                      <Eye size={10} className="group-hover/btn:scale-110 transition-transform" />
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
                              <span className="text-[10px] text-muted-foreground truncate" title={camp.segmentIds && camp.segmentIds.length > 1 ? camp.segmentIds.map(s => s.name).join(", ") : (camp.segmentId?.name || "None")}>
                                List &amp; Segment: <strong className="text-foreground font-bold">
                                  {camp.segmentIds && camp.segmentIds.length > 1
                                    ? `${camp.segmentIds.length} Lists (${camp.segmentIds[0]?.name}, +${camp.segmentIds.length - 1} more)`
                                    : (camp.segmentId?.name || "None")}
                                </strong>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCampaignToDelete(camp);
                                    setIsDeleteCampaignModalOpen(true);
                                  }}
                                  className="h-8 w-8 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                                  title="Delete Campaign"
                                >
                                  <Trash2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCampaign(camp);
                                    setCampaignRecipientSearch("");
                                    setCampaignRecipientFilter("all");
                                    setIsViewStatsOpen(true);
                                  }}
                                  className="h-8 px-3 bg-primary/10 group-hover:bg-primary group-hover:text-white text-primary rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                                >
                                  <Eye size={13} /> Analytics
                                </button>
                              </div>
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
                  ) : filteredSegments.length === 0 ? (
                    <div className="text-center py-20 border rounded-2xl bg-card">
                      <Users size={48} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                      <h3 className="text-base font-bold">
                        {segments.length === 0 ? "No Segments or Lists" : "No Segments Match Filters"}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                        {segments.length === 0
                          ? "Create list & segment filters or upload static mailing lists via CSV files to target your campaigns."
                          : "Try clearing your search query or type filter to see all segments."
                        }
                      </p>
                    </div>
                  ) : marketingViewMode === 'table' ? (
                    /* FULL DATA TABLE VIEW FOR SEGMENTS */
                    <div className="border rounded-2xl overflow-hidden bg-card shadow-xs">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full table-fixed text-left text-xs border-collapse min-w-[760px]">
                          <thead>
                            <tr className="border-b bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              <th className="p-3.5 pl-5 align-middle w-[35%] min-w-[220px]">Segment Name</th>
                              <th className="p-3.5 align-middle w-[15%] min-w-[110px] whitespace-nowrap">Type</th>
                              <th className="p-3.5 align-middle w-[16%] min-w-[120px] whitespace-nowrap">Recipients</th>
                              <th className="p-3.5 align-middle w-[14%] min-w-[110px]">Details</th>
                              <th className="p-3.5 align-middle text-center w-[20%] min-w-[190px] whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {filteredSegments.map(seg => (
                              <tr
                                key={seg._id}
                                onClick={() => {
                                  setSelectedSegmentForView(seg);
                                  setViewSegmentSearchQuery("");
                                  setIsViewSegmentModalOpen(true);
                                }}
                                className="hover:bg-accent/30 transition-colors cursor-pointer group"
                              >
                                <td className="p-3.5 pl-5 align-middle max-w-0 overflow-hidden">
                                  <span className="font-bold text-foreground block truncate group-hover:text-primary transition-colors" title={seg.name}>{seg.name}</span>
                                  {seg.description && (
                                    <span className="text-[11px] text-muted-foreground block truncate mt-0.5" title={seg.description}>{seg.description}</span>
                                  )}
                                </td>
                                <td className="p-3.5 align-middle whitespace-nowrap overflow-hidden">
                                  {getSegmentBadge(seg)}
                                </td>
                                <td className="p-3.5 align-middle whitespace-nowrap overflow-hidden">
                                  <span className="font-bold text-foreground text-xs flex items-center gap-1.5 truncate">
                                    <Users size={12} className="text-primary shrink-0" /> {seg.contacts?.length || 0} Contacts
                                  </span>
                                </td>
                                <td className="p-3.5 align-middle text-muted-foreground text-[11px] max-w-0 overflow-hidden">
                                  {seg.type === "campaign" ? (
                                    <span className="truncate block" title={(typeof seg.filters?.campaignId === "object" && seg.filters?.campaignId?.name) ? seg.filters.campaignId.name : "Sales Leads"}>
                                      Campaign: <strong className="text-foreground">{(typeof seg.filters?.campaignId === "object" && seg.filters?.campaignId?.name) ? seg.filters.campaignId.name : "Sales Leads"}</strong>
                                    </span>
                                  ) : (
                                    <span className="truncate block">Recipient List</span>
                                  )}
                                </td>
                                <td className="p-3.5 align-middle text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handlePromptDeleteSegment(seg)}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                                      title="Delete Segment"
                                    >
                                      <Trash2 size={13} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSegment(seg)}
                                      className="h-8 px-2.5 bg-accent/60 hover:bg-accent text-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                      title="Edit List & Add Contacts"
                                    >
                                      <Edit2 size={12} /> Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedSegmentForView(seg);
                                        setViewSegmentSearchQuery("");
                                        setIsViewSegmentModalOpen(true);
                                      }}
                                      className="h-8 px-3 bg-primary/10 hover:bg-primary hover:text-white text-primary rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                    >
                                      <Eye size={12} /> View ({seg.contacts?.length || 0})
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* CARDS GRID VIEW */
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredSegments.map((seg) => (
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
                              {getSegmentBadge(seg)}
                              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 bg-accent/30 px-2.5 py-1 rounded-full">
                                <Users size={12} className="text-primary" /> {seg.contacts?.length || 0} Recipients
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
                                    {(typeof seg.filters?.campaignId === "object" && seg.filters?.campaignId !== null && seg.filters?.campaignId?.name) ? seg.filters.campaignId.name : "Sales Campaign Leads"}
                                  </strong>
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditSegment(seg);
                                }}
                                className="h-8 px-2 bg-accent/60 hover:bg-accent text-foreground rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs shrink-0 cursor-pointer"
                                title="Edit List & Add Contacts"
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedSegmentForView(seg);
                                  setViewSegmentSearchQuery("");
                                  setIsViewSegmentModalOpen(true);
                                }}
                                className="h-8 px-2.5 bg-primary/10 group-hover:bg-primary group-hover:text-white text-primary rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs truncate cursor-pointer"
                              >
                                <Eye size={12} /> View ({seg.contacts?.length || 0})
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePromptDeleteSegment(seg);
                              }}
                              className="h-8 w-8 p-0 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer"
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
                  ) : filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-card rounded-2xl border p-8 space-y-3">
                      <FileText className="h-10 w-10 opacity-30 text-primary" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">
                          {templates.length === 0 ? "No Database Templates Found" : "No Templates Match Search"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {templates.length === 0
                            ? 'Click "Generate AI Template" above to create one using Anthropic Claude.'
                            : 'Try clearing your search query to see all templates.'
                          }
                        </p>
                      </div>
                    </div>
                  ) : marketingViewMode === 'table' ? (
                    /* FULL DATA TABLE VIEW FOR TEMPLATES */
                    <div className="border rounded-2xl overflow-hidden bg-card shadow-xs">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                              <th className="p-3.5 pl-5 align-middle">Template Name</th>
                              <th className="p-3.5 align-middle">Subject</th>
                              <th className="p-3.5 align-middle">Type & Category</th>
                              <th className="p-3.5 align-middle">Created Date</th>
                              <th className="p-3.5 align-middle text-center w-[230px] whitespace-nowrap">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {filteredTemplates.map(tpl => (
                              <tr
                                key={tpl._id}
                                onClick={() => handleOpenTemplateDirectly(tpl)}
                                className="hover:bg-accent/30 transition-colors cursor-pointer group"
                              >
                                <td className="p-3.5 pl-5 max-w-[240px] align-middle">
                                  <span className="font-bold text-foreground block truncate group-hover:text-primary transition-colors">{tpl.name}</span>
                                  {tpl.aiPrompt && (
                                    <span className="text-[11px] text-muted-foreground italic block truncate mt-0.5">"{tpl.aiPrompt}"</span>
                                  )}
                                </td>
                                <td className="p-3.5 max-w-[200px] align-middle">
                                  <span className="font-medium text-foreground block truncate">{tpl.subject}</span>
                                </td>
                                <td className="p-3.5 align-middle">
                                  <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border ${tpl.isAiGenerated ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                    }`}>
                                    {tpl.isAiGenerated ? "✨ Anthropic AI" : tpl.category || "General"}
                                  </span>
                                </td>
                                <td className="p-3.5 text-[11px] text-muted-foreground align-middle">
                                  {tpl.createdAt ? new Date(tpl.createdAt).toLocaleDateString() : "-"}
                                </td>
                                <td className="p-3.5 align-middle text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTemplateToDelete(tpl);
                                        setIsDeleteTemplateModalOpen(true);
                                      }}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                                      title="Delete Template"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenTemplateDirectly(tpl)}
                                      className="h-8 px-3 bg-accent/60 hover:bg-accent text-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                      title="Quick Preview Template"
                                    >
                                      <Eye size={12} /> Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditTemplate(tpl)}
                                      className="h-8 px-2.5 bg-accent/60 hover:bg-accent text-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                      title="Edit Template"
                                    >
                                      <Edit2 size={12} /> Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => injectDbTemplate(tpl)}
                                      className="h-8 px-3 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                    >
                                      Use <ChevronRight size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* CARDS GRID VIEW */
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredTemplates.map(tpl => (
                        <div key={tpl._id} className="bg-card rounded-2xl border p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${tpl.isAiGenerated ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20" : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                }`}>
                                {tpl.isAiGenerated ? "✨ Anthropic AI" : tpl.category || "General"}
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
                              type="button"
                              onClick={() => {
                                setTemplateToDelete(tpl);
                                setIsDeleteTemplateModalOpen(true);
                              }}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete Template"
                            >
                              <Trash2 size={13} />
                            </button>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenTemplateDirectly(tpl)}
                                className="h-8 px-2.5 bg-accent/60 hover:bg-accent text-foreground rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Quick Preview Template"
                              >
                                <Eye size={12} /> Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditTemplate(tpl)}
                                className="h-8 px-2.5 bg-accent/60 hover:bg-accent text-foreground rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs shrink-0 cursor-pointer"
                                title="Edit Template"
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => injectDbTemplate(tpl)}
                                className="h-8 px-3 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-primary/95 transition-colors cursor-pointer"
                              >
                                Use Template <ChevronRight size={13} />
                              </button>
                            </div>
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
                  <div className="relative flex-1 flex items-center">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      id="search-inbox-input"
                      name="search_inbox"
                      aria-label="Search inbox conversations"
                      type="text"
                      placeholder="Search inbox..."
                      value={conversationsSearch}
                      onChange={e => setConversationsSearch(e.target.value)}
                      className="!pl-9 pr-3 h-9 input-field text-xs rounded-xl w-full"
                    />
                  </div>
                  <select
                    id="inbox-sort-select"
                    name="inbox_sort"
                    aria-label="Sort inbox conversations"
                    value={conversationsSort}
                    onChange={e => setConversationsSort(e.target.value as "recent" | "name")}
                    className="h-9 px-3 text-xs rounded-xl border border-border/80 bg-background dark:bg-card text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer shrink-0 min-w-[94px]"
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
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${conversationsFilter === tab.id
                        ? "bg-primary text-white border-primary shadow-2xs"
                        : "bg-accent/15 hover:bg-accent/40 text-muted-foreground hover:text-foreground border-transparent"
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
                        onClick={() => handleSelectConversation(conv)}
                        className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${isSelected
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

                    <div className="flex items-center gap-2">
                      {selectedConversation.isConsent === false && (
                        <button
                          type="button"
                          onClick={() => handleResubscribeLead(selectedConversation)}
                          disabled={resubscribing}
                          className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                          title="Restore email consent and allow sending emails to this contact"
                        >
                          {resubscribing ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />}
                          <span>Resubscribe</span>
                        </button>
                      )}
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
                  </div>

                  {/* Scrollable Email WhatsApp-style Chat Stream (Auto Scrolls to Bottom) */}
                  <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0 bg-accent/5 transition-opacity duration-150 ease-out">
                    {loadingHistory && emailHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-2 text-muted-foreground animate-in fade-in duration-150">
                        <Loader2 className="animate-spin text-primary h-6 w-6" />
                        <span className="text-xs font-semibold">Loading conversation...</span>
                      </div>
                    ) : emailHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-1 animate-in fade-in duration-150">
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
                            <div
                              onClick={() => {
                                setSelectedTemplateForPreview({
                                  _id: email._id,
                                  name: email.subject || '1-to-1 Email Message',
                                  category: email.type === 'bulk' ? (email.campaignTitle || 'Campaign Email') : '1-to-1 Inbox Message',
                                  subject: email.subject || 'Subject',
                                  content: email.body || ''
                                });
                                setTemplatePreviewMode('visual');
                                setIsTemplatePreviewModalOpen(true);
                              }}
                              className="max-w-[85%] sm:max-w-[75%] bg-card border border-primary/20 hover:border-primary/50 hover:shadow-md rounded-2xl rounded-tr-xs p-4 shadow-2xs space-y-2.5 text-left transition-all cursor-pointer group"
                              title="Click anywhere to open full view & template inspector"
                            >
                              {/* Bubble Header */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTemplateForPreview({
                                        _id: email._id,
                                        name: email.subject || '1-to-1 Email Message',
                                        category: email.type === 'bulk' ? (email.campaignTitle || 'Campaign Email') : '1-to-1 Inbox Message',
                                        subject: email.subject || 'Subject',
                                        content: email.body || ''
                                      });
                                      setTemplatePreviewMode('visual');
                                      setIsTemplatePreviewModalOpen(true);
                                    }}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-primary group-hover:bg-primary/10 border border-primary/20 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                    title="Open in Full Screen Flow Preview"
                                  >
                                    <Maximize2 size={10} /> Full View / Flow
                                  </button>
                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    {new Date(email.timestamp || email.sentAt || email.createdAt || Date.now()).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                  </span>
                                </div>
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
                                  <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1" title="Delivered">
                                    ✓ Delivered
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {/* Dedicated Anchor to auto-scroll to the latest message */}
                    <div ref={chatBottomAnchorRef} className="h-0 w-full" />
                  </div>

                  {/* Bottom Docked Rich Compose Block (Matching Screenshot 3) */}
                  <div className="p-4 border-t bg-card shrink-0 space-y-3 shadow-md">
                    {/* Consent Warning Banner */}
                    {selectedConversation.isConsent === false ? (
                      <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-left animate-in fade-in duration-200 w-full">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-destructive text-xs font-bold">
                            <AlertCircle size={15} /> Email Consent Revoked (Opted Out)
                          </div>
                          <p className="text-xs text-muted-foreground">
                            This contact has opted out (unsubscribed) from marketing emails. Outbound email is locked.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleResubscribeLead(selectedConversation)}
                          disabled={resubscribing}
                          className="h-8.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {resubscribing ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                          <span>Resubscribe Contact</span>
                        </button>
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
                          className="h-9 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm hover:shadow transition-all cursor-pointer active:scale-[0.98]"
                        >
                          <Sparkles size={13} className="text-amber-300" />
                          <span>AI Composer</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsComposeExpanded(true);
                          }}
                          className="h-9 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm shrink-0 transition-all cursor-pointer active:scale-[0.98]"
                        >
                          <Send size={13} /> Reply
                        </button>
                      </div>
                    ) : (
                      /* Expanded Full Rich Compose Form */
                      <form id="one-to-one-compose-form" name="one_to_one_compose_form" onSubmit={handleSendOneToOneEmail} className="space-y-2.5">
                        {/* Hidden input representing message body for complete semantic form accessibility */}
                        <input type="hidden" id="compose-body-input" name="compose_body" value={composeForm.body} />

                        {/* Top Input Row: Full-width Subject Line */}
                        <div>
                          <input
                            id="compose-subject-input"
                            name="compose_subject"
                            aria-label="Email Subject Line"
                            type="text"
                            placeholder="Email Subject Line..."
                            value={composeForm.subject}
                            onChange={e => setComposeForm({ ...composeForm, subject: e.target.value })}
                            className="w-full h-9.5 input-field text-xs rounded-xl bg-accent/20 border-border/80 focus:bg-background transition-all font-medium"
                            required
                          />
                        </div>

                        {/* Rich Text Editor Box */}
                        <div className="[&_.ql-editor]:min-h-[80px] [&_.ql-editor]:max-h-[140px] [&_.ql-toolbar]:py-1 [&_.ql-toolbar]:px-2 rounded-xl overflow-hidden border border-border/80">
                          <ReactQuill
                            theme="snow"
                            modules={composeQuillModules}
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
                              className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
                            >
                              <Sparkles size={14} className="text-amber-300" />
                              <span>AI Composer</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsComposeExpanded(false);
                                setShowComposeAiPanel(false);
                              }}
                              className="h-10 px-4 rounded-xl border border-border/80 bg-card hover:bg-accent/60 text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
                            >
                              <Minimize2 size={13} />
                              <span>Minimize</span>
                            </button>
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmitting || !composeForm.subject.trim() || !composeForm.body.trim()}
                            className="h-10 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Sending Email...</span>
                              </>
                            ) : (
                              <>
                                <Send size={14} />
                                <span>Send Email</span>
                              </>
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
                          id="compose-ai-prompt-input"
                          name="compose_ai_prompt"
                          aria-label="AI prompt instructions"
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
      <Dialog open={isCampaignModalOpen} onOpenChange={(open) => { if (!open) resetCampaignModalState(); setIsCampaignModalOpen(open); }}>
        <DialogContent className="w-[96vw] max-w-6xl max-h-[94vh] overflow-y-auto custom-scrollbar p-0 flex flex-col dark:bg-card">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle className="text-lg font-bold">Create Marketing Campaign</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="flex-1 flex flex-col lg:flex-row gap-6 p-6 min-h-0">
            <div className="flex-1 space-y-4 min-w-0 w-full">
              <div className="grid gap-1">
                <label htmlFor="campaign-title-input" className="text-xs font-bold text-muted-foreground uppercase cursor-pointer">Campaign Title <span className="text-destructive">*</span></label>
                <input
                  id="campaign-title-input"
                  name="campaign_title"
                  type="text"
                  placeholder="e.g. Speed Clinic Fall 2026 Promo"
                  className="input-field text-sm"
                  value={campaignForm.title}
                  onChange={e => setCampaignForm({ ...campaignForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="campaign-subject-input" className="text-xs font-bold text-muted-foreground uppercase cursor-pointer">Email Subject <span className="text-destructive">*</span></label>
                <input
                  id="campaign-subject-input"
                  name="campaign_subject"
                  type="text"
                  placeholder="Subject line seen by recipient"
                  className="input-field text-sm"
                  value={campaignForm.subject}
                  onChange={e => setCampaignForm({ ...campaignForm, subject: e.target.value })}
                  required
                />
              </div>

              {/* Select Reusable Template Dropdown */}
              <div className="grid gap-1.5 p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <div className="flex items-center justify-between">
                  <label htmlFor="campaign-template-select" className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase flex items-center gap-1.5 cursor-pointer">
                    <FileText size={13} /> Select Reusable Template
                  </label>
                  <span className="text-[10px] text-muted-foreground font-semibold">Loads layout, colors & placeholders</span>
                </div>
                <select
                  id="campaign-template-select"
                  name="campaign_template"
                  className="w-full h-10 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-medium cursor-pointer shadow-2xs leading-normal"
                  value={campaignForm.templateId || ""}
                  onChange={e => {
                    const selectedId = e.target.value;
                    const foundTpl = templates.find(t => t._id === selectedId);
                    if (foundTpl) {
                      setCampaignForm(prev => ({
                        ...prev,
                        templateId: foundTpl._id,
                        subject: foundTpl.subject || prev.subject,
                        content: foundTpl.content
                      }));
                      if (campaignWriterRef.current) {
                        campaignWriterRef.current.innerHTML = foundTpl.content;
                      }
                      pushCampaignHistory(foundTpl.content, foundTpl._id, true);
                      setCampaignEditorMode('preview');
                      toast.success(`Loaded template: "${foundTpl.name}"`);
                    } else {
                      setCampaignForm(prev => ({ ...prev, templateId: null }));
                      pushCampaignHistory(campaignForm.content, null, true);
                    }
                  }}
                >
                  <option value="">-- Choose a Saved Template (or write custom message) --</option>
                  {templates.map(tpl => (
                    <option key={tpl._id} value={tpl._id}>
                      {tpl.isAiGenerated ? "✨ " : ""}{tpl.name} ({tpl.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Design, Layout & Content Services */}
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Message Content & Design Services
                  </span>
                  <div className="flex items-center gap-1.5">
                    {campaignHistory.length > 0 && (
                      <div className="flex items-center gap-1 mr-1">
                        <button
                          type="button"
                          onClick={handleCampaignUndo}
                          disabled={campaignHistoryIndex <= 0}
                          className="px-2 py-1 rounded-lg border text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent/40 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Undo previous change (Ctrl+Z)"
                        >
                          <RotateCcw size={11} /> Undo
                        </button>
                        <button
                          type="button"
                          onClick={handleCampaignRedo}
                          disabled={campaignHistoryIndex >= campaignHistory.length - 1}
                          className="px-2 py-1 rounded-lg border text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent/40 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Redo change (Ctrl+Y)"
                        >
                          <RotateCw size={11} /> Redo
                        </button>
                      </div>
                    )}

                    {campaignForm.content.trim() && (
                      <button
                        type="button"
                        onClick={() => setIsCampaignPreviewFullscreen(true)}
                        className="px-2.5 py-1 rounded-lg border text-[11px] font-bold text-primary hover:bg-primary/10 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Open full view flow modal"
                      >
                        <Maximize2 size={12} /> Full View / Flow
                      </button>
                    )}
                    <div className="flex items-center bg-accent/60 p-0.5 rounded-lg border text-[11px] gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (campaignEditorMode === 'editor' && campaignWriterRef.current) {
                            setCampaignForm(prev => ({ ...prev, content: campaignWriterRef.current?.innerHTML || prev.content }));
                          }
                          setCampaignEditorMode("preview");
                        }}
                        className={`px-2.5 py-0.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${campaignEditorMode === "preview"
                            ? "bg-card text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        <Eye size={12} className={campaignEditorMode === "preview" ? "text-primary" : "text-muted-foreground"} />
                        <span>Live Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCampaignEditorMode("editor");
                          setTimeout(() => {
                            if (campaignWriterRef.current) {
                              if (campaignWriterRef.current.innerHTML !== campaignForm.content) {
                                campaignWriterRef.current.innerHTML = campaignForm.content || '';
                              }
                              campaignWriterRef.current.focus();
                            }
                          }, 0);
                        }}
                        className={`px-2.5 py-0.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${campaignEditorMode === "editor"
                            ? "bg-card text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        <PenLine size={12} className={campaignEditorMode === "editor" ? "text-primary" : "text-muted-foreground"} />
                        <span>Write Content</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (campaignEditorMode === 'editor' && campaignWriterRef.current) {
                            setCampaignForm(prev => ({ ...prev, content: campaignWriterRef.current?.innerHTML || prev.content }));
                          }
                          setCampaignEditorMode("html");
                        }}
                        className={`px-2.5 py-0.5 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1 ${campaignEditorMode === "html"
                            ? "bg-card text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        <Code2 size={12} className={campaignEditorMode === "html" ? "text-primary" : "text-muted-foreground"} />
                        <span>HTML Code</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mode 1: Live Preview */}
                {campaignEditorMode === "preview" && (
                  <div className="border rounded-2xl bg-slate-100/90 dark:bg-slate-900/60 p-4 sm:p-6 min-h-[420px] max-h-[560px] overflow-y-auto overflow-x-auto custom-scrollbar shadow-inner flex justify-center items-start">
                    {campaignForm.content.trim() ? (
                      <div className="w-full max-w-[600px] overflow-hidden rounded-xl bg-white shadow-sm border border-slate-200">
                        <div
                          className="email-template-canvas text-gray-900 leading-relaxed [&_table]:max-w-[600px] [&_table]:w-full [&_table]:mx-auto [&_table]:border-collapse"
                          dangerouslySetInnerHTML={{ __html: scopeTemplateHtml(campaignForm.content.replace(/\{\{name\}\}/gi, "John Doe")) }}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground self-center">
                        <Eye size={36} className="opacity-30 mb-2" />
                        <p className="text-xs font-semibold">No message content loaded</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">
                          Select a template above or switch to Write Content to start composing.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 2: Write Content (Rich Visual Canvas) */}
                {campaignEditorMode === "editor" && (
                  <div className="border rounded-2xl bg-card overflow-hidden shadow-sm flex flex-col">
                    {/* Visual Rich Formatting Toolbar */}
                    <div className="flex items-center gap-1 sm:gap-1.5 px-4 py-2 border-b bg-card shrink-0 flex-wrap relative">
                      {/* Group 1: History Undo / Redo */}
                      <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('undo')}
                          title="Undo (Ctrl+Z)"
                          className="h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-background text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('redo')}
                          title="Redo (Ctrl+Y)"
                          className="h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-background text-muted-foreground hover:text-foreground"
                        >
                          <RotateCw size={12} />
                        </button>
                      </div>

                      <div className="w-px h-5 bg-border mx-0.5" />

                      {/* Group 2: Basic Text Formatting */}
                      <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('bold')}
                          title="Bold"
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.bold ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          <Bold size={12} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('italic')}
                          title="Italic"
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.italic ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          <Italic size={12} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('underline')}
                          title="Underline"
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.underline ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          <Underline size={12} />
                        </button>
                      </div>

                      <div className="w-px h-5 bg-border mx-0.5" />

                      {/* Group 3: Font Size Selector */}
                      <div className="flex items-center gap-1.5 bg-accent/40 px-2 py-1 rounded-lg border border-border/50">
                        <Type size={11} className="text-muted-foreground shrink-0" />
                        <select
                          id="campaign-font-size-select"
                          name="campaign_font_size"
                          value={campaignActiveFormats.fontSize || ''}
                          onChange={e => {
                            if (e.target.value) {
                              applyCustomFontSize(campaignWriterRef, e.target.value, updateCampaignActiveFormats);
                            }
                          }}
                          title="Change Font Size"
                          className="h-5 text-xs bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                        >
                          <option value="">{campaignActiveFormats.fontSize ? campaignActiveFormats.fontSize : 'Size'}</option>
                          <option value="12px">12px (Small)</option>
                          <option value="14px">14px (Normal)</option>
                          <option value="16px">16px (Medium)</option>
                          <option value="18px">18px (Large)</option>
                          <option value="20px">20px (XL)</option>
                          <option value="24px">24px (2XL)</option>
                          <option value="28px">28px (3XL)</option>
                          <option value="32px">32px (Huge)</option>
                        </select>
                      </div>

                      <div className="w-px h-5 bg-border mx-0.5" />

                      {/* Group 4: Headings */}
                      <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('formatBlock', '<h1>')}
                          title="Heading 1"
                          className={`h-7 px-2 rounded-md text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.h1 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('formatBlock', '<h2>')}
                          title="Heading 2"
                          className={`h-7 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.h2 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('formatBlock', '<h3>')}
                          title="Heading 3"
                          className={`h-7 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.h3 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          H3
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('formatBlock', '<p>')}
                          title="Paragraph"
                          className={`h-7 px-2 rounded-md text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.p ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          P
                        </button>
                      </div>

                      <div className="w-px h-5 bg-border mx-0.5" />

                      {/* Group 5: Colors (Highlighter & Text Color) */}
                      <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        {/* Highlighter Tool */}
                        <div className="relative">
                          <button
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              saveSelectionRange();
                            }}
                            onClick={() => {
                              saveSelectionRange();
                              setIsCampaignHighlighterOpen(!isCampaignHighlighterOpen);
                              setIsCampaignColorPickerOpen(false);
                            }}
                            title={`Highlight Color (${campaignHighlightColor === 'transparent' ? 'None' : campaignHighlightColor})`}
                            className={`h-7 px-2 rounded-md hover:bg-background flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all cursor-pointer text-xs ${isCampaignHighlighterOpen ? 'bg-background text-foreground shadow-2xs' : ''}`}
                          >
                            <div className="flex flex-col items-center justify-center h-full pt-0.5 pb-1">
                              <Highlighter size={13} className="text-amber-500 shrink-0" />
                              <span
                                className="w-3.5 h-[2.5px] rounded-full shrink-0 mt-1 transition-all"
                                style={{
                                  backgroundColor: campaignHighlightColor === 'transparent' ? '#cbd5e1' : campaignHighlightColor,
                                  border: campaignHighlightColor === 'transparent' ? '0.5px dashed #94a3b8' : undefined
                                }}
                              />
                            </div>
                            <ChevronDown size={10} className="opacity-60 shrink-0" />
                          </button>
                          <GoogleDocsColorPickerPopover
                            title="Highlight color"
                            isOpen={isCampaignHighlighterOpen}
                            onClose={() => setIsCampaignHighlighterOpen(false)}
                            currentColor={campaignHighlightColor}
                            onSelectColor={color => {
                              setCampaignHighlightColor(color);
                              restoreSelectionRange();
                              execCampaignFormat('hiliteColor', color);
                            }}
                            allowNone={true}
                            restoreSelection={restoreSelectionRange}
                          />
                        </div>

                        {/* Text Color Tool with Full Color Picker & Light Contrasts */}
                        <div className="relative">
                          <button
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              saveSelectionRange();
                            }}
                            onClick={() => {
                              saveSelectionRange();
                              setIsCampaignColorPickerOpen(!isCampaignColorPickerOpen);
                              setIsCampaignHighlighterOpen(false);
                            }}
                            title={`Text Color (${campaignTextColor || '#000000'})`}
                            className={`h-7 px-2 rounded-md hover:bg-background flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all cursor-pointer text-xs ${isCampaignColorPickerOpen ? 'bg-background text-foreground shadow-2xs' : ''}`}
                          >
                            <div className="flex flex-col items-center justify-center h-full pt-0.5 pb-1">
                              <Palette size={13} className="text-blue-500 shrink-0" />
                              <span
                                className="w-3.5 h-[2.5px] rounded-full shrink-0 mt-1 transition-all"
                                style={{ backgroundColor: campaignTextColor || '#000000' }}
                              />
                            </div>
                            <ChevronDown size={10} className="opacity-60 shrink-0" />
                          </button>
                          <GoogleDocsColorPickerPopover
                            title="Text color"
                            isOpen={isCampaignColorPickerOpen}
                            onClose={() => setIsCampaignColorPickerOpen(false)}
                            currentColor={campaignTextColor}
                            onSelectColor={color => {
                              setCampaignTextColor(color);
                              restoreSelectionRange();
                              execCampaignFormat('foreColor', color);
                            }}
                            restoreSelection={restoreSelectionRange}
                          />
                        </div>
                      </div>

                      <div className="w-px h-5 bg-border mx-0.5" />

                      {/* Group 6: Lists */}
                      <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('insertUnorderedList')}
                          title="Bullet List"
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.ul ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          <List size={12} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('insertOrderedList')}
                          title="Numbered List"
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.ol ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          <ListOrdered size={12} />
                        </button>
                      </div>

                      <div className="w-px h-5 bg-border mx-0.5" />

                      {/* Group 7: Alignment */}
                      <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('justifyLeft')}
                          title="Align Left"
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.alignLeft ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          <AlignLeft size={12} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('justifyCenter')}
                          title="Align Center"
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.alignCenter ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          <AlignCenter size={12} />
                        </button>
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => execCampaignFormat('justifyRight')}
                          title="Align Right"
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${campaignActiveFormats.alignRight ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                          <AlignRight size={12} />
                        </button>
                      </div>

                      <div className="w-px h-5 bg-border mx-0.5" />

                      {/* Group 8: Links */}
                      <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                        <button
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            const url = prompt('Enter URL (e.g. https://example.com):');
                            if (url) {
                              const formattedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
                              execCampaignFormat('createLink', formattedUrl);
                            }
                          }}
                          title="Insert Link"
                          className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Link size={12} />
                        </button>
                      </div>

                      <div className="w-px h-5 bg-border mx-0.5" />

                      {/* Group 9: Personalization Tag helper */}
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          campaignWriterRef.current?.focus();
                          document.execCommand('insertText', false, '{{name}}');
                          updateCampaignActiveFormats();
                          if (campaignWriterRef.current) {
                            setCampaignForm(prev => ({ ...prev, content: campaignWriterRef.current?.innerHTML || '' }));
                          }
                        }}
                        title="Insert {{name}} personalization tag"
                        className="h-7 px-2.5 rounded-lg hover:bg-primary/20 flex items-center gap-1.5 text-primary text-xs font-bold border border-primary/30 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Tag size={11} /> {'{{name}}'}
                      </button>

                      {/* Right-Aligned Helper Guide */}
                      <div className="ml-auto text-[11px] text-muted-foreground font-medium hidden lg:flex items-center gap-1.5 pl-2">
                        Use <span className="font-mono bg-accent px-1.5 py-0.5 rounded text-primary font-bold">{'{{name}}'}</span> for recipient's name
                      </div>
                    </div>

                    {/* ContentEditable Writing Canvas */}
                    <div
                      ref={campaignWriterRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => {
                        if (campaignWriterRef.current) {
                          const newHtml = campaignWriterRef.current.innerHTML || '';
                          setCampaignForm(prev => ({ ...prev, content: newHtml }));
                          pushCampaignHistory(newHtml, campaignForm.templateId, false);
                        }
                      }}
                      onKeyUp={updateCampaignActiveFormats}
                      onMouseUp={updateCampaignActiveFormats}
                      onFocus={updateCampaignActiveFormats}
                      className="p-6 focus:outline-none min-h-[380px] max-h-[500px] overflow-y-auto custom-scrollbar text-foreground leading-relaxed text-sm bg-white dark:bg-card prose prose-sm dark:prose-invert max-w-none [&_table]:max-w-[600px] [&_table]:w-full [&_table]:mx-auto [&_table]:border-collapse"
                      style={{ minHeight: '380px' }}
                    />
                  </div>
                )}

                {/* Mode 3: HTML Code */}
                {campaignEditorMode === "html" && (
                  <div className="border rounded-2xl bg-slate-950 p-4 min-h-[420px] max-h-[560px] flex flex-col shadow-inner">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[10px] text-slate-400 font-mono">
                      <div className="flex items-center gap-2">
                        <Code2 size={12} className="text-emerald-400" />
                        <span className="text-emerald-400 font-bold">HTML Source Code Editor</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newHtml = campaignForm.content + '{{name}}';
                            setCampaignForm(prev => ({ ...prev, content: newHtml }));
                            pushCampaignHistory(newHtml, campaignForm.templateId, true);
                          }}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Insert {{name}} tag"
                        >
                          <Tag size={10} /> + {'{{name}}'}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setCampaignForm(prev => ({ ...prev, content: '' }));
                            pushCampaignHistory('', campaignForm.templateId, true);
                          }}
                          className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        >
                          Clear
                        </button>
                        <span>{campaignForm.content.length} characters</span>
                      </div>
                    </div>
                    <textarea
                      id="campaign-html-content"
                      name="campaign_html_content"
                      value={campaignForm.content}
                      onChange={e => {
                        const newHtml = e.target.value;
                        setCampaignForm(prev => ({ ...prev, content: newHtml }));
                        pushCampaignHistory(newHtml, campaignForm.templateId, false);
                      }}
                      placeholder="<!-- Paste or edit email HTML here -->"
                      className="w-full h-[380px] bg-transparent border-none outline-none resize-none text-emerald-400 font-mono text-xs custom-scrollbar leading-relaxed"
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-[380px] space-y-4 border-t lg:border-t-0 lg:border-l pt-5 lg:pt-0 lg:pl-6 shrink-0 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Multi-Select Recipient Lists & Segments */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span>Recipient Lists &amp; Locations</span>
                      <span className="text-destructive">*</span>
                    </label>
                    {campaignSelectedRecipientsStats.selectedListsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        {campaignSelectedRecipientsStats.selectedListsCount} Selected
                      </span>
                    )}
                  </div>

                  {/* Collapsible Dropdown Selector */}
                  <div className="relative" ref={segmentDropdownRef}>
                    {/* Dropdown Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setIsSegmentDropdownOpen(prev => !prev)}
                      className={`w-full min-h-[40px] px-3 py-2 text-xs bg-background text-foreground border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between shadow-2xs font-medium cursor-pointer transition-all ${
                        isSegmentDropdownOpen ? "border-primary ring-2 ring-primary/15" : "border-input hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate text-left min-w-0">
                        <Layers size={14} className="text-primary shrink-0" />
                        <span className={`truncate ${(campaignForm.segmentIds || []).length === 0 ? "text-muted-foreground" : "text-foreground font-bold"}`}>
                          {(campaignForm.segmentIds || []).length === 0
                            ? "Select Recipient Lists & Locations..."
                            : (campaignForm.segmentIds || []).length === 1
                              ? (segments.find(s => s._id === campaignForm.segmentIds[0])?.name || "1 List Selected")
                              : `${(campaignForm.segmentIds || []).length} Lists Selected`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {(campaignForm.segmentIds || []).length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                            {(campaignForm.segmentIds || []).length}
                          </span>
                        )}
                        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isSegmentDropdownOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {/* Dropdown Popover Menu */}
                    {isSegmentDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1.5 p-2 bg-card border border-border/80 rounded-2xl shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                        {/* Search and Batch Controls */}
                        <div className="space-y-1.5">
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Search locations or schools (A–Z)..."
                              value={campaignSegmentSearchQuery}
                              onChange={e => setCampaignSegmentSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-7 py-1.5 bg-background border border-border/80 rounded-xl text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                              autoFocus
                            />
                            {campaignSegmentSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setCampaignSegmentSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                                title="Clear search"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] px-1 text-muted-foreground">
                            <span className="text-[10px] font-semibold">
                              Alphabetical (A–Z) &bull; {campaignFilteredSegments.length} list{campaignFilteredSegments.length !== 1 ? 's' : ''}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const allFilteredIds = campaignFilteredSegments.map(s => s._id);
                                  const merged = Array.from(new Set([...(campaignForm.segmentIds || []), ...allFilteredIds]));
                                  setCampaignForm({
                                    ...campaignForm,
                                    segmentIds: merged,
                                    segmentId: merged[0] || ""
                                  });
                                }}
                                className="font-bold text-primary hover:underline cursor-pointer"
                              >
                                Select All
                              </button>
                              <span>&bull;</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCampaignForm({
                                    ...campaignForm,
                                    segmentIds: [],
                                    segmentId: ""
                                  });
                                }}
                                className="font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Alphabetical Checkbox Container */}
                        <div className="max-h-52 overflow-y-auto custom-scrollbar border border-border/70 rounded-xl p-1 bg-background/50 divide-y divide-border/30 shadow-inner">
                          {campaignFilteredSegments.length === 0 ? (
                            <div className="py-6 px-3 text-center text-xs text-muted-foreground">
                              {campaignSegmentSearchQuery ? (
                                <span>No locations or lists match "{campaignSegmentSearchQuery}"</span>
                              ) : (
                                <span>No recipient lists available. Please create one in Lists &amp; Segments.</span>
                              )}
                            </div>
                          ) : (
                            campaignFilteredSegments.map(seg => {
                              const isChecked = (campaignForm.segmentIds || []).includes(seg._id);
                              const contactCount = seg.contacts?.length || 0;

                              return (
                                <label
                                  key={seg._id}
                                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                                    isChecked
                                      ? "bg-primary/10 text-foreground font-semibold"
                                      : "hover:bg-accent/40 text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                      const current = campaignForm.segmentIds || [];
                                      let next: string[];
                                      if (e.target.checked) {
                                        next = [...current, seg._id];
                                      } else {
                                        next = current.filter(id => id !== seg._id);
                                      }
                                      setCampaignForm({
                                        ...campaignForm,
                                        segmentIds: next,
                                        segmentId: next[0] || ""
                                      });
                                    }}
                                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className={`truncate ${isChecked ? "font-bold text-foreground" : "font-medium"}`}>
                                        {seg.name}
                                      </span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-accent/60 text-muted-foreground shrink-0 font-medium">
                                        {contactCount}
                                      </span>
                                    </div>
                                    {seg.category && (
                                      <span className="text-[10px] text-muted-foreground/80 block truncate capitalize">
                                        {seg.category}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Live Recipient Count & Deduplication Status Card */}
                  {campaignSelectedRecipientsStats.selectedListsCount === 0 ? (
                    <div className="p-2.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-[11px] flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                      <span>Please select one or more locations/lists above to calculate live audience before sending.</span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 via-accent/10 to-transparent shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Live Audience Estimate
                          </div>
                          <div className="text-xl font-extrabold text-foreground flex items-baseline gap-1 mt-0.5">
                            <span className="text-primary">{campaignSelectedRecipientsStats.uniqueRecipientsCount}</span>
                            <span className="text-xs font-semibold text-muted-foreground">Unique Recipients</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground px-2 py-0.5 bg-background/80 rounded-md border border-border/60">
                            <Layers size={11} className="text-primary" />
                            {campaignSelectedRecipientsStats.selectedListsCount} Lists
                          </span>
                        </div>
                      </div>

                      {/* Deduplication Guarantee */}
                      {campaignSelectedRecipientsStats.duplicatesEliminated > 0 ? (
                        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-[11px] leading-tight">
                          <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <span className="font-bold">Deduplication Active:</span>{" "}
                            {campaignSelectedRecipientsStats.duplicatesEliminated} duplicate contact{campaignSelectedRecipientsStats.duplicatesEliminated > 1 ? "s" : ""} prevented across selected lists. Each recipient will receive this campaign exactly once.
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          <span>No duplicate email addresses detected across selected lists.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="schedule-chk"
                      name="is_scheduled"
                      checked={campaignForm.isScheduled}
                      onChange={e => setCampaignForm({ ...campaignForm, isScheduled: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="schedule-chk" className="text-xs font-bold text-foreground cursor-pointer select-none">
                      Schedule for later?
                    </label>
                  </div>
                  {campaignForm.isScheduled && (
                    <div className="mt-2.5 space-y-1">
                      <input
                        id="campaign-send-at-input"
                        name="campaign_send_at"
                        aria-label="Schedule dispatch date and time"
                        type="datetime-local"
                        className="input-field text-sm dark:bg-card"
                        value={campaignForm.sendAt}
                        min={getMinScheduleDateTime()}
                        onChange={e => {
                          const val = e.target.value;
                          if (val && new Date(val).getTime() <= Date.now()) {
                            toast.warning("Please select an upcoming future date and time.");
                          }
                          setCampaignForm({ ...campaignForm, sendAt: val });
                        }}
                        required={campaignForm.isScheduled}
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Campaign will automatically dispatch at this scheduled time.
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Copywriter Assistant: On-demand Expandable Button & Panel */}
                {!showCampaignAiPanel ? (
                  <button
                    type="button"
                    onClick={() => setShowCampaignAiPanel(true)}
                    className="w-full p-2.5 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-transparent hover:from-violet-500/20 hover:via-indigo-500/15 hover:to-transparent flex items-center justify-between text-left transition-all group cursor-pointer shadow-xs mt-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                        <Sparkles size={14} className="animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground">
                          AI Copywriter Assistant
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          Click to compose or update copy with AI
                        </p>
                      </div>
                    </div>
                    <ChevronDown size={14} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-1" />
                  </button>
                ) : (
                  <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent p-3 space-y-2 mt-3 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-2xs">
                          <Sparkles size={11} className="animate-pulse" />
                        </div>
                        <span className="text-xs font-bold text-foreground">AI Copywriter</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCampaignAiPanel(false)}
                        className="w-5 h-5 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Close AI panel"
                      >
                        <ChevronUp size={13} />
                      </button>
                    </div>

                    <textarea
                      id="campaign-ai-prompt"
                      name="campaign_ai_prompt"
                      aria-label="AI Copywriter prompt instructions"
                      placeholder={
                        !!campaignForm.templateId || (campaignForm.content && campaignForm.content.includes('<table'))
                          ? "Prompt AI to update or personalize this template..."
                          : "Prompt AI to draft campaign message..."
                      }
                      className="w-full bg-background/90 text-foreground border border-violet-500/25 rounded-xl p-2.5 text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none overflow-hidden h-[68px]"
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleAiDraftGenerate();
                        }
                      }}
                    />

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCampaignAiPanel(false);
                          setAiPrompt("");
                        }}
                        className="px-2.5 h-7 rounded-xl border text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAiDraftGenerate}
                        disabled={aiGenerating || !aiPrompt.trim()}
                        className="flex-1 btn-primary h-7 text-xs font-bold gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-md shadow-violet-500/20 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        {aiGenerating ? (
                          <><Loader2 size={11} className="animate-spin" /> Composing...</>
                        ) : (
                          <><Sparkles size={11} /> Compose with AI</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    resetCampaignModalState();
                    setIsCampaignModalOpen(false);
                  }}
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

      {/* --- DIALOG 2: SEGMENT BUILDER DIALOG (CREATE & EDIT) --- */}
      <Dialog open={isSegmentModalOpen} onOpenChange={(open) => { if (!open) resetSegmentModalState(); setIsSegmentModalOpen(open); }}>
        <DialogContent className={`w-[96vw] transition-all duration-300 ${segmentForm.type === "dynamic" ? "max-w-lg" : "max-w-5xl xl:max-w-6xl"} h-[88vh] max-h-[88vh] min-h-[600px] p-0 flex flex-col overflow-hidden dark:bg-card`}>
          <DialogHeader className="p-5 pb-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              {editingSegmentId ? <Edit2 className="text-primary h-5 w-5" /> : <Users className="text-primary h-5 w-5" />}
              <DialogTitle>
                {editingSegmentId ? `Edit List & Segment (${segmentForm.name || "Current List"})` : "Create List & Segment"}
              </DialogTitle>
            </div>
            {editingSegmentId && (
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Update list details, targeting rules, or manage and remove contacts currently present in this list.
              </DialogDescription>
            )}
          </DialogHeader>

          <form onSubmit={handleCreateSegment} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
              {/* Common Segment Form Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-1">
                  <label htmlFor="segment-name-input" className="text-xs font-bold text-muted-foreground uppercase cursor-pointer">List / Segment Name <span className="text-destructive">*</span></label>
                  <input
                    id="segment-name-input"
                    name="segment_name"
                    type="text"
                    placeholder="e.g. Interested Football Leads"
                    className="input-field text-sm"
                    value={segmentForm.name}
                    onChange={e => setSegmentForm({ ...segmentForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid gap-1">
                  <label htmlFor="segment-description-input" className="text-xs font-bold text-muted-foreground uppercase cursor-pointer">Description</label>
                  <input
                    id="segment-description-input"
                    name="segment_description"
                    type="text"
                    placeholder="Describe this segment list targeting"
                    className="input-field text-sm"
                    value={segmentForm.description}
                    onChange={e => setSegmentForm({ ...segmentForm, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Segment Selection Method Toggle Pills */}
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Segment Selection Method</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center p-1 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                          title="Click to learn about Segment Selection Methods"
                          aria-label="Learn about segment selection methods"
                        >
                          <HelpCircle size={14} className="stroke-[2.2]" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[92vw] max-w-[430px] p-4 text-xs space-y-3 z-[100] shadow-2xl border-border bg-card/95 backdrop-blur-md rounded-xl"
                        side="bottom"
                        align="start"
                      >
                        <div className="flex items-start gap-2.5 pb-2.5 border-b">
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                            <Info size={16} />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground">Segment Selection Methods</h4>
                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                              Segments define the recipient audience for your email campaigns. Choose how you want to curate contacts:
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2.5 pt-0.5">
                          {/* CSV Import */}
                          <div className="p-2.5 rounded-lg bg-accent/30 border border-border/60 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-violet-600 dark:text-violet-400">
                              <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0"></span>
                              <span>1. Import CSV File</span>
                            </div>
                            <p className="text-[11px] text-foreground/90 font-medium">
                              Upload an external spreadsheet (CSV) with contact names and emails.
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              <strong className="text-foreground/80">How to use:</strong> Upload any <code className="text-primary font-semibold">.csv</code> file, search and pick specific rows, or click "Select All" to bulk import external leads.
                            </p>
                          </div>

                          {/* Manual CRM Contacts */}
                          <div className="p-2.5 rounded-lg bg-accent/30 border border-border/60 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                              <span>2. Manual Contacts (CRM & Custom)</span>
                            </div>
                            <p className="text-[11px] text-foreground/90 font-medium">
                              Handpick existing contacts from your CRM database or type ad-hoc emails.
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              <strong className="text-foreground/80">How to use:</strong> Filter by categories (Main Leads, EA Leads, Team Members), select contacts individually or in bulk, and optionally add custom name/email pairs.
                            </p>
                          </div>

                          {/* Sales Campaign */}
                          <div className="p-2.5 rounded-lg bg-accent/30 border border-border/60 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                              <span>3. Sales Campaign</span>
                            </div>
                            <p className="text-[11px] text-foreground/90 font-medium">
                              Target audiences that engaged in previous or active sales campaigns.
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              <strong className="text-foreground/80">How to use:</strong> Select one or more sales campaigns from the dropdown, preview all linked leads, and select specific leads or all campaign recipients.
                            </p>
                          </div>

                          {/* Marketing List */}
                          <div className="p-2.5 rounded-lg bg-accent/30 border border-border/60 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              <span>4. Marketing List</span>
                            </div>
                            <p className="text-[11px] text-foreground/90 font-medium">
                              Import parent contacts from the Marketing database.
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              <strong className="text-foreground/80">Opt-Out Protection:</strong> Only verified active subscribers are displayed. Opted-out / unsubscribed parents are strictly omitted.
                            </p>
                          </div>
                        </div>

                        <div className="pt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground border-t">
                          <Sparkles size={12} className="text-primary shrink-0" />
                          <span>Audience count updates dynamically in the summary strip below.</span>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                {/* Segment Selection / Edit Tab Toggle Pills */}
                {editingSegmentId ? (
                  <div className="flex flex-wrap bg-accent/40 border p-1 rounded-xl w-full gap-1">
                    <button
                      type="button"
                      onClick={() => setSegmentTab("existing")}
                      className={`flex-1 min-w-[120px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${segmentTab === "existing" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Users size={13} />
                      <span>1. Current ({existingSelectedEmails.length}/{existingSegmentContacts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentTab("csv");
                        setSegmentForm(prev => ({ ...prev, type: "csv" }));
                      }}
                      className={`flex-1 min-w-[100px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${segmentTab === "csv" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Upload size={13} />
                      <span>2. CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentTab("static");
                        setSegmentForm(prev => ({ ...prev, type: "static" }));
                      }}
                      className={`flex-1 min-w-[100px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${segmentTab === "static" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <UserCheck size={13} />
                      <span>3. CRM</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentTab("campaign");
                        setSegmentForm(prev => ({ ...prev, type: "campaign" }));
                      }}
                      className={`flex-1 min-w-[100px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${segmentTab === "campaign" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Sparkles size={13} />
                      <span>4. Campaign</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentTab("marketing");
                        setSegmentForm(prev => ({ ...prev, type: "marketing" }));
                        if (marketingListContacts.length === 0) {
                          fetchMarketingListContacts();
                        }
                      }}
                      className={`flex-1 min-w-[110px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${segmentTab === "marketing" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <ShieldCheck size={13} />
                      <span>5. Marketing List</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap bg-accent/40 border p-1 rounded-xl w-full gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentTab("csv");
                        setSegmentForm(prev => ({ ...prev, type: "csv" }));
                      }}
                      className={`flex-1 min-w-[90px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${segmentForm.type === "csv" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Import CSV File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentTab("static");
                        setSegmentForm(prev => ({ ...prev, type: "static" }));
                      }}
                      className={`flex-1 min-w-[90px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${segmentForm.type === "static" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Manual Contacts
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentTab("campaign");
                        setSegmentForm(prev => ({ ...prev, type: "campaign" }));
                      }}
                      className={`flex-1 min-w-[90px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${segmentForm.type === "campaign" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Sales Campaign
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSegmentTab("marketing");
                        setSegmentForm(prev => ({ ...prev, type: "marketing" }));
                        if (marketingListContacts.length === 0) {
                          fetchMarketingListContacts();
                        }
                      }}
                      className={`flex-1 min-w-[110px] py-1.5 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${segmentForm.type === "marketing" ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <ShieldCheck size={13} className="shrink-0" />
                      <span>Marketing List</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Compact Sleek Audience Summary Strip */}
              <div className="py-2 px-3.5 bg-accent/20 border border-border/70 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-primary shrink-0" />
                  <span className="font-semibold text-foreground">Target Audience Summary:</span>
                  <span className="font-bold text-primary">{selectionBreakdown.totalUnique} Ready</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {editingSegmentId && selectionBreakdown.existingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      Retained: {selectionBreakdown.existingCount}
                    </span>
                  )}
                  {selectionBreakdown.csvCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      CSV: +{selectionBreakdown.csvCount}
                    </span>
                  )}
                  {selectionBreakdown.crmCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      CRM: +{selectionBreakdown.crmCount}
                    </span>
                  )}
                  {selectionBreakdown.eaCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      EA: +{selectionBreakdown.eaCount}
                    </span>
                  )}
                  {selectionBreakdown.teamCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Team: +{selectionBreakdown.teamCount}
                    </span>
                  )}
                  {selectionBreakdown.campaignCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Campaign: +{selectionBreakdown.campaignCount}
                    </span>
                  )}
                  {selectionBreakdown.marketingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                      Marketing: +{selectionBreakdown.marketingCount}
                    </span>
                  )}
                  {selectionBreakdown.customCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      Custom: +{selectionBreakdown.customCount}
                    </span>
                  )}
                  {selectionBreakdown.totalUnique === 0 && (
                    <span className="text-muted-foreground italic text-[11px]">Select contacts below</span>
                  )}
                </div>
              </div>

              {/* Selection Method Specific Body */}
              {editingSegmentId && segmentTab === "existing" ? (
                /* TAB 1 (EDIT ONLY): Dedicated Existing Contacts Inspector & Manager */
                <div className="border-t pt-4 space-y-3 animate-in fade-in duration-200 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
                        <Users size={14} /> Existing Segment Contacts ({existingSegmentContacts.length})
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Review or uncheck contacts to exclude them from this list. Use 🗑️ to permanently delete.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExistingSelectedEmails(existingSegmentContacts.map(c => c.email))}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <button
                        type="button"
                        onClick={() => setExistingSelectedEmails([])}
                        className="text-[11px] font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                      {existingSegmentContacts.length > 0 && (
                        <>
                          <span className="text-muted-foreground">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              setExistingSegmentContacts([]);
                              setExistingSelectedEmails([]);
                            }}
                            className="text-[11px] font-bold text-destructive hover:underline cursor-pointer"
                          >
                            Delete All
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Search Filter for Current Contacts */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      id="existing-contacts-search-input"
                      name="existing_contacts_search"
                      aria-label="Filter existing contacts by name or email"
                      type="text"
                      placeholder="Filter existing contacts by name or email..."
                      value={existingContactsSearch}
                      onChange={e => setExistingContactsSearch(e.target.value)}
                      className="!pl-9 h-8.5 input-field text-xs w-full bg-card"
                    />
                  </div>

                  {/* Contacts List */}
                  <div className="border border-border rounded-xl p-2.5 min-h-[380px] max-h-[460px] overflow-y-auto custom-scrollbar space-y-1 bg-accent/5 flex-1">
                    {existingSegmentContacts.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground space-y-1">
                        <Users size={28} className="mx-auto opacity-30" />
                        <p className="text-xs font-semibold">No existing contacts remaining in this list.</p>
                        <p className="text-[11px]">Use the "Append" tabs above to add fresh contacts from CSV, CRM, or Campaigns.</p>
                      </div>
                    ) : filteredExistingContacts.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-xs">
                        No contacts match "{existingContactsSearch}"
                      </div>
                    ) : (
                      filteredExistingContacts.map((contact, idx) => {
                        const isSelected = existingSelectedEmails.includes(contact.email);
                        return (
                          <div
                            key={contact.email || idx}
                            className={`flex items-center justify-between gap-2.5 p-2 rounded-lg border transition-colors ${isSelected ? "bg-card border-border/80 text-foreground" : "opacity-50 bg-muted/20 border-transparent text-muted-foreground"
                              }`}
                          >
                            <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                              <input
                                id={`existing-contact-${idx}`}
                                name="existing_contact_email"
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setExistingSelectedEmails(prev =>
                                    prev.includes(contact.email) ? prev.filter(e => e !== contact.email) : [...prev, contact.email]
                                  );
                                }}
                                className="rounded shrink-0"
                              />
                              <div className="min-w-0 flex-1 text-left">
                                <span className={`font-bold text-xs block truncate ${isSelected ? "text-foreground" : "line-through text-muted-foreground"}`}>
                                  {contact.name || contact.email.split('@')[0]}
                                </span>
                                <span className="text-[10px] text-muted-foreground block truncate">{contact.email}</span>
                              </div>
                            </label>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                Saved
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setExistingSegmentContacts(prev => prev.filter(c => c.email !== contact.email));
                                  setExistingSelectedEmails(prev => prev.filter(e => e !== contact.email));
                                }}
                                className="h-6 w-6 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center transition-colors cursor-pointer"
                                title="Delete contact from list"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : segmentTab === "csv" || (segmentForm.type === "csv" && !editingSegmentId) ? (
                /* 2-Column Responsive Grid for CSV File Import */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4 animate-in fade-in duration-200">
                  {/* Left Column: File Upload Picker */}
                  <div className="space-y-4 text-left">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase text-primary">
                        {editingSegmentId ? "Append Contacts from CSV File" : "Import Contacts from CSV File"}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Upload a CSV file containing recipient names and email addresses.
                      </p>
                    </div>

                    <label
                      htmlFor="inline-csv-file-input"
                      className="group relative block p-5 border-2 border-dashed border-primary/50 hover:border-primary rounded-2xl bg-accent/5 hover:bg-primary/5 text-center space-y-2.5 transition-all duration-200 cursor-pointer shadow-sm"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const fakeEvent = {
                            target: { files: [file] }
                          } as unknown as React.ChangeEvent<HTMLInputElement>;
                          handleInlineCsvSelect(fakeEvent);
                        }
                      }}
                    >
                      <input
                        id="inline-csv-file-input"
                        name="inline_csv_file"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleInlineCsvSelect}
                      />
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                        <Upload size={20} />
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          Click anywhere to upload CSV file
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          or drag and drop your file here
                        </p>
                        <div className="inline-block mt-1">
                          <span className="btn-secondary text-xs py-1 px-3 pointer-events-none group-hover:border-primary/40 inline-flex items-center gap-1.5">
                            <Upload size={12} /> Browse CSV File
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground pt-0.5">Supported format: .csv</p>
                      </div>
                    </label>

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
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="csv-contacts-search-input"
                        name="csv_contacts_search"
                        aria-label="Filter CSV contacts"
                        type="text"
                        placeholder="Filter CSV contacts..."
                        value={csvSearchQuery}
                        onChange={e => setCsvSearchQuery(e.target.value)}
                        className="!pl-9 pr-3 h-8.5 input-field text-xs w-full"
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
                        className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Select All Filtered
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredEmails = filteredCsvParsedContacts.map(c => c.email);
                          setCsvSelectedEmails(prev => prev.filter(email => !allFilteredEmails.includes(email)));
                        }}
                        className="text-[10px] text-destructive hover:underline font-semibold cursor-pointer"
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
                              className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${isSelected
                                ? "bg-violet-500/5 border-violet-500/20 text-foreground"
                                : "hover:bg-accent/30 border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                              <input
                                id={`csv-contact-check-${idx}`}
                                name="csv_contact_email"
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => { }}
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
              ) : segmentTab === "static" || (segmentForm.type === "static" && !editingSegmentId) ? (
                /* 2-Column Responsive Grid for Static Selection */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                  {/* Left Column: Custom Contact Insertion */}
                  <div className="space-y-4">
                    <div className="space-y-2.5 text-left">
                      <div className="flex justify-between items-center">
                        <h5 className="text-xs font-bold uppercase text-primary">
                          {editingSegmentId ? "Append Custom Contact" : "Insert Custom Contact"}
                        </h5>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full font-bold">
                          {segmentForm.customContacts.length} Added
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-0.5">
                          <label htmlFor="custom-contact-name-input" className="text-[9px] font-bold text-muted-foreground uppercase cursor-pointer">Contact Name</label>
                          <input
                            id="custom-contact-name-input"
                            name="custom_contact_name"
                            type="text"
                            placeholder="e.g. John Doe"
                            value={customContactName}
                            onChange={e => setCustomContactName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                if (customContactEmail.trim()) {
                                  handleAddCustomContact(e);
                                } else {
                                  const emailInput = document.getElementById("custom-contact-email-input") as HTMLInputElement | null;
                                  emailInput?.focus();
                                }
                              }
                            }}
                            className="h-8 input-field text-xs bg-background"
                          />
                        </div>
                        <div className="grid gap-0.5">
                          <label htmlFor="custom-contact-email-input" className="text-[9px] font-bold text-muted-foreground uppercase cursor-pointer">Email Address</label>
                          <input
                            id="custom-contact-email-input"
                            name="custom_contact_email"
                            type="email"
                            placeholder="e.g. john@example.com"
                            value={customContactEmail}
                            onChange={e => setCustomContactEmail(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                if (customContactEmail.trim()) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAddCustomContact(e);
                                }
                              }
                            }}
                            className="h-8 input-field text-xs bg-background"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddCustomContact}
                        className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <Plus size={12} /> Add Contact to List
                      </button>

                      {segmentForm.customContacts.length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Newly Added Contacts ({segmentForm.customContacts.length}):</span>
                            <button
                              type="button"
                              onClick={() => setSegmentForm(prev => ({ ...prev, customContacts: [] }))}
                              className="text-[10px] text-destructive hover:underline font-semibold"
                            >
                              Clear
                            </button>
                          </div>

                          <div className="border border-indigo-500/20 bg-indigo-500/5 rounded-xl p-2 max-h-36 overflow-y-auto custom-scrollbar space-y-1">
                            {segmentForm.customContacts.map((contact, idx) => (
                              <div key={idx} className="flex justify-between items-center gap-2 p-1.5 bg-card border rounded-lg text-xs">
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold block text-foreground truncate">{contact.name}</span>
                                  <span className="text-[10px] text-muted-foreground block truncate">{contact.email}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomContact(contact.email)}
                                  className="h-5 w-5 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                                  title="Remove contact"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
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
                          className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-colors ${contactCategoryFilter === cat.id
                            ? "bg-primary text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Search box */}
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="contacts-search-query-input"
                        name="contacts_search_query"
                        aria-label="Search contacts by name or email"
                        type="text"
                        placeholder="Search by name or email..."
                        value={contactsSearchQuery}
                        onChange={e => setContactsSearchQuery(e.target.value)}
                        className="!pl-9 pr-3 h-8.5 input-field text-xs w-full"
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
                    <div className="min-h-[380px] max-h-[460px] overflow-y-auto border border-border rounded-xl p-2.5 space-y-1.5 bg-accent/5 custom-scrollbar flex-1">
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
                              className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${isSelected
                                ? "bg-primary/5 border-primary/20 text-foreground"
                                : "hover:bg-accent/30 border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                              <input
                                id={`contact-check-${contact._id}`}
                                name="contact_selection_id"
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => { }}
                                className="rounded mt-0.5 pointer-events-none shrink-0"
                              />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-1.5 justify-between">
                                  <span className="font-bold text-xs truncate text-foreground leading-tight">
                                    {contact.name}
                                  </span>
                                  <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${contact.leadType === "ea_lead" ? "bg-violet-500/10 text-violet-500" :
                                      contact.leadType === "team_member" ? "bg-emerald-500/10 text-emerald-500" :
                                        "bg-blue-500/10 text-blue-500"
                                    }`}>
                                    {contact.leadType === "ea_lead" ? "EA Lead" :
                                      contact.leadType === "team_member" ? "Team" :
                                        "CRM"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate mt-0.5">
                                  <span className="truncate">{contact.email}</span>
                                  {contact.leadName && contact.leadType === "main_lead" && contact.leadName !== "CRM Lead" && contact.leadName !== contact.name && (
                                    <span className="opacity-75 shrink-0">• Lead: {contact.leadName}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : segmentTab === "campaign" || (segmentForm.type === "campaign" && !editingSegmentId) ? (
                /* Target Sales Campaign 2-Column Grid */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4 animate-in fade-in duration-200">
                  {/* Left Column: Target Sales Campaign Dropdown with Checkboxes */}
                  <div className="space-y-3 flex flex-col h-full min-h-0 text-left">
                    <div className="space-y-1 text-left">
                      <h4 className="text-xs font-bold uppercase text-primary">Target CRM Sales Campaigns</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Select one or more Sales Campaigns from your sales funnel. All contacts attached to leads inside selected campaigns will be automatically aggregated.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="sales-campaign-search-input" className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer">
                          Select Sales Campaigns <span className="text-destructive">*</span>
                        </label>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                          {(segmentForm.filters.campaignIds?.length || (segmentForm.filters.campaignId ? 1 : 0))} Selected
                        </span>
                      </div>

                      {/* Dropdown Trigger Button */}
                      <div className="relative" ref={salesCampaignDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsSalesCampaignDropdownOpen(prev => !prev)}
                          className="w-full h-10 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between shadow-2xs font-medium cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate text-left">
                            <Folder size={14} className="text-primary shrink-0" />
                            <span className={`truncate ${(segmentForm.filters.campaignIds?.length || (segmentForm.filters.campaignId ? 1 : 0)) === 0 ? "text-muted-foreground" : "text-foreground font-bold"}`}>
                              {(segmentForm.filters.campaignIds?.length || (segmentForm.filters.campaignId ? 1 : 0)) === 0
                                ? "Select Sales Campaigns..."
                                : (segmentForm.filters.campaignIds?.length || 1) === 1
                                  ? getSalesCampaignName(salesCampaigns.find(c => (segmentForm.filters.campaignIds || []).includes(c._id) || segmentForm.filters.campaignId === c._id))
                                  : `${segmentForm.filters.campaignIds?.length || 1} Campaigns Selected`}
                            </span>
                          </div>
                          <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isSalesCampaignDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {/* Dropdown Popover Panel */}
                        {isSalesCampaignDropdownOpen && (
                          <div className="absolute z-50 left-0 right-0 mt-1 p-2 bg-card border rounded-2xl shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                            {/* Search & Actions inside Dropdown */}
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                  id="sales-campaign-search-input"
                                  name="sales_campaign_search"
                                  aria-label="Search sales campaigns"
                                  type="text"
                                  placeholder="Search campaigns..."
                                  value={salesCampaignSearch}
                                  onChange={e => setSalesCampaignSearch(e.target.value)}
                                  className="!pl-8 pr-2 h-7.5 input-field text-xs w-full bg-background"
                                  autoFocus
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const allFilteredIds = filteredSalesCampaigns.map(c => c._id);
                                  setSegmentForm(prev => ({
                                    ...prev,
                                    filters: {
                                      ...prev.filters,
                                      campaignIds: Array.from(new Set([...(prev.filters.campaignIds || []), ...allFilteredIds])),
                                      campaignId: allFilteredIds[0] || prev.filters.campaignId
                                    }
                                  }));
                                }}
                                className="text-[10px] text-primary hover:underline font-semibold shrink-0 cursor-pointer"
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSegmentForm(prev => ({
                                    ...prev,
                                    filters: {
                                      ...prev.filters,
                                      campaignIds: [],
                                      campaignId: ""
                                    }
                                  }));
                                }}
                                className="text-[10px] text-destructive hover:underline font-semibold shrink-0 cursor-pointer"
                              >
                                Clear
                              </button>
                            </div>

                            {/* Checkbox List */}
                            <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                              {salesCampaigns.length === 0 ? (
                                <p className="text-center py-4 text-xs text-muted-foreground">No campaigns found.</p>
                              ) : filteredSalesCampaigns.length === 0 ? (
                                <p className="text-center py-4 text-xs text-muted-foreground">No matching campaigns.</p>
                              ) : (
                                filteredSalesCampaigns.map(camp => {
                                  const isChecked = (segmentForm.filters.campaignIds || []).includes(camp._id) || segmentForm.filters.campaignId === camp._id;
                                  const campName = getSalesCampaignName(camp);
                                  return (
                                    <label
                                      key={camp._id}
                                      className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${isChecked
                                          ? "bg-primary/10 border-primary/40 font-bold text-foreground shadow-2xs"
                                          : "border-transparent hover:bg-accent/40 text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                      <input
                                        id={`sales-campaign-check-${camp._id}`}
                                        name="sales_campaign_id"
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          const current = segmentForm.filters.campaignIds || (segmentForm.filters.campaignId ? [segmentForm.filters.campaignId] : []);
                                          const updated = isChecked ? current.filter(id => id !== camp._id) : [...current, camp._id];
                                          setSegmentForm({
                                            ...segmentForm,
                                            filters: {
                                              ...segmentForm.filters,
                                              campaignIds: updated,
                                              campaignId: updated[0] || ""
                                            }
                                          });
                                        }}
                                        className="rounded border-input text-primary focus:ring-primary h-4 w-4 shrink-0 cursor-pointer"
                                      />
                                      <Folder className={`h-3.5 w-3.5 shrink-0 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
                                      <span className="truncate flex-1 text-left">{campName}</span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Selected Campaign Removable Chips */}
                      {(segmentForm.filters.campaignIds?.length || (segmentForm.filters.campaignId ? 1 : 0)) > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {salesCampaigns
                            .filter(c => (segmentForm.filters.campaignIds || []).includes(c._id) || segmentForm.filters.campaignId === c._id)
                            .map(c => {
                              const cName = getSalesCampaignName(c);
                              return (
                                <span
                                  key={c._id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold shadow-2xs"
                                >
                                  <Folder size={10} />
                                  <span className="max-w-[140px] truncate">{cName}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const current = segmentForm.filters.campaignIds || (segmentForm.filters.campaignId ? [segmentForm.filters.campaignId] : []);
                                      const updated = current.filter(id => id !== c._id);
                                      setSegmentForm({
                                        ...segmentForm,
                                        filters: {
                                          ...segmentForm.filters,
                                          campaignIds: updated,
                                          campaignId: updated[0] || ""
                                        }
                                      });
                                    }}
                                    className="hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                                  >
                                    <X size={11} />
                                  </button>
                                </span>
                              );
                            })}
                        </div>
                      )}
                    </div>
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
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="campaign-preview-search-input"
                        name="campaign_preview_search"
                        aria-label="Filter contacts by name or email"
                        type="text"
                        placeholder="Filter contacts by name or email..."
                        value={campaignPreviewSearch}
                        onChange={e => setCampaignPreviewSearch(e.target.value)}
                        className="!pl-9 pr-3 h-8.5 input-field text-xs w-full"
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
                    <div className="min-h-[380px] max-h-[460px] overflow-y-auto border border-border rounded-xl p-2.5 space-y-1.5 bg-accent/5 custom-scrollbar flex-1">
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
                              className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${isSelected
                                ? "bg-amber-500/5 border-amber-500/20 text-foreground"
                                : "hover:bg-accent/30 border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            >
                              <input
                                id={`campaign-preview-check-${idx}`}
                                name="campaign_preview_contact"
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => { }}
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
              ) : segmentTab === "marketing" || (segmentForm.type === "marketing" && !editingSegmentId) ? (
                /* Marketing List Tab Panel */
                <div className="space-y-3.5 border-t pt-4 animate-in fade-in duration-200 text-left">
                  {/* Header & Description */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-500" /> Marketing List Contacts
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Select parent names and emails from the marketing database. All active opted-in parents are available below.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        {selectedMarketingIds.length} / {marketingListContacts.length} Selected
                      </span>
                    </div>
                  </div>

                  {/* Guaranteed Opt-Out / Unsubscribe Compliance Notice */}
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed text-emerald-950 dark:text-emerald-200">
                      <strong className="font-semibold text-emerald-800 dark:text-emerald-300">Opt-Out & Unsubscribe Protection Active:</strong> Any parent who has unsubscribed or opted out has been strictly excluded from this list and cannot be imported. Only parents with verified active consent are eligible.
                    </div>
                  </div>

                  {/* Channel Filter Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mr-1">Filter Channel:</span>
                    {[
                      { id: "all", label: "All Contacts", count: marketingChannelCounts.all, activeClass: "bg-primary text-white shadow-xs font-bold" },
                      { id: "mobile", label: "Mobile", count: marketingChannelCounts.mobile, icon: Smartphone, activeClass: "bg-violet-600 text-white shadow-xs font-bold" },
                      { id: "web_portal", label: "Web Portal", count: marketingChannelCounts.web_portal, icon: Globe, activeClass: "bg-sky-600 text-white shadow-xs font-bold" },
                      { id: "afterschool", label: "After School", count: marketingChannelCounts.afterschool, icon: GraduationCap, activeClass: "bg-amber-600 text-white shadow-xs font-bold" },
                      { id: "manual", label: "Manual", count: marketingChannelCounts.manual, icon: UserPlus, activeClass: "bg-emerald-600 text-white shadow-xs font-bold" }
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = marketingChannelFilter === tab.id || (tab.id === "all" && !marketingChannelFilter);
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setMarketingChannelFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${isActive
                              ? tab.activeClass
                              : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70"
                            }`}
                        >
                          {Icon && <Icon size={12} />}
                          <span>{tab.label} ({tab.count})</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search and Bulk Selection Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <input
                        id="marketing-contacts-search-input"
                        name="marketing_contacts_search"
                        aria-label="Search marketing contacts by name, email, school, or location"
                        type="text"
                        placeholder="Search by parent name, email, school, or location..."
                        value={marketingSearchQuery}
                        onChange={e => setMarketingSearchQuery(e.target.value)}
                        className="!pl-9 pr-8 h-9 input-field text-xs w-full bg-card"
                      />
                      {marketingSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMarketingSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredIds = filteredMarketingContacts.map(c => c._id);
                          setSelectedMarketingIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                        }}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Select All Filtered ({filteredMarketingContacts.length})
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          const allFilteredIds = filteredMarketingContacts.map(c => c._id);
                          setSelectedMarketingIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                        }}
                        className="text-[11px] font-bold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                      >
                        Deselect All Filtered
                      </button>
                    </div>
                  </div>

                  {/* Contacts Checklist List Container */}
                  <div className="min-h-[380px] max-h-[460px] overflow-y-auto border border-border rounded-xl p-2.5 space-y-2 bg-accent/5 custom-scrollbar flex-1">
                    {loadingMarketingContacts ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                        <Loader2 className="animate-spin text-primary h-6 w-6" />
                        <span className="text-xs">Loading marketing contacts...</span>
                      </div>
                    ) : marketingListContacts.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground space-y-1">
                        <ShieldCheck size={28} className="mx-auto opacity-30 text-emerald-500" />
                        <p className="text-xs font-semibold">No active subscribed marketing contacts found.</p>
                        <p className="text-[11px]">Parents will appear here once captured through marketing channels.</p>
                      </div>
                    ) : filteredMarketingContacts.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground text-xs">
                        {marketingSearchQuery.trim()
                          ? `No contacts found matching "${marketingSearchQuery}".`
                          : "No contacts found for the selected channel."}
                      </div>
                    ) : (
                      filteredMarketingContacts.map((contact, idx) => {
                        const isSelected = selectedMarketingIds.includes(contact._id);
                        const channelInfo = getMarketingChannelInfo(contact.source, contact.entryPoint);
                        const contextDetail =
                          contact.schoolName || contact.locationName || (contact.source && contact.source !== channelInfo.label ? contact.source : "");

                        return (
                          <div
                            key={contact._id || idx}
                            onClick={() => {
                              setSelectedMarketingIds(prev =>
                                prev.includes(contact._id)
                                  ? prev.filter(id => id !== contact._id)
                                  : [...prev, contact._id]
                              );
                            }}
                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors border ${isSelected
                                ? "bg-card border-border/80 shadow-2xs text-foreground"
                                : "hover:bg-accent/30 border-transparent text-muted-foreground hover:text-foreground opacity-75"
                              }`}
                          >
                            <input
                              id={`marketing-contact-check-${idx}`}
                              name="marketing_contact_check"
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => { }}
                              className="rounded border-input text-primary focus:ring-primary h-4 w-4 shrink-0 pointer-events-none cursor-pointer"
                            />
                            <div className="flex-1 min-w-0 text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs truncate text-foreground">
                                  {contact.name || "Parent Contact"}
                                </span>
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1 ${channelInfo.badgeColor}`}>
                                  {channelInfo.icon === "smartphone" && <Smartphone size={10} />}
                                  {channelInfo.icon === "globe" && <Globe size={10} />}
                                  {channelInfo.icon === "graduation-cap" && <GraduationCap size={10} />}
                                  {channelInfo.icon === "user-plus" && <UserPlus size={10} />}
                                  {channelInfo.icon === "sparkles" && <Sparkles size={10} />}
                                  {channelInfo.label}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                <span className="font-mono text-foreground/80">{contact.email}</span>
                                {contact.phone && (
                                  <span className="opacity-75">• {contact.phone}</span>
                                )}
                                {contextDetail && (
                                  <span className="opacity-75 truncate">• {contextDetail}</span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              <ShieldCheck size={11} />
                              <span>Subscribed</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* Dynamic Rule Filters Single Column */
                <div className="space-y-3 pt-2 border-t animate-in fade-in duration-200">
                  <h4 className="text-xs font-bold uppercase text-primary">Dynamic Rule Filters</h4>

                  <div className="grid gap-1">
                    <label htmlFor="dynamic-filter-source" className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer">Source Filter</label>
                    <input
                      id="dynamic-filter-source"
                      name="dynamic_filter_source"
                      aria-label="Filter by source"
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
                    <label htmlFor="dynamic-filter-location" className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer">Location/City Filter</label>
                    <input
                      id="dynamic-filter-location"
                      name="dynamic_filter_location"
                      aria-label="Filter by location"
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
                    <label htmlFor="dynamic-filter-status" className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer">Lead Status Filter</label>
                    <select
                      id="dynamic-filter-status"
                      name="dynamic_filter_status"
                      aria-label="Filter by lead status"
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
                  onClick={() => {
                    resetSegmentModalState();
                    setIsSegmentModalOpen(false);
                  }}
                  className="btn-secondary text-xs h-9"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary text-xs h-9 bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1.5 text-white shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  ) : editingSegmentId ? (
                    <><Check size={14} /> Save Changes ({selectionBreakdown.totalUnique} Recipients)</>
                  ) : (
                    <>Save Segment</>
                  )}
                </button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 3: IMPORT CSV RECIPIENTS MODAL --- */}
      <Dialog open={isImportModalOpen} onOpenChange={(open) => { if (!open) resetImportModalState(); setIsImportModalOpen(open); }}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] p-0 flex flex-col overflow-hidden dark:bg-card">
          <DialogHeader className="p-5 pb-3 border-b shrink-0 bg-card">
            <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Upload className="text-primary h-5 w-5" />
              <span>Import Email List via CSV</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Upload a CSV file to create a recipient list. Contacts will be parsed, validated, and deduplicated automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCsvImport} className="p-5 flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
            <div className="grid gap-1 shrink-0">
              <label htmlFor="import-segment-name-input" className="text-xs font-bold text-muted-foreground uppercase cursor-pointer">
                List & Segment Name <span className="text-destructive">*</span>
              </label>
              <input
                id="import-segment-name-input"
                name="import_segment_name"
                type="text"
                placeholder="e.g. High School Soccer Coach List"
                className="input-field text-sm"
                value={importSegmentName}
                onChange={e => setImportSegmentName(e.target.value)}
                required
              />
            </div>

            {/* 2-Column CSV Loader & Contact Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 min-h-0 border-t pt-4">
              {/* Left Column: File Dropzone */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <label htmlFor="import-csv-file-input" className="text-xs font-bold text-muted-foreground uppercase cursor-pointer">
                    CSV File <span className="text-destructive">*</span>
                  </label>
                  <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-6 text-center space-y-3 transition-colors bg-accent/5 cursor-pointer relative">
                    <input
                      id="import-csv-file-input"
                      name="import_csv_file"
                      type="file"
                      accept=".csv"
                      onChange={handleImportModalCsvSelect}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Upload size={20} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold block text-foreground">
                        {importFile ? importFile.name : "Click to select CSV File"}
                      </span>
                      <p className="text-[10px] text-muted-foreground">Headers like "Email" and "Name" are auto-detected</p>
                    </div>
                  </div>
                </div>

                {importCsvParsedContacts.length > 0 && (
                  <div className="p-3 border rounded-xl bg-emerald-500/5 border-emerald-500/20 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate">{importFile?.name}</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                        {importCsvParsedContacts.length} Contacts Found
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Searchable Contact Checklist */}
              <div className="space-y-2.5 flex flex-col h-full min-h-0 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-5">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase text-primary">Contacts Checklist</h4>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                    {importCsvSelectedEmails.length} / {importCsvParsedContacts.length} Selected
                  </span>
                </div>

                {/* Search */}
                <div className="relative flex items-center">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    id="import-csv-search-input"
                    name="import_csv_search"
                    aria-label="Filter parsed contacts"
                    type="text"
                    placeholder="Filter parsed contacts..."
                    value={importCsvSearchQuery}
                    onChange={e => setImportCsvSearchQuery(e.target.value)}
                    className="!pl-9 pr-3 h-8.5 input-field text-xs w-full"
                  />
                </div>

                {/* Select All / Deselect All */}
                <div className="flex justify-between gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      const allFiltered = filteredImportCsvContacts.map(c => c.email);
                      setImportCsvSelectedEmails(prev => Array.from(new Set([...prev, ...allFiltered])));
                    }}
                    className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Select All Filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allFiltered = filteredImportCsvContacts.map(c => c.email);
                      setImportCsvSelectedEmails(prev => prev.filter(email => !allFiltered.includes(email)));
                    }}
                    className="text-[10px] text-destructive hover:underline font-semibold cursor-pointer"
                  >
                    Deselect All Filtered
                  </button>
                </div>

                {/* Scrollable list */}
                <div className="flex-1 min-h-[160px] max-h-56 overflow-y-auto border rounded-xl p-2 space-y-1 bg-accent/5 custom-scrollbar">
                  {importCsvParsedContacts.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-10">Select a CSV file to preview contacts.</p>
                  ) : filteredImportCsvContacts.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-10">No contacts matching filter.</p>
                  ) : (
                    filteredImportCsvContacts.map((contact, idx) => {
                      const isSelected = importCsvSelectedEmails.includes(contact.email);
                      return (
                        <div
                          key={contact.email || idx}
                          onClick={() => {
                            setImportCsvSelectedEmails(prev =>
                              prev.includes(contact.email)
                                ? prev.filter(e => e !== contact.email)
                                : [...prev, contact.email]
                            );
                          }}
                          className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${isSelected
                            ? "bg-primary/5 border-primary/20 text-foreground"
                            : "hover:bg-accent/30 border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          <input
                            id={`import-csv-contact-check-${idx}`}
                            name="import_csv_contact_email"
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => { }}
                            className="rounded mt-0.5 pointer-events-none shrink-0"
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-1.5 justify-between">
                              <span className="font-bold text-xs truncate text-foreground leading-tight">
                                {contact.name}
                              </span>
                              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary shrink-0">
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

            <DialogFooter className="pt-3 border-t flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  resetImportModalState();
                  setIsImportModalOpen(false);
                }}
                className="btn-secondary text-xs h-9 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || importCsvSelectedEmails.length === 0}
                className="btn-primary text-xs h-9 px-4 bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1 text-white shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Importing...</>
                ) : (
                  <>Import {importCsvSelectedEmails.length} Contacts</>
                )}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 4: CAMPAIGN PERFORMANCE & RECIPIENT TRACKING INSPECTOR --- */}
      <Dialog open={isViewStatsOpen} onOpenChange={setIsViewStatsOpen}>
        <DialogContent className={`w-[96vw] ${isStatsModalExpanded ? 'max-w-6xl h-[94vh]' : 'max-w-3xl max-h-[85vh]'} p-0 flex flex-col overflow-hidden dark:bg-card transition-all duration-300`}>
          <DialogHeader className="p-5 pb-3 pr-12 border-b shrink-0 flex flex-row items-center justify-between bg-card relative">
            <div className="text-left space-y-1.5 min-w-0">
              <DialogTitle className="text-base flex items-center gap-2.5 text-foreground font-extrabold tracking-tight">
                <BarChart3 className="text-primary h-5 w-5 shrink-0" />
                <span>{selectedCampaign?.title || "Campaign Analytics"}</span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-extrabold uppercase border shrink-0 ${selectedCampaign?.status === "sent" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                  selectedCampaign?.status === "scheduled" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                    "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}>
                  {selectedCampaign?.status || "draft"}
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate">
                Subject: <span className="font-semibold text-foreground">{selectedCampaign?.subject}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 mr-4">
              {/* Full View Toggle */}
              <button
                type="button"
                onClick={() => setIsStatsModalExpanded(!isStatsModalExpanded)}
                className="btn-secondary text-xs h-8.5 px-3 flex items-center gap-1.5 font-bold transition-all shadow-xs border shrink-0 cursor-pointer"
                title={isStatsModalExpanded ? "Compact View" : "Full View (Expand)"}
              >
                {isStatsModalExpanded ? (
                  <><Minimize2 size={13} /> Compact View</>
                ) : (
                  <><Maximize2 size={13} /> Full View</>
                )}
              </button>

              {selectedCampaign && selectedCampaign.recipientLogs && selectedCampaign.recipientLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleExportCampaignData(selectedCampaign)}
                  className="btn-secondary text-xs h-8.5 px-3.5 flex items-center gap-1.5 font-bold transition-all shadow-xs border shrink-0"
                  title="Export Campaign Data (CSV)"
                >
                  <Upload size={14} /> Export CSV
                </button>
              )}
            </div>
          </DialogHeader>

          {selectedCampaign && (
            <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
              {/* Campaign Meta & Template Banner */}
              {(() => {
                const tplObj: any = (typeof selectedCampaign.templateId === 'object' && selectedCampaign.templateId !== null)
                  ? selectedCampaign.templateId
                  : templates.find(t => t._id === selectedCampaign.templateId);

                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-card border rounded-xl shadow-2xs shrink-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground font-semibold">Target List(s) &amp; Locations:</span>
                      {selectedCampaign.segmentIds && selectedCampaign.segmentIds.length > 1 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {selectedCampaign.segmentIds.map((s, idx) => (
                            <span key={s._id || idx} className="font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md text-[11px]">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-bold text-foreground bg-accent/40 px-2 py-0.5 rounded-md">
                          {selectedCampaign.segmentId?.name || "All Contacts"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground font-semibold">Template Used:</span>
                      {tplObj ? (
                        <button
                          type="button"
                          onClick={() => handleOpenTemplateDirectly(selectedCampaign.templateId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/20 transition-all cursor-pointer shadow-2xs group/tpl"
                          title="Click to view template preview directly"
                        >
                          <FileText size={12} className="text-violet-600 dark:text-violet-400" />
                          <span className="font-bold">{tplObj.name}</span>
                          <Eye size={11} className="group-hover/tpl:scale-110 transition-transform" />
                        </button>
                      ) : (
                        <span className="text-muted-foreground italic bg-accent/20 px-2 py-0.5 rounded-md">
                          Custom / Blank Email
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Top 5 KPI Summary Cards Grid, Filter Pills & Recipient Logs (Computed with Email Funnel Hierarchy) */}
              {(() => {
                const stats = getCampaignFunnelStats(selectedCampaign);
                const allCount = stats.sentCount;
                const bounceCount = stats.bounceCount;
                const unsubCount = stats.unsubCount;
                const clickCount = stats.clickCount;
                const openCount = stats.openCount;
                const delCount = stats.delCount;
                const sentCount = stats.sentCount;

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 shrink-0">
                      {[
                        { label: "Sent", val: sentCount, icon: Mail, color: "text-zinc-500", bg: "bg-zinc-500/10" },
                        { label: "Delivered", val: delCount, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                        { label: "Opens", val: openCount, icon: Eye, color: "text-blue-500", bg: "bg-blue-500/10" },
                        { label: "Clicks", val: clickCount, icon: MousePointerClick, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                        { label: "Unsubscribed", val: unsubCount, icon: UserX, color: "text-amber-500", bg: "bg-amber-500/10" },
                        { label: "Bounced", val: bounceCount, icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10" }
                      ].map(stat => (
                        <div key={stat.label} className="border border-border/80 rounded-xl p-2.5 sm:p-3 bg-card text-left flex flex-col justify-between shadow-2xs overflow-hidden min-w-0">
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <span className="text-[9.5px] sm:text-[10px] uppercase font-extrabold text-muted-foreground truncate min-w-0 tracking-tight" title={stat.label}>
                              {stat.label}
                            </span>
                            <div className={`p-1 sm:p-1.5 rounded-lg shrink-0 ${stat.bg}`}>
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
                            id="campaign-recipient-search-input"
                            name="campaign_recipient_search"
                            aria-label="Filter campaign recipients by name or email"
                            type="text"
                            placeholder="Filter campaign recipients by name or email..."
                            value={campaignRecipientSearch}
                            onChange={e => setCampaignRecipientSearch(e.target.value)}
                            className="h-8.5 input-field text-xs w-full dark:bg-card"
                            style={{ paddingLeft: "2.25rem" }}
                          />
                        </div>

                        {/* Filter Category Pills */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px] shrink-0">
                          {[
                            { id: "all", label: `All (${allCount})` },
                            { id: "open", label: `Opened (${openCount})` },
                            { id: "click", label: `Clicked (${clickCount})` },
                            { id: "unsubscribe", label: `Unsubscribed (${unsubCount})` },
                            { id: "bounce", label: `Bounced (${bounceCount})` }
                          ].map(tab => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setCampaignRecipientFilter(tab.id as any)}
                              className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${campaignRecipientFilter === tab.id
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
                      <div className={`flex-1 border rounded-2xl overflow-y-auto custom-scrollbar bg-accent/5 p-3 space-y-2 ${isStatsModalExpanded ? 'min-h-[420px]' : 'min-h-[220px]'}`}>
                        {!selectedCampaign.recipientLogs || selectedCampaign.recipientLogs.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                            <Mail size={36} className="opacity-40 mb-2" />
                            <p className="text-xs font-semibold">No recipient logs found for this campaign.</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Logs will populate automatically when the campaign is sent.</p>
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

                            const isBouncedOrBlocked = isLogBounced(log);
                            const isUnsubscribed = !isBouncedOrBlocked && (log.status === "unsubscribe" || log.status === "unsubscribed");
                            const isClicked = !isBouncedOrBlocked && (log.status === "click" || log.status === "clicked" || isUnsubscribed);
                            const isOpened = !isBouncedOrBlocked && (log.status === "open" || log.status === "opened" || isClicked || isUnsubscribed);
                            const isDelivered = !isBouncedOrBlocked;
                            const formattedError = formatLogErrorMessage(log.error);

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
                                    {formattedError && (
                                      <span className="text-[10px] text-rose-500 font-semibold block truncate mt-0.5" title={log.error || formattedError}>
                                        ⚠️ {formattedError}
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
                                  {isBouncedOrBlocked ? (
                                    <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-rose-500/10 text-rose-500 border-rose-500/20">
                                      Bounced
                                    </span>
                                  ) : (
                                    <>
                                      <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                        Delivered
                                      </span>

                                      <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${isOpened ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : "bg-accent/40 text-muted-foreground border-border/50"
                                        }`}>
                                        {isOpened ? "Opened" : "Not Opened"}
                                      </span>

                                      {isClicked && (
                                        <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                          Clicked Link
                                        </span>
                                      )}

                                      {isUnsubscribed && (
                                        <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                          Unsubscribed
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <DialogFooter className="p-4 px-6 border-t bg-card shrink-0 flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                setCampaignToDelete(selectedCampaign);
                setIsDeleteCampaignModalOpen(true);
              }}
              className="btn-secondary text-xs h-8.5 px-4 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center gap-1.5 transition-all cursor-pointer"
              title="Delete Campaign"
            >
              <Trash2 size={13} /> Delete Campaign
            </button>
            <button
              type="button"
              onClick={() => setIsViewStatsOpen(false)}
              className="btn-secondary text-xs h-8.5 px-4 font-bold"
            >
              Close Analytics
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 5: VIEW SEGMENT RECIPIENTS DIALOG --- */}
      <Dialog open={isViewSegmentModalOpen} onOpenChange={setIsViewSegmentModalOpen}>
        <DialogContent className={`w-[95vw] ${isSegmentModalExpanded ? 'max-w-6xl h-[94vh]' : 'max-w-2xl max-h-[85vh]'} p-0 flex flex-col overflow-hidden dark:bg-card transition-all duration-300`}>
          <DialogHeader className="p-5 pb-3 border-b shrink-0 flex flex-row items-center justify-between bg-card relative">
            <div className="text-left space-y-1 min-w-0 pr-6">
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-base flex items-center gap-2 text-foreground font-extrabold tracking-tight">
                  <Users className="text-primary h-5 w-5 shrink-0" />
                  {selectedSegmentForView?.name || "Segment Contacts"}
                </DialogTitle>
                {selectedSegmentForView && getSegmentBadge(selectedSegmentForView)}
              </div>
              {selectedSegmentForView?.description && (
                <p className="text-xs text-muted-foreground truncate">{selectedSegmentForView.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 mr-6">
              <button
                type="button"
                onClick={() => setIsSegmentModalExpanded(!isSegmentModalExpanded)}
                className="btn-secondary text-xs h-8.5 px-3 flex items-center gap-1.5 font-bold transition-all shadow-xs border shrink-0 cursor-pointer"
                title={isSegmentModalExpanded ? "Compact View" : "Full View (Expand)"}
              >
                {isSegmentModalExpanded ? (
                  <><Minimize2 size={13} /> Compact View</>
                ) : (
                  <><Maximize2 size={13} /> Full View</>
                )}
              </button>
            </div>
          </DialogHeader>

          <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
            {/* Search filter bar & Stats */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="view-segment-search-input"
                  name="view_segment_search"
                  aria-label="Filter recipients by name or email"
                  type="text"
                  placeholder="Filter recipients by name or email..."
                  value={viewSegmentSearchQuery}
                  onChange={e => setViewSegmentSearchQuery(e.target.value)}
                  className="!pl-9 h-9 input-field text-xs w-full dark:bg-card"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSegmentForView) {
                      handleOpenAddContactModal(selectedSegmentForView._id);
                    }
                  }}
                  className="h-8.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  title="Add individual or bulk contacts to this list"
                >
                  <UserPlus size={12} /> Add Contact
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSegmentForView) {
                      handleOpenEditSegment(selectedSegmentForView);
                    }
                  }}
                  className="h-8.5 px-3 bg-accent/60 hover:bg-accent text-foreground border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Edit2 size={12} /> Edit Full List
                </button>
                <span className="text-xs font-bold text-muted-foreground px-3.5 py-1.5 bg-accent/30 rounded-xl border border-border/50 text-left sm:text-right">
                  Saved Contacts: <strong className="text-primary font-extrabold">{selectedSegmentForView?.contacts?.length || 0}</strong>
                </span>
              </div>
            </div>

            {/* Contacts Cards Grid / Scrollable List */}
            <div className={`flex-1 border rounded-2xl overflow-y-auto custom-scrollbar bg-accent/5 p-3 space-y-2 ${isSegmentModalExpanded ? 'min-h-[460px]' : 'min-h-[220px]'}`}>
              {!selectedSegmentForView?.contacts || selectedSegmentForView.contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                  <UserX size={36} className="opacity-40 mb-2" />
                  <p className="text-xs font-semibold">No contacts saved in this segment.</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Click "Edit Full List" above to add or import recipients.</p>
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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground block truncate">{displayName}</span>
                            {contact.registrationCount && contact.registrationCount > 1 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold border border-primary/20 shrink-0" title={`Registered ${contact.registrationCount} times (Deduplicated)`}>
                                {contact.registrationCount}x Registered
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap mt-0.5">
                            <span className="truncate">{contact.email}</span>
                            {contact.phone && (
                              <>
                                <span className="opacity-40">•</span>
                                <span className="text-foreground/80 font-medium">{contact.phone}</span>
                              </>
                            )}
                            {(contact.school || contact.location) && (
                              <>
                                <span className="opacity-40">•</span>
                                <span className="text-primary font-medium">{contact.school || contact.location}</span>
                              </>
                            )}
                            {contact.source && (
                              <>
                                <span className="opacity-40">•</span>
                                <span className="text-muted-foreground text-[10px]">{contact.source}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(contact.email)}
                          className="h-7.5 w-7.5 p-0 text-muted-foreground hover:text-primary hover:bg-accent/40 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          title="Copy email address"
                        >
                          {isCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                        <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shrink-0 border flex items-center gap-1 ${contact.status === "active" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                          }`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          {contact.status || "active"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveContactFromViewSegment(contact.email)}
                          className="h-7.5 w-7.5 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove recipient from list"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-card shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Total Contacts: <strong className="text-foreground">{selectedSegmentForView?.contacts?.length || 0}</strong>
            </span>
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

      {/* --- DIALOG: ADD CONTACT(S) TO LIST (PROFESSIONAL TWO-PANEL WORKFLOW) --- */}
      <Dialog open={isAddContactModalOpen} onOpenChange={setIsAddContactModalOpen}>
        <DialogContent className="w-[96vw] max-w-5xl xl:max-w-6xl max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-3xl border shadow-2xl bg-card">
          {/* Top Modal Header */}
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b shrink-0 bg-card">
            <div className="flex items-center gap-3 text-left">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs">
                <UserPlus size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-black tracking-tight text-foreground truncate">
                  Add Contact(s) to List
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Step 1: Select target list(s) on the left &bull; Step 2: Choose contact addition method on the right.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Modal Body: Integrated Two-Panel Layout */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden text-left divide-y lg:divide-y-0 lg:divide-x divide-border/60">
            {/* ================= LEFT PANEL: TARGET LISTS SIDEBAR (~32% WIDTH) ================= */}
            <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 bg-muted/15 flex flex-col min-h-0 p-4 sm:p-5 space-y-3">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider border border-emerald-500/30 shrink-0">
                    Step 1
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                      <List size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Target List(s) <span className="text-destructive">*</span>
                    </h4>
                  </div>
                </div>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-lg font-extrabold border shrink-0 ${
                  addContactTargetSegmentIds.length === 0
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                }`}>
                  {addContactTargetSegmentIds.length} Selected
                </span>
              </div>

              {/* Direct Embedded Search & Bulk Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search lists (A–Z)..."
                    value={addContactListSearch}
                    onChange={(e) => setAddContactListSearch(e.target.value)}
                    className="!pl-8 pr-2 h-8.5 input-field text-xs w-full bg-background"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const allFilteredIds = filteredAlphabetizedSegments.map(s => s._id);
                    setAddContactTargetSegmentIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                  }}
                  className="text-[11px] text-primary hover:underline font-bold shrink-0 cursor-pointer px-1"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setAddContactTargetSegmentIds([])}
                  className="text-[11px] text-destructive hover:underline font-bold shrink-0 cursor-pointer px-1"
                >
                  Clear
                </button>
              </div>

              {/* Scrollable List of Lists with Checkmarks */}
              <div className="flex-1 min-h-[180px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                {alphabetizedSegments.length === 0 ? (
                  <p className="text-center py-6 text-xs text-muted-foreground">No lists available in system.</p>
                ) : filteredAlphabetizedSegments.length === 0 ? (
                  <p className="text-center py-6 text-xs text-muted-foreground">No lists match search filter.</p>
                ) : (
                  filteredAlphabetizedSegments.map((seg) => {
                    const isChecked = addContactTargetSegmentIds.includes(seg._id);
                    return (
                      <label
                        key={seg._id}
                        className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-emerald-500/10 border-emerald-500/40 font-bold text-foreground shadow-2xs"
                            : "border-border/60 bg-background/70 hover:bg-accent/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setAddContactTargetSegmentIds(prev =>
                                isChecked ? prev.filter(id => id !== seg._id) : [...prev, seg._id]
                              );
                            }}
                            className="rounded border-input text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1 text-left">
                            <span className="truncate block text-xs font-semibold">{seg.name}</span>
                            {seg.category && (
                              <span className="text-[10px] text-muted-foreground font-normal truncate block">
                                {seg.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 border ${
                          isChecked
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-accent/60 text-muted-foreground border-border/50"
                        }`}>
                          {seg.contacts?.length || 0}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Sidebar Bottom Summary */}
              <div className="pt-2 border-t border-border/60 shrink-0 space-y-2">
                {addContactTargetSegments.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span>Target Lists: <strong className="text-emerald-600 dark:text-emerald-400">{addContactTargetSegments.length}</strong></span>
                      <span>Contacts: <strong className="text-foreground">{addContactTargetEmailSet.size}</strong></span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar p-0.5">
                      {addContactTargetSegments.map((seg) => (
                        <span
                          key={seg._id}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-background border border-emerald-500/30 text-foreground"
                        >
                          <span className="truncate max-w-[120px]">{seg.name}</span>
                          <button
                            type="button"
                            onClick={() => setAddContactTargetSegmentIds(prev => prev.filter(id => id !== seg._id))}
                            className="hover:text-destructive text-muted-foreground p-0.5 rounded-full transition-colors cursor-pointer"
                            title="Remove list"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Select at least one list above to proceed.</span>
                  </div>
                )}
              </div>
            </div>

            {/* ================= RIGHT PANEL: CONTACT ADDITION WORKSPACE (~68% WIDTH) ================= */}
            <div className="flex-1 min-w-0 bg-card flex flex-col min-h-0 p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-4">
              {/* Context Header with Active Target Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-wider border border-blue-500/30 shrink-0">
                    Step 2
                  </span>
                  <div>
                    <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                      <UserPlus size={15} className="text-blue-600 dark:text-blue-400" />
                      Add Contact(s)
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Choose an addition method and enter details or pick contacts.
                    </p>
                  </div>
                </div>

                {/* Live Target Context Badge */}
                {addContactTargetSegments.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground font-medium">Adding to:</span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                      {addContactTargetSegments.length === 1
                        ? addContactTargetSegments[0].name
                        : `${addContactTargetSegments[0].name} +${addContactTargetSegments.length - 1} more`}
                    </span>
                  </div>
                )}
              </div>

              {/* Addition Method Switcher (Sleek Segmented Tabs) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setAddContactMode("individual")}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                    addContactMode === "individual"
                      ? "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 shadow-2xs ring-1 ring-blue-500/20"
                      : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${addContactMode === "individual" ? "bg-blue-500 text-white" : "bg-accent text-muted-foreground"}`}>
                    <UserPlus size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs">1. Single Contact</div>
                    <div className="text-[10px] font-normal opacity-80 mt-0.5 truncate">Manual entry form</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAddContactMode("crm");
                    if (availableContacts.length === 0) fetchAvailableContacts();
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                    addContactMode === "crm"
                      ? "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 shadow-2xs ring-1 ring-blue-500/20"
                      : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${addContactMode === "crm" ? "bg-blue-500 text-white" : "bg-accent text-muted-foreground"}`}>
                    <Users size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs">2. CRM Database ({addContactCrmSelectedIds.length})</div>
                    <div className="text-[10px] font-normal opacity-80 mt-0.5 truncate">Pick from leads & team</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAddContactMode("paste")}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer text-left ${
                    addContactMode === "paste"
                      ? "bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 shadow-2xs ring-1 ring-blue-500/20"
                      : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${addContactMode === "paste" ? "bg-blue-500 text-white" : "bg-accent text-muted-foreground"}`}>
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs">3. Paste Emails ({parsedAddContactPastedContacts.length})</div>
                    <div className="text-[10px] font-normal opacity-80 mt-0.5 truncate">Bulk comma/newlines</div>
                  </div>
                </button>
              </div>

              {/* Dynamic Content Workspace */}
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                {/* TAB 1: INDIVIDUAL CONTACT ENTRY */}
                {addContactMode === "individual" && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="add-contact-name-input" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <User size={13} /> Contact Full Name
                        </label>
                        <input
                          id="add-contact-name-input"
                          type="text"
                          placeholder="e.g. Michael Jordan"
                          value={addContactSingleName}
                          onChange={(e) => setAddContactSingleName(e.target.value)}
                          className="input-field text-xs h-10 w-full"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="add-contact-email-input" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Mail size={13} /> Email Address <span className="text-destructive">*</span>
                        </label>
                        <input
                          id="add-contact-email-input"
                          type="email"
                          placeholder="e.g. michael@example.com"
                          value={addContactSingleEmail}
                          onChange={(e) => setAddContactSingleEmail(e.target.value)}
                          required
                          className="input-field text-xs h-10 w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="add-contact-phone-input" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Phone size={13} /> Phone Number (Optional)
                        </label>
                        <input
                          id="add-contact-phone-input"
                          type="tel"
                          placeholder="e.g. (555) 123-4567"
                          value={addContactSinglePhone}
                          onChange={(e) => setAddContactSinglePhone(e.target.value)}
                          className="input-field text-xs h-10 w-full"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="add-contact-source-input" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                          <Folder size={13} /> Source / School / Note
                        </label>
                        <input
                          id="add-contact-source-input"
                          type="text"
                          placeholder="e.g. Manual Entry, Camp Registration"
                          value={addContactSingleSource}
                          onChange={(e) => setAddContactSingleSource(e.target.value)}
                          className="input-field text-xs h-10 w-full"
                        />
                      </div>
                    </div>

                    {addContactSingleEmail.trim() && addContactTargetEmailSet.has(addContactSingleEmail.trim().toLowerCase()) && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs">
                        <AlertTriangle size={15} className="shrink-0" />
                        <span>Notice: This email address is already present in one or more selected lists and duplicate entries will be skipped automatically.</span>
                      </div>
                    )}

                    {/* Live Preview Card (Eliminates awkward empty space and clarifies flow) */}
                    <div className="p-4 rounded-2xl bg-accent/20 border border-border/70 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500" />
                          Ready for Insertion Summary
                        </span>
                        <span className="text-[11px] text-muted-foreground font-normal">
                          {addContactTargetSegmentIds.length} Target List{addContactTargetSegmentIds.length !== 1 ? 's' : ''} Selected
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {addContactSingleEmail.trim()
                          ? `Contact "${addContactSingleName.trim() || addContactSingleEmail.trim()}" <${addContactSingleEmail.trim()}> will be added directly into ${addContactTargetSegmentIds.length} list(s).`
                          : "Enter an email address above to view the contact insertion preview."}
                      </p>
                      <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1 pt-1">
                        <span>🛡️ Opt-out protection: Automatically checked against unsubscribe registry before sending future campaigns.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SELECT FROM CRM DIRECTORY */}
                {addContactMode === "crm" && (
                  <div className="space-y-3 pt-1 flex-1 flex flex-col min-h-0">
                    <div className="flex flex-col sm:flex-row gap-2.5 justify-between sm:items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search CRM contacts by name, email, or role..."
                          value={addContactCrmSearch}
                          onChange={(e) => setAddContactCrmSearch(e.target.value)}
                          className="!pl-9 h-9 input-field text-xs w-full"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {(["all", "main_lead", "ea_lead", "team_member"] as const).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setAddContactCrmCategory(cat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              addContactCrmCategory === cat
                                ? "bg-primary text-white border-primary"
                                : "bg-accent/40 text-muted-foreground hover:text-foreground border-border/60"
                            }`}
                          >
                            {cat === "all" ? "All" : cat === "main_lead" ? "CRM Leads" : cat === "ea_lead" ? "EA Leads" : "Team Members"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/60">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const selectable = filteredAddContactCrmContacts
                              .filter(c => !addContactTargetEmailSet.has(c.email.toLowerCase()))
                              .map(c => c._id);
                            setAddContactCrmSelectedIds(selectable);
                          }}
                          className="text-xs font-bold text-primary hover:underline cursor-pointer"
                        >
                          Select All Filtered
                        </button>
                        <span className="text-muted-foreground">&bull;</span>
                        <button
                          type="button"
                          onClick={() => setAddContactCrmSelectedIds([])}
                          className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground">
                        Selected: <strong className="text-primary font-black">{addContactCrmSelectedIds.length}</strong> Contacts
                      </span>
                    </div>

                    <div className="h-64 sm:h-72 overflow-y-auto custom-scrollbar border rounded-xl divide-y divide-border/60 bg-accent/5">
                      {loadingContacts ? (
                        <div className="flex items-center justify-center h-full py-12">
                          <Loader2 className="animate-spin text-primary h-7 w-7" />
                        </div>
                      ) : filteredAddContactCrmContacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-center text-muted-foreground">
                          <UserX size={36} className="opacity-40 mb-2" />
                          <p className="text-xs font-semibold">No contacts match search filter</p>
                        </div>
                      ) : (
                        filteredAddContactCrmContacts.map((contact) => {
                          const isAlreadyInList = addContactTargetEmailSet.has(contact.email.toLowerCase());
                          const isSelected = addContactCrmSelectedIds.includes(contact._id);

                          return (
                            <div
                              key={contact._id}
                              onClick={() => {
                                if (isAlreadyInList) return;
                                if (isSelected) {
                                  setAddContactCrmSelectedIds(prev => prev.filter(id => id !== contact._id));
                                } else {
                                  setAddContactCrmSelectedIds(prev => [...prev, contact._id]);
                                }
                              }}
                              className={`flex items-center justify-between p-3 text-xs transition-colors cursor-pointer ${
                                isAlreadyInList ? "opacity-50 bg-muted/20 cursor-not-allowed" : isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/30"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isAlreadyInList}
                                  onChange={() => {}}
                                  className="rounded border-border text-primary focus:ring-primary/40 h-4 w-4 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground truncate">{contact.name}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-accent/60 text-muted-foreground font-semibold border border-border/60 shrink-0">
                                      {contact.categoryTag || "Contact"}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-muted-foreground truncate block mt-0.5">{contact.email}</span>
                                </div>
                              </div>

                              {isAlreadyInList ? (
                                <span className="text-[10px] font-bold text-muted-foreground bg-accent/50 px-2.5 py-0.5 rounded-full shrink-0 border">
                                  Already in Selected List
                                </span>
                              ) : contact.phone ? (
                                <span className="text-[11px] text-muted-foreground shrink-0">{contact.phone}</span>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: BULK TEXT PASTE */}
                {addContactMode === "paste" && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <label htmlFor="add-contact-paste-textarea" className="text-xs font-bold text-muted-foreground uppercase flex items-center justify-between">
                        <span>Paste Emails (Comma or Newline Separated)</span>
                        <span className="text-xs text-primary font-bold">
                          Parsed: {parsedAddContactPastedContacts.length} Contacts
                        </span>
                      </label>
                      <textarea
                        id="add-contact-paste-textarea"
                        rows={7}
                        placeholder={"john@example.com, sarah@example.com\n\"David Smith\" <david@example.com>\nemma.watson@gmail.com"}
                        value={addContactPasteText}
                        onChange={(e) => setAddContactPasteText(e.target.value)}
                        className="w-full input-field text-xs p-3.5 font-mono leading-relaxed"
                      />
                    </div>

                    {parsedAddContactPastedContacts.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground">Detected Contacts Preview:</span>
                          <span className="text-muted-foreground text-[11px]">
                            {parsedAddContactPastedContacts.filter(c => addContactTargetEmailSet.has(c.email)).length} already in target list(s)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto custom-scrollbar p-1">
                          {parsedAddContactPastedContacts.map((c, i) => {
                            const inList = addContactTargetEmailSet.has(c.email);
                            return (
                              <span
                                key={i}
                                className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border flex items-center gap-1.5 ${
                                  inList ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" : "bg-primary/10 text-primary border-primary/20"
                                }`}
                              >
                                <span>{c.email}</span>
                                {inList && <span className="text-[10px] opacity-75 font-normal">(in list)</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Unified Modal Footer */}
          <DialogFooter className="p-4 sm:p-5 border-t bg-card shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted-foreground truncate max-w-[360px]">
              {addContactTargetSegmentIds.length === 0 ? (
                <span className="text-destructive font-bold flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Please select at least one list in Step 1 (left panel)
                </span>
              ) : (
                <>Ready to dispatch to <strong className="text-foreground font-black">{addContactTargetSegmentIds.length}</strong> list{addContactTargetSegmentIds.length !== 1 ? "s" : ""}</>
              )}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsAddContactModalOpen(false)}
                className="btn-secondary text-xs h-9 px-4 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingAddContact || addContactTargetSegmentIds.length === 0}
                onClick={() => handleSubmitAddContact()}
                className="h-9 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingAddContact ? (
                  <><Loader2 size={15} className="animate-spin" /> Adding Contacts...</>
                ) : (
                  <><UserPlus size={15} /> Add to {addContactTargetSegmentIds.length > 1 ? `${addContactTargetSegmentIds.length} Lists` : "List"}</>
                )}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 6: UNIFIED MARKETING WEBHOOK INTEGRATION GUIDE --- */}
      <Dialog open={isWebhookGuideOpen} onOpenChange={setIsWebhookGuideOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] p-0 flex flex-col overflow-hidden rounded-2xl border shadow-2xl dark:bg-card">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b shrink-0 bg-card">
            <div className="flex items-center gap-3 text-left">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center shrink-0 border border-purple-500/20 shadow-xs">
                <Code2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-extrabold tracking-tight text-foreground truncate">
                  API Bridge: Unified Marketing Registration Webhook
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  Single webhook endpoint for all platforms (Mobile App, Registration Portal, Evening Inquiries &amp; Admin).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar text-left text-xs">
            {/* Endpoint Pill */}
            <div className="p-3 bg-accent/20 border border-border/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Single Ingestion Webhook URL
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                  POST
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="p-2 bg-background dark:bg-card border rounded-lg font-mono text-xs text-foreground flex-1 select-all break-all shadow-2xs">
                  https://api.yauapp.com/api/webhooks/marketing-registration
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("https://api.yauapp.com/api/webhooks/marketing-registration");
                    setCopiedWebhookPayload("url");
                    toast.success("Webhook URL copied to clipboard!");
                    setTimeout(() => setCopiedWebhookPayload(null), 2000);
                  }}
                  className="btn-secondary h-8 px-2.5 shrink-0 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {copiedWebhookPayload === "url" ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedWebhookPayload === "url" ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Architecture Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 border rounded-xl bg-card space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <CheckCircle size={12} className="text-emerald-500 shrink-0" /> Smart Deduplication
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Same email automatically increments submission count without producing duplicates.
                </p>
              </div>
              <div className="p-3 border rounded-xl bg-card space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <Sparkles size={12} className="text-purple-500 shrink-0" /> Auto CRM List Sync
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Automatically populates matching School, Location, and App segments in Email Center.
                </p>
              </div>
              <div className="p-3 border rounded-xl bg-card space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1 text-[11px]">
                  <Shield size={12} className="text-blue-500 shrink-0" /> Safe Deletion Policy
                </span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  External admin deletions leave your CRM lists and parent contacts 100% intact.
                </p>
              </div>
            </div>

            {/* Sample Payload Schema with Tabs */}
            <div className="border rounded-xl p-3 bg-card space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-accent/40 p-0.5 rounded-lg border text-[11px] overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("full")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "full" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Full Schema
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("school")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "school" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🏫 School
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("location")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "location" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📍 Location
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("app")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "app" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📱 Mobile App
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebhookPayloadTab("admin")}
                    className={`px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0 ${
                      webhookPayloadTab === "admin" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🔄 Admin Sync
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const payloads: Record<string, any> = {
                      full: {
                        parentName: "Sarah Connor",
                        email: "sarah.connor@example.com",
                        phone: "555-123-4567",
                        source: "After School Registration",
                        schoolName: "Brandywine Elementary",
                        locationName: "Brandywine Youth Pavilion",
                        sport: "Track & Field",
                        gradeBand: "4th – 5th Grade",
                        planType: "Seasonal",
                        studentName: "John Connor",
                        status: "active",
                        isEmailConsent: true,
                        metadata: {
                          smsConsent: true,
                          shirtSize: "Youth Small",
                          emergencyContact: "Uncle Bob (302-555-9988)"
                        }
                      },
                      school: {
                        parentName: "Jane Doe",
                        email: "jane.doe@example.com",
                        phone: "555-123-4567",
                        source: "School",
                        schoolName: "Lincoln Elementary",
                        schoolId: "sch_12345",
                        status: "active",
                        isEmailConsent: true
                      },
                      location: {
                        parentName: "John Smith",
                        email: "john.smith@example.com",
                        phone: "555-987-6543",
                        source: "Location",
                        locationName: "North Gym",
                        locationId: "loc_67890",
                        isEmailConsent: true
                      },
                      app: {
                        parentName: "Sam Wilson",
                        email: "sam.wilson@example.com",
                        phone: "555-333-2222",
                        source: "App Registration",
                        isEmailConsent: true
                      },
                      admin: {
                        action: "sync_list",
                        entityType: "school",
                        name: "Lincoln Elementary",
                        id: "sch_12345"
                      }
                    };
                    const payload = JSON.stringify(payloads[webhookPayloadTab] || payloads.full, null, 2);
                    navigator.clipboard.writeText(payload);
                    setCopiedWebhookPayload(webhookPayloadTab);
                    toast.success("Payload copied to clipboard!");
                    setTimeout(() => setCopiedWebhookPayload(null), 2000);
                  }}
                  className="btn-secondary h-6.5 px-2 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 self-end sm:self-auto"
                >
                  {copiedWebhookPayload === webhookPayloadTab ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  <span>{copiedWebhookPayload === webhookPayloadTab ? "Copied" : "Copy JSON"}</span>
                </button>
              </div>

              <pre className="p-2.5 bg-accent/20 rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 custom-scrollbar text-foreground leading-relaxed">
{webhookPayloadTab === "full" ? `{
  "parentName": "Sarah Connor",
  "email": "sarah.connor@example.com",
  "phone": "555-123-4567",
  "source": "After School Registration",
  "schoolName": "Brandywine Elementary",
  "locationName": "Brandywine Youth Pavilion",
  "sport": "Track & Field",
  "gradeBand": "4th – 5th Grade",
  "planType": "Seasonal",
  "studentName": "John Connor",
  "status": "active", // "active" | "opted_out"
  "isEmailConsent": true,
  "metadata": {
    "smsConsent": true,
    "shirtSize": "Youth Small",
    "emergencyContact": "Uncle Bob (302-555-9988)"
  }
}` : webhookPayloadTab === "school" ? `{
  "parentName": "Jane Doe",
  "email": "jane.doe@example.com",
  "phone": "555-123-4567",
  "source": "School",
  "schoolName": "Lincoln Elementary",
  "schoolId": "sch_12345",
  "status": "active",
  "isEmailConsent": true
}` : webhookPayloadTab === "location" ? `{
  "parentName": "John Smith",
  "email": "john.smith@example.com",
  "phone": "555-987-6543",
  "source": "Location",
  "locationName": "North Gym",
  "locationId": "loc_67890",
  "isEmailConsent": true
}` : webhookPayloadTab === "app" ? `{
  "parentName": "Sam Wilson",
  "email": "sam.wilson@example.com",
  "phone": "555-333-2222",
  "source": "App Registration",
  "isEmailConsent": true
}` : `{
  "action": "sync_list",
  "entityType": "school", // "school" | "location"
  "name": "Lincoln Elementary",
  "id": "sch_12345"
}`}
              </pre>
            </div>
          </div>

          <DialogFooter className="p-3.5 px-5 border-t bg-card shrink-0 flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Status: <strong className="text-emerald-600 dark:text-emerald-400">Live &amp; Listening</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsWebhookGuideOpen(false)}
              className="btn-primary text-xs h-8.5 px-4 font-bold cursor-pointer"
            >
              Close Documentation
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
      <Dialog open={isAiTemplateModalOpen} onOpenChange={(open) => { if (!open) resetAiTemplateModalState(); setIsAiTemplateModalOpen(open); }}>
        <DialogContent className="sm:max-w-[1150px] w-[95vw] max-h-[90vh] p-0 rounded-3xl border shadow-2xl overflow-hidden bg-card flex flex-col">
          {/* Modal Header */}
          <div className="p-5 border-b bg-card flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-foreground">Anthropic AI Email Template Builder</h2>
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
                    <label htmlFor="ai-template-name-input" className="text-xs font-extrabold text-foreground block mb-1 cursor-pointer">
                      Template Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="ai-template-name-input"
                      name="ai_template_name"
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
                    <label htmlFor="ai-template-subject-input" className="text-xs font-extrabold text-foreground block mb-1 cursor-pointer">
                      Default Subject Line <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="ai-template-subject-input"
                      name="ai_template_subject"
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
                  <span className="text-xs font-bold text-foreground block mb-2">
                    Quick Preset Topics
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "🏀 Basketball Camp", prompt: "Write a high-converting email template inviting parents to register for our summer youth basketball skill camp." },
                      { label: "⚡ Speed & Conditioning Clinic", prompt: "Create an action-oriented invitation email for elite speed and agility conditioning clinics." },
                      { label: "🤝 School & Club Partnership", prompt: "Create an executive partnership invitation proposing athletic development and training programs for high schools and sports clubs." },
                      { label: "🏆 Varsity Tryouts", prompt: "Write a polite email invitation for athlete tryouts and team evaluation sessions." },
                      { label: "🔥 Early Bird Discount", prompt: "Write an urgent promotional email offering 20% off early registration for athletic conditioning clinics." }
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
                  <label htmlFor="ai-template-prompt-input" className="text-xs font-bold text-foreground block mb-1.5 cursor-pointer">
                    Describe your Template Idea <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="ai-template-prompt-input"
                    name="ai_template_prompt"
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
                    <label htmlFor="ai-template-layout-select" className="text-xs font-bold text-foreground block mb-1.5 cursor-pointer">Category</label>
                    <select
                      id="ai-template-layout-select"
                      name="ai_template_layout"
                      value={aiCategoryInput}
                      onChange={e => setAiCategoryInput(e.target.value)}
                      className="w-full h-10 px-3 py-2 text-xs bg-background text-foreground border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 font-medium cursor-pointer shadow-2xs leading-normal"
                    >
                      <option value="General">General Marketing</option>
                      <option value="Announcement">Announcement</option>
                      <option value="Promotional">Promotional</option>
                      <option value="Partnership">School & Club Partnership</option>
                      <option value="Follow-up">Sales Follow-up</option>
                      <option value="Event Invitation">Event Invitation</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ai-template-tone-select" className="text-xs font-bold text-foreground block mb-1.5 cursor-pointer">Writing Style / Tone</label>
                    <select
                      id="ai-template-tone-select"
                      name="ai_template_tone"
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
                  className="w-full h-10 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingAiTemplate ? (
                    <><Loader2 size={14} className="animate-spin text-white" /> AI is generating the template, please wait...</>
                  ) : (
                    <><Sparkles size={15} /> Generate HTML Template (Anthropic AI)</>
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
                  {isSavingTemplate ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} /> Save Template</>}
                </button>
                <button
                  type="button"
                  onClick={handleUseDraftInCampaign}
                  disabled={isSavingTemplate || !aiDraftTemplate}
                  className="flex-1 h-9 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingTemplate ? (
                    <><Loader2 size={13} className="animate-spin" /> Saving & Loading...</>
                  ) : (
                    <>Use in Campaign <ChevronRight size={13} /></>
                  )}
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Visual Preview & Editor Canvas (7 Cols) */}
            <div className="lg:col-span-7 bg-accent/10 p-5 flex flex-col min-h-0 space-y-3 overflow-hidden text-left">
              {/* Header Bar with View Switcher */}
              <div className="flex items-center justify-between shrink-0 bg-card p-2 px-3 rounded-xl border flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Eye size={14} className="text-primary" /> Template Workspace
                  </span>
                  {aiDraftTemplate && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentContent = (previewTab === 'editor' && aiTemplateEditorRef.current)
                          ? aiTemplateEditorRef.current.innerHTML
                          : (aiDraftTemplate.content || '');
                        setSelectedTemplateForPreview({
                          _id: 'ai-temp-preview',
                          name: templateNameInput || aiDraftTemplate.name || 'AI Template Preview',
                          category: aiCategoryInput || aiDraftTemplate.category || 'General',
                          subject: templateSubjectInput || aiDraftTemplate.subject || 'Subject Preview',
                          content: currentContent
                        });
                        setTemplatePreviewMode('visual');
                        setIsTemplatePreviewModalOpen(true);
                      }}
                      className="px-2 py-1 rounded-lg border text-[11px] font-bold text-primary hover:bg-primary/10 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Open in Full Screen Flow Preview"
                    >
                      <Maximize2 size={11} /> Full View / Flow
                    </button>
                  )}
                </div>

                <div className="flex items-center bg-muted/60 dark:bg-muted/30 border border-border/80 p-0.5 rounded-xl text-xs gap-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (previewTab === 'editor' && aiTemplateEditorRef.current && aiDraftTemplate) {
                        setAiDraftTemplate(prev => prev ? ({ ...prev, content: aiTemplateEditorRef.current?.innerHTML || prev.content }) : null);
                      }
                      setPreviewTab("visual");
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${previewTab === "visual"
                        ? "bg-card text-foreground shadow-xs border border-border/60 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                      }`}
                  >
                    <Eye size={12} className={previewTab === "visual" ? "text-primary" : "text-muted-foreground"} />
                    <span>Live Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewTab("editor");
                      setTimeout(() => {
                        if (aiTemplateEditorRef.current && aiDraftTemplate?.content) {
                          if (aiTemplateEditorRef.current.innerHTML !== aiDraftTemplate.content) {
                            aiTemplateEditorRef.current.innerHTML = aiDraftTemplate.content;
                          }
                          aiTemplateEditorRef.current.focus();
                        }
                      }, 0);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${previewTab === "editor"
                        ? "bg-card text-foreground shadow-xs border border-border/60 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                      }`}
                  >
                    <PenLine size={12} className={previewTab === "editor" ? "text-primary" : "text-muted-foreground"} />
                    <span>Write Content</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (previewTab === 'editor' && aiTemplateEditorRef.current && aiDraftTemplate) {
                        setAiDraftTemplate(prev => prev ? ({ ...prev, content: aiTemplateEditorRef.current?.innerHTML || prev.content }) : null);
                      }
                      setPreviewTab("code");
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${previewTab === "code"
                        ? "bg-card text-foreground shadow-xs border border-border/60 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                      }`}
                  >
                    <Code2 size={12} className={previewTab === "code" ? "text-primary" : "text-muted-foreground"} />
                    <span>HTML Code</span>
                  </button>
                </div>
              </div>

              {/* Rendered Canvas / Frame */}
              <div className="flex-1 border rounded-2xl overflow-y-auto custom-scrollbar bg-card shadow-inner flex flex-col min-h-0">
                {isGeneratingAiTemplate ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 space-y-4 text-center flex-1 animate-in fade-in zoom-in-95 duration-300">
                    <div className="relative">
                      <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-violet-600/30 to-indigo-600/30 blur-lg animate-pulse" />
                      <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-violet-500/25">
                        <Sparkles size={24} className="animate-pulse text-amber-300" />
                      </div>
                    </div>

                    <div className="space-y-1.5 max-w-md">
                      <h4 className="text-sm font-black text-foreground tracking-tight">
                        AI is generating the template, please wait...
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Anthropic Claude is writing responsive email HTML, copy, and button layouts.
                      </p>
                    </div>

                    {/* Animated Wireframe Skeleton */}
                    <div className="w-full max-w-sm rounded-2xl border border-violet-500/20 bg-background/80 p-4 space-y-2.5 shadow-sm text-left animate-pulse mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-violet-500/20 shrink-0" />
                        <div className="h-3.5 bg-violet-500/20 rounded-md w-28" />
                      </div>
                      <div className="h-14 bg-gradient-to-r from-violet-500/15 via-indigo-500/10 to-transparent rounded-xl" />
                      <div className="space-y-1.5">
                        <div className="h-2.5 bg-muted rounded-md w-full" />
                        <div className="h-2.5 bg-muted rounded-md w-4/5" />
                        <div className="h-2.5 bg-muted rounded-md w-2/3" />
                      </div>
                      <div className="h-7 bg-violet-600/30 rounded-xl w-28 mx-auto" />
                    </div>
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
                  <div className="flex flex-col min-h-full flex-1">
                    {/* Mode 1: Visual Live Preview */}
                    {previewTab === "visual" && (
                      <div
                        className="p-6 flex-1 text-foreground text-sm space-y-3 prose dark:prose-invert max-w-none custom-scrollbar overflow-y-auto [&_table]:max-w-[600px] [&_table]:w-full [&_table]:mx-auto [&_table]:border-collapse"
                        dangerouslySetInnerHTML={{
                          __html: aiDraftTemplate.content.replace(/\{\{name\}\}/gi, "John Doe")
                        }}
                      />
                    )}

                    {/* Mode 2: Write Content (Rich WYSIWYG Editor) */}
                    {previewTab === "editor" && (
                      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
                        {/* Formatting Toolbar */}
                        <div className="flex items-center gap-1 sm:gap-1.5 px-4 py-2 border-b bg-card shrink-0 flex-wrap relative">
                          {/* Group 1: History Undo / Redo */}
                          <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('undo')}
                              title="Undo (Ctrl+Z)"
                              className="h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-background text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw size={12} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('redo')}
                              title="Redo (Ctrl+Y)"
                              className="h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-background text-muted-foreground hover:text-foreground"
                            >
                              <RotateCw size={12} />
                            </button>
                          </div>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Group 2: Basic Text Formatting */}
                          <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('bold')}
                              title="Bold"
                              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.bold ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              <Bold size={12} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('italic')}
                              title="Italic"
                              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.italic ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              <Italic size={12} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('underline')}
                              title="Underline"
                              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.underline ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              <Underline size={12} />
                            </button>
                          </div>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Group 3: Font Size Selector */}
                          <div className="flex items-center gap-1.5 bg-accent/40 px-2 py-1 rounded-lg border border-border/50">
                            <Type size={11} className="text-muted-foreground shrink-0" />
                            <select
                              id="ai-template-font-size-select"
                              name="ai_template_font_size"
                              value={aiEditorActiveFormats.fontSize || ''}
                              onChange={e => {
                                if (e.target.value) {
                                  applyCustomFontSize(aiTemplateEditorRef, e.target.value, updateAiEditorActiveFormats);
                                }
                              }}
                              title="Change Font Size"
                              className="h-5 text-xs bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                            >
                              <option value="">{aiEditorActiveFormats.fontSize ? aiEditorActiveFormats.fontSize : 'Size'}</option>
                              <option value="12px">12px (Small)</option>
                              <option value="14px">14px (Normal)</option>
                              <option value="16px">16px (Medium)</option>
                              <option value="18px">18px (Large)</option>
                              <option value="20px">20px (XL)</option>
                              <option value="24px">24px (2XL)</option>
                              <option value="28px">28px (3XL)</option>
                              <option value="32px">32px (Huge)</option>
                            </select>
                          </div>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Group 4: Headings */}
                          <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('formatBlock', '<h1>')}
                              title="Heading 1"
                              className={`h-7 px-2 rounded-md text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.h1 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              H1
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('formatBlock', '<h2>')}
                              title="Heading 2"
                              className={`h-7 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.h2 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              H2
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('formatBlock', '<h3>')}
                              title="Heading 3"
                              className={`h-7 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.h3 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              H3
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('formatBlock', '<p>')}
                              title="Paragraph"
                              className={`h-7 px-2 rounded-md text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.p ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              P
                            </button>
                          </div>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Group 5: Colors (Highlighter & Text Color) */}
                          <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                            {/* Highlighter Tool */}
                            <div className="relative">
                              <button
                                type="button"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  saveSelectionRange();
                                }}
                                onClick={() => {
                                  saveSelectionRange();
                                  setIsAiHighlighterOpen(!isAiHighlighterOpen);
                                  setIsAiColorPickerOpen(false);
                                }}
                                title={`Highlight Color (${aiHighlightColor === 'transparent' ? 'None' : aiHighlightColor})`}
                                className={`h-7 px-2 rounded-md hover:bg-background flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all cursor-pointer text-xs ${isAiHighlighterOpen ? 'bg-background text-foreground shadow-2xs' : ''}`}
                              >
                                <div className="flex flex-col items-center justify-center h-full pt-0.5 pb-1">
                                  <Highlighter size={13} className="text-amber-500 shrink-0" />
                                  <span
                                    className="w-3.5 h-[2.5px] rounded-full shrink-0 mt-1 transition-all"
                                    style={{
                                      backgroundColor: aiHighlightColor === 'transparent' ? '#cbd5e1' : aiHighlightColor,
                                      border: aiHighlightColor === 'transparent' ? '0.5px dashed #94a3b8' : undefined
                                    }}
                                  />
                                </div>
                                <ChevronDown size={10} className="opacity-60 shrink-0" />
                              </button>
                              <GoogleDocsColorPickerPopover
                                title="Highlight color"
                                isOpen={isAiHighlighterOpen}
                                onClose={() => setIsAiHighlighterOpen(false)}
                                currentColor={aiHighlightColor}
                                onSelectColor={color => {
                                  setAiHighlightColor(color);
                                  restoreSelectionRange();
                                  execAiEditorFormat('hiliteColor', color);
                                }}
                                allowNone={true}
                                restoreSelection={restoreSelectionRange}
                              />
                            </div>

                            {/* Text Color Tool with Full Color Picker & Light Contrasts */}
                            <div className="relative">
                              <button
                                type="button"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  saveSelectionRange();
                                }}
                                onClick={() => {
                                  saveSelectionRange();
                                  setIsAiColorPickerOpen(!isAiColorPickerOpen);
                                  setIsAiHighlighterOpen(false);
                                }}
                                title={`Text Color (${aiTextColor || '#000000'})`}
                                className={`h-7 px-2 rounded-md hover:bg-background flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all cursor-pointer text-xs ${isAiColorPickerOpen ? 'bg-background text-foreground shadow-2xs' : ''}`}
                              >
                                <div className="flex flex-col items-center justify-center h-full pt-0.5 pb-1">
                                  <Palette size={13} className="text-blue-500 shrink-0" />
                                  <span
                                    className="w-3.5 h-[2.5px] rounded-full shrink-0 mt-1 transition-all"
                                    style={{ backgroundColor: aiTextColor || '#000000' }}
                                  />
                                </div>
                                <ChevronDown size={10} className="opacity-60 shrink-0" />
                              </button>
                              <GoogleDocsColorPickerPopover
                                title="Text color"
                                isOpen={isAiColorPickerOpen}
                                onClose={() => setIsAiColorPickerOpen(false)}
                                currentColor={aiTextColor}
                                onSelectColor={color => {
                                  setAiTextColor(color);
                                  restoreSelectionRange();
                                  execAiEditorFormat('foreColor', color);
                                }}
                                restoreSelection={restoreSelectionRange}
                              />
                            </div>
                          </div>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Group 6: Lists */}
                          <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('insertUnorderedList')}
                              title="Bullet List"
                              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.ul ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              <List size={12} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('insertOrderedList')}
                              title="Numbered List"
                              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.ol ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              <ListOrdered size={12} />
                            </button>
                          </div>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Group 7: Alignment */}
                          <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('justifyLeft')}
                              title="Align Left"
                              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.alignLeft ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              <AlignLeft size={12} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('justifyCenter')}
                              title="Align Center"
                              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.alignCenter ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              <AlignCenter size={12} />
                            </button>
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => execAiEditorFormat('justifyRight')}
                              title="Align Right"
                              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${aiEditorActiveFormats.alignRight ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                            >
                              <AlignRight size={12} />
                            </button>
                          </div>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Group 8: Links */}
                          <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                const url = prompt('Enter URL (e.g. https://example.com):');
                                if (url) {
                                  const formattedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
                                  execAiEditorFormat('createLink', formattedUrl);
                                }
                              }}
                              title="Insert Link"
                              className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                              <Link size={12} />
                            </button>
                          </div>

                          <div className="w-px h-5 bg-border mx-0.5" />

                          {/* Group 9: Personalization Tag helper */}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              document.execCommand('insertText', false, '{{name}}');
                              aiTemplateEditorRef.current?.focus();
                              if (aiTemplateEditorRef.current && aiDraftTemplate) {
                                setAiDraftTemplate(prev => prev ? ({ ...prev, content: aiTemplateEditorRef.current?.innerHTML || '' }) : null);
                              }
                            }}
                            title="Insert {{name}} placeholder"
                            className="h-7 px-2.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Tag size={11} /> + {'{{name}}'}
                          </button>

                          {/* Right-Aligned Helper Guide */}
                          <div className="ml-auto text-[11px] text-muted-foreground font-medium hidden lg:flex items-center gap-1.5 pl-2">
                            Use <span className="font-mono bg-accent px-1.5 py-0.5 rounded text-primary font-bold">{'{{name}}'}</span> for recipient's name
                          </div>
                        </div>

                        {/* Visual Canvas */}
                        <div
                          ref={aiTemplateEditorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={() => {
                            if (aiTemplateEditorRef.current && aiDraftTemplate) {
                              setAiDraftTemplate(prev => prev ? ({ ...prev, content: aiTemplateEditorRef.current?.innerHTML || '' }) : null);
                            }
                          }}
                          onKeyUp={updateAiEditorActiveFormats}
                          onMouseUp={updateAiEditorActiveFormats}
                          onFocus={updateAiEditorActiveFormats}
                          className="p-6 focus:outline-none flex-1 overflow-y-auto custom-scrollbar text-foreground leading-relaxed text-sm bg-white dark:bg-card [&_table]:max-w-[600px] [&_table]:w-full [&_table]:mx-auto [&_table]:border-collapse"
                          style={{ minHeight: '350px' }}
                        />
                      </div>
                    )}

                    {/* Mode 3: HTML Source Code */}
                    {previewTab === "code" && (
                      <div className="p-4 flex-1 bg-slate-950 text-emerald-400 font-mono text-xs overflow-y-auto custom-scrollbar">
                        <textarea
                          id="ai-template-code-content"
                          name="ai_template_code_content"
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
      {/* ─────────────────────────────────────────────────────────────
          MANUAL TEMPLATE BUILDER MODAL
      ───────────────────────────────────────────────────────────── */}
      <Dialog
        open={isManualTemplateModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (isTemplateImageModalOpen) return;
            resetManualTemplateModalState();
            setIsManualTemplateModalOpen(false);
          } else {
            setIsManualTemplateModalOpen(true);
          }
        }}
      >
        <DialogContent
          className="w-[96vw] max-w-6xl h-[94vh] max-h-[94vh] p-0 gap-0 !flex !flex-col overflow-hidden rounded-2xl border border-border shadow-2xl bg-white dark:bg-card"
        >
          {/* Header */}
          <DialogHeader className="flex flex-row items-center justify-between px-5 py-2.5 border-b shrink-0 bg-white dark:bg-card">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText size={15} className="text-primary" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold leading-tight">
                  {editingTemplateId ? "Edit Email Template" : "Create Email Template"}
                </DialogTitle>
                <DialogDescription className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                  {editingTemplateId
                    ? "Update and refine your reusable email template layout and content."
                    : "Build a reusable email template to use in campaigns."
                  }
                </DialogDescription>
              </div>
            </div>
            {/* Actions & Mode Switcher */}
            <div className="flex items-center gap-2 mr-8">
              <button
                type="button"
                onClick={() => {
                  const currentContent = manualTemplateMode === 'html'
                    ? manualTemplateHtml
                    : unscopeTemplateHtml(manualEditorRef.current?.innerHTML || '');
                  setSelectedTemplateForPreview({
                    _id: 'temp-preview',
                    name: manualTemplateName || 'Template Preview',
                    category: manualTemplateCategory || 'General',
                    subject: manualTemplateSubject || 'Subject Preview',
                    content: currentContent
                  });
                  setTemplatePreviewMode('visual');
                  setIsTemplatePreviewModalOpen(true);
                }}
                className="px-2 py-1 rounded-lg border text-xs font-bold text-primary hover:bg-primary/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open in Full Screen Flow Preview"
              >
                <Maximize2 size={11} /> Full View / Flow
              </button>

              <div className="flex items-center bg-accent/60 border p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setManualTemplateMode('editor');
                    setTimeout(() => {
                      if (manualEditorRef.current) {
                        const scopedContent = scopeTemplateHtml(manualTemplateHtml);
                        if (manualEditorRef.current.innerHTML !== scopedContent) {
                          manualEditorRef.current.innerHTML = scopedContent;
                        }
                        manualEditorRef.current.scrollTop = 0;
                      }
                      // Reset any parent dialog scroll leak
                      const dialogEl = document.querySelector('[role="dialog"]');
                      if (dialogEl) (dialogEl as HTMLElement).scrollTop = 0;
                    }, 0);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${manualTemplateMode === 'editor' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <PenLine size={11} /> Write Content
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (manualEditorRef.current) {
                      setManualTemplateHtml(unscopeTemplateHtml(manualEditorRef.current.innerHTML || ''));
                    }
                    setManualTemplateMode('html');
                    setTimeout(() => {
                      if (manualLivePreviewRef.current) {
                        manualLivePreviewRef.current.scrollTop = 0;
                      }
                      // Reset any parent dialog scroll leak
                      const dialogEl = document.querySelector('[role="dialog"]');
                      if (dialogEl) (dialogEl as HTMLElement).scrollTop = 0;
                    }, 0);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${manualTemplateMode === 'html' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <Code2 size={11} /> HTML Code
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Meta Fields Row - Compact Sleek Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 px-5 py-2 border-b shrink-0 bg-slate-50/80 dark:bg-card/90 items-center">
              <div className="md:col-span-4 flex items-center gap-2">
                <label htmlFor="manual-template-name-input" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 cursor-pointer">Name *</label>
                <input
                  id="manual-template-name-input"
                  name="manual_template_name"
                  type="text"
                  placeholder="Template Name..."
                  value={manualTemplateName}
                  onChange={e => setManualTemplateName(e.target.value)}
                  className="input-field h-7.5 text-xs w-full px-2.5 bg-white dark:bg-background/60 shadow-2xs"
                />
              </div>
              <div className="md:col-span-5 flex items-center gap-2">
                <label htmlFor="manual-template-subject-input" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 cursor-pointer">Subject *</label>
                <input
                  id="manual-template-subject-input"
                  name="manual_template_subject"
                  type="text"
                  placeholder="Email Subject Line..."
                  value={manualTemplateSubject}
                  onChange={e => setManualTemplateSubject(e.target.value)}
                  className="input-field h-7.5 text-xs w-full px-2.5 bg-white dark:bg-background/60 shadow-2xs"
                />
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <label htmlFor="manual-template-category-select" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 cursor-pointer">Category</label>
                <select
                  id="manual-template-category-select"
                  name="manual_template_category"
                  value={manualTemplateCategory}
                  onChange={e => setManualTemplateCategory(e.target.value)}
                  className="input-field h-7.5 text-xs w-full px-2 bg-white dark:bg-background/60 shadow-2xs"
                >
                  {["General", "Promotional", "Informational", "Follow-up", "Welcome", "Re-engagement", "Event"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Editor Area */}
            {manualTemplateMode === 'editor' ? (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-1 sm:gap-1.5 px-4 py-1.5 border-b bg-white dark:bg-card shrink-0 flex-wrap relative">
                  {/* Group 1: History Undo / Redo */}
                  <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleManualTemplateUndo}
                      disabled={manualTemplateHistoryIndex <= 0}
                      title="Undo (Ctrl+Z)"
                      className="h-6.5 w-6.5 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleManualTemplateRedo}
                      disabled={manualTemplateHistoryIndex >= manualTemplateHistory.length - 1}
                      title="Redo (Ctrl+Y)"
                      className="h-6.5 w-6.5 rounded-md flex items-center justify-center transition-colors cursor-pointer hover:bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <RotateCw size={11} />
                    </button>
                  </div>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Group 2: Basic Text Formatting */}
                  <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('bold')}
                      title="Bold"
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.bold ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      <Bold size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('italic')}
                      title="Italic"
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.italic ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      <Italic size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('underline')}
                      title="Underline"
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.underline ? 'bg-primary text-primary-foreground shadow-xs font-bold' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      <Underline size={12} />
                    </button>
                  </div>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Group 3: Font Size Selector */}
                  <div className="flex items-center gap-1.5 bg-accent/40 px-2 py-1 rounded-lg border border-border/50">
                    <Type size={11} className="text-muted-foreground shrink-0" />
                    <select
                      id="manual-template-font-size-select"
                      name="manual_template_font_size"
                      value={editorActiveFormats.fontSize || ''}
                      onChange={e => {
                        if (e.target.value) {
                          applyCustomFontSize(manualEditorRef, e.target.value, updateEditorActiveFormats);
                        }
                      }}
                      title="Change Font Size"
                      className="h-5 text-xs bg-transparent font-bold text-foreground focus:outline-none cursor-pointer"
                    >
                      <option value="">{editorActiveFormats.fontSize ? editorActiveFormats.fontSize : 'Size'}</option>
                      <option value="12px">12px (Small)</option>
                      <option value="14px">14px (Normal)</option>
                      <option value="16px">16px (Medium)</option>
                      <option value="18px">18px (Large)</option>
                      <option value="20px">20px (XL)</option>
                      <option value="24px">24px (2XL)</option>
                      <option value="28px">28px (3XL)</option>
                      <option value="32px">32px (Huge)</option>
                    </select>
                  </div>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Group 4: Headings */}
                  <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('formatBlock', '<h1>')}
                      title="Heading 1"
                      className={`h-7 px-2 rounded-md text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.h1 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('formatBlock', '<h2>')}
                      title="Heading 2"
                      className={`h-7 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.h2 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('formatBlock', '<h3>')}
                      title="Heading 3"
                      className={`h-7 px-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.h3 ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      H3
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('formatBlock', '<p>')}
                      title="Paragraph"
                      className={`h-7 px-2 rounded-md text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.p ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      P
                    </button>
                  </div>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Group 5: Colors (Highlighter & Text Color) */}
                  <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                    {/* Highlighter dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          saveSelectionRange();
                        }}
                        onClick={() => {
                          saveSelectionRange();
                          setIsHighlighterOpen(!isHighlighterOpen);
                          setIsColorPickerOpen(false);
                        }}
                        title={`Highlight Color (${manualHighlightColor === 'transparent' ? 'None' : manualHighlightColor})`}
                        className={`h-7 px-2 rounded-md hover:bg-background flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all cursor-pointer text-xs ${isHighlighterOpen ? 'bg-background text-foreground shadow-2xs' : ''}`}
                      >
                        <div className="flex flex-col items-center justify-center h-full pt-0.5 pb-1">
                          <Highlighter size={13} className="text-amber-500 shrink-0" />
                          <span
                            className="w-3.5 h-[2.5px] rounded-full shrink-0 mt-1 transition-all"
                            style={{
                              backgroundColor: manualHighlightColor === 'transparent' ? '#cbd5e1' : manualHighlightColor,
                              border: manualHighlightColor === 'transparent' ? '0.5px dashed #94a3b8' : undefined
                            }}
                          />
                        </div>
                        <ChevronDown size={10} className="opacity-60 shrink-0" />
                      </button>
                      <GoogleDocsColorPickerPopover
                        title="Highlight color"
                        isOpen={isHighlighterOpen}
                        onClose={() => setIsHighlighterOpen(false)}
                        currentColor={manualHighlightColor}
                        onSelectColor={color => {
                          setManualHighlightColor(color);
                          restoreSelectionRange();
                          execFormat('hiliteColor', color);
                        }}
                        allowNone={true}
                        restoreSelection={restoreSelectionRange}
                      />
                    </div>

                    {/* Text Color dropdown with Full Color Picker & Light Contrasts */}
                    <div className="relative">
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          saveSelectionRange();
                        }}
                        onClick={() => {
                          saveSelectionRange();
                          setIsColorPickerOpen(!isColorPickerOpen);
                          setIsHighlighterOpen(false);
                        }}
                        title={`Text Color (${manualTextColor || '#000000'})`}
                        className={`h-7 px-2 rounded-md hover:bg-background flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all cursor-pointer text-xs ${isColorPickerOpen ? 'bg-background text-foreground shadow-2xs' : ''}`}
                      >
                        <div className="flex flex-col items-center justify-center h-full pt-0.5 pb-1">
                          <Palette size={13} className="text-blue-500 shrink-0" />
                          <span
                            className="w-3.5 h-[2.5px] rounded-full shrink-0 mt-1 transition-all"
                            style={{ backgroundColor: manualTextColor || '#000000' }}
                          />
                        </div>
                        <ChevronDown size={10} className="opacity-60 shrink-0" />
                      </button>
                      <GoogleDocsColorPickerPopover
                        title="Text color"
                        isOpen={isColorPickerOpen}
                        onClose={() => setIsColorPickerOpen(false)}
                        currentColor={manualTextColor}
                        onSelectColor={color => {
                          setManualTextColor(color);
                          restoreSelectionRange();
                          execFormat('foreColor', color);
                        }}
                        restoreSelection={restoreSelectionRange}
                      />
                    </div>
                  </div>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Group 6: Lists */}
                  <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('insertUnorderedList')}
                      title="Bullet List"
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.ul ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      <List size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('insertOrderedList')}
                      title="Numbered List"
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.ol ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      <ListOrdered size={12} />
                    </button>
                  </div>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Group 7: Alignment */}
                  <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('justifyLeft')}
                      title="Align Left"
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.alignLeft ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      <AlignLeft size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('justifyCenter')}
                      title="Align Center"
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.alignCenter ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      <AlignCenter size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => execFormat('justifyRight')}
                      title="Align Right"
                      className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${editorActiveFormats.alignRight ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-background text-muted-foreground hover:text-foreground'}`}
                    >
                      <AlignRight size={12} />
                    </button>
                  </div>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Group 8: Links & Images */}
                  <div className="flex items-center bg-accent/40 border border-border/50 rounded-lg p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        const url = prompt('Enter URL (e.g. https://example.com):');
                        if (url) {
                          const formattedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
                          execFormat('createLink', formattedUrl);
                        }
                      }}
                      title="Insert Link"
                      className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <Link size={12} />
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => {
                        e.preventDefault();
                        saveSelectionRange();
                      }}
                      onClick={() => {
                        saveSelectionRange();
                        setIsTemplateImageModalOpen(true);
                      }}
                      title="Insert Image / Logo (Cloudinary CDN)"
                      className="h-7 px-2 rounded-md hover:bg-background flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs font-medium"
                    >
                      <ImageIcon size={12} />
                      <span className="hidden sm:inline text-[11px]">Image</span>
                    </button>
                  </div>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Group 9: Personalization Tag helper */}
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      manualEditorRef.current?.focus();
                      document.execCommand('insertText', false, '{{name}}');
                      updateEditorActiveFormats();
                      if (manualEditorRef.current) {
                        const newHtml = manualEditorRef.current.innerHTML || '';
                        setManualTemplateHtml(newHtml);
                        pushManualTemplateHistory(newHtml, false);
                      }
                    }}
                    title="Insert {{name}} personalization tag"
                    className="h-7 px-2.5 rounded-lg hover:bg-primary/20 flex items-center gap-1.5 text-primary text-xs font-bold border border-primary/30 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Tag size={11} /> + {'{{name}}'}
                  </button>

                  {/* Right-Aligned Helper Guide */}
                  <div className="ml-auto text-[11px] text-muted-foreground font-medium hidden lg:flex items-center gap-1.5 pl-2">
                    Use <span className="font-mono bg-accent px-1.5 py-0.5 rounded text-primary font-bold">{'{{name}}'}</span> for recipient's name
                  </div>
                </div>

                {/* ContentEditable Viewport Container with overflow:hidden to strictly clip overlay */}
                <div
                  ref={editorViewportRef}
                  className="relative flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-card"
                >
                  <div
                    ref={manualEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onClick={handleManualEditorClick}
                    onDragStart={handleTemplateEditorDragStart}
                    onDragEnd={handleTemplateEditorDragEnd}
                    onKeyUp={updateEditorActiveFormats}
                    onMouseUp={updateEditorActiveFormats}
                    onFocus={updateEditorActiveFormats}
                    onPaste={handleTemplateEditorPaste}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = draggedEditorNodeRef.current ? 'move' : 'copy';
                    }}
                    onDrop={handleTemplateEditorDrop}
                    className="email-template-canvas flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 text-sm text-foreground focus:outline-none custom-scrollbar leading-relaxed bg-white dark:bg-card [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:my-3 [&_h1]:text-foreground [&_h2]:text-xl [&_h2]:font-bold [&_h2]:my-2.5 [&_h2]:text-foreground [&_h3]:text-lg [&_h3]:font-bold [&_h3]:my-2 [&_h3]:text-foreground [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_a]:text-primary [&_a]:underline"
                    style={{ minHeight: 0 }}
                    data-placeholder="Start writing your email content here... Use the toolbar above to format text, add headings, lists, links, and images (or drag and drop images directly)."
                    onInput={() => {
                      if (manualEditorRef.current) {
                        const newHtml = manualEditorRef.current.innerHTML || '';
                        setManualTemplateHtml(unscopeTemplateHtml(newHtml));
                        pushManualTemplateHistory(newHtml, false);
                      }
                    }}
                  />

                  {/* IN-CONTAINER CANVA RESIZER OVERLAY */}
                  {/* Because this container has overflow:hidden, the overlay and handles CANNOT leak into footer or outside modal */}
                  {isManualTemplateModalOpen && selectedEditorImage && imageOverlayRect && (
                    <div className="canva-image-resizer-overlay absolute inset-0 pointer-events-none z-20">
                      {/* Selection Border Outline */}
                      <div
                        style={{
                          position: 'absolute',
                          top: `${imageOverlayRect.top}px`,
                          left: `${imageOverlayRect.left}px`,
                          width: `${imageOverlayRect.width}px`,
                          height: `${imageOverlayRect.height}px`,
                          pointerEvents: 'none',
                        }}
                        className="border-2 border-primary rounded-xs ring-1 ring-white/90 shadow-md"
                      />

                      {/* 4 Corner Resize Handles */}
                      <div
                        onMouseDown={(e) => handleStartDragResize('nw', e)}
                        style={{
                          position: 'absolute',
                          top: `${imageOverlayRect.top - 5}px`,
                          left: `${imageOverlayRect.left - 5}px`,
                          pointerEvents: 'auto',
                          cursor: 'nwse-resize',
                        }}
                        className="h-3 w-3 rounded-full bg-white border-2 border-primary shadow-sm hover:scale-125 transition-transform"
                        title="Drag to resize"
                      />

                      <div
                        onMouseDown={(e) => handleStartDragResize('ne', e)}
                        style={{
                          position: 'absolute',
                          top: `${imageOverlayRect.top - 5}px`,
                          left: `${imageOverlayRect.left + imageOverlayRect.width - 7}px`,
                          pointerEvents: 'auto',
                          cursor: 'nesw-resize',
                        }}
                        className="h-3 w-3 rounded-full bg-white border-2 border-primary shadow-sm hover:scale-125 transition-transform"
                        title="Drag to resize"
                      />

                      <div
                        onMouseDown={(e) => handleStartDragResize('se', e)}
                        style={{
                          position: 'absolute',
                          top: `${imageOverlayRect.top + imageOverlayRect.height - 7}px`,
                          left: `${imageOverlayRect.left + imageOverlayRect.width - 7}px`,
                          pointerEvents: 'auto',
                          cursor: 'nwse-resize',
                        }}
                        className="h-3 w-3 rounded-full bg-white border-2 border-primary shadow-sm hover:scale-125 transition-transform"
                        title="Drag to resize"
                      />

                      <div
                        onMouseDown={(e) => handleStartDragResize('sw', e)}
                        style={{
                          position: 'absolute',
                          top: `${imageOverlayRect.top + imageOverlayRect.height - 7}px`,
                          left: `${imageOverlayRect.left - 5}px`,
                          pointerEvents: 'auto',
                          cursor: 'nesw-resize',
                        }}
                        className="h-3 w-3 rounded-full bg-white border-2 border-primary shadow-sm hover:scale-125 transition-transform"
                        title="Drag to resize"
                      />

                      {/* 2 Edge Resize Handles */}
                      <div
                        onMouseDown={(e) => handleStartDragResize('w', e)}
                        style={{
                          position: 'absolute',
                          top: `${imageOverlayRect.top + (imageOverlayRect.height / 2) - 8}px`,
                          left: `${imageOverlayRect.left - 4}px`,
                          pointerEvents: 'auto',
                          cursor: 'ew-resize',
                        }}
                        className="h-4 w-2 rounded-xs bg-white border-2 border-primary shadow-sm hover:scale-125 transition-transform"
                        title="Drag to resize width"
                      />

                      <div
                        onMouseDown={(e) => handleStartDragResize('e', e)}
                        style={{
                          position: 'absolute',
                          top: `${imageOverlayRect.top + (imageOverlayRect.height / 2) - 8}px`,
                          left: `${imageOverlayRect.left + imageOverlayRect.width - 4}px`,
                          pointerEvents: 'auto',
                          cursor: 'ew-resize',
                        }}
                        className="h-4 w-2 rounded-xs bg-white border-2 border-primary shadow-sm hover:scale-125 transition-transform"
                        title="Drag to resize width"
                      />

                      {/* Floating Canva Studio Action Bar (Clamped inside viewport) */}
                      {(() => {
                        const toolbarTop = imageOverlayRect.top > 50
                          ? Math.max(8, imageOverlayRect.top - 44)
                          : Math.min(imageOverlayRect.containerHeight - 48, imageOverlayRect.top + imageOverlayRect.height + 10);
                        const toolbarLeft = Math.max(8, Math.min(imageOverlayRect.containerWidth - 520, imageOverlayRect.left + (imageOverlayRect.width / 2) - 260));
                        const currentShape = getCurrentImageShape();
                        const shapeDisplayNames: Record<string, string> = {
                          'rectangle': 'Rectangle',
                          'rounded-sm': 'Soft (8px)',
                          'rounded-lg': 'Card (16px)',
                          'squircle': 'Squircle',
                          'circle': 'Circle',
                          'pill': 'Pill'
                        };

                        return (
                          <div
                            style={{
                              position: 'absolute',
                              top: `${toolbarTop}px`,
                              left: `${toolbarLeft}px`,
                              pointerEvents: 'auto',
                            }}
                            className="bg-slate-900/95 text-white border border-slate-700/80 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center gap-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 z-30"
                          >
                            {/* Size Badge */}
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/10 text-white shrink-0">
                              {Math.round(imageOverlayRect.width)}px
                            </span>

                            <div className="w-px h-4 bg-white/20 mx-0.5" />

                            {/* Quick Presets */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleResizeImagePreset(160)}
                                title="Logo Size (160px)"
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 hover:bg-white/20 transition-colors cursor-pointer"
                              >
                                160px
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResizeImagePreset(320)}
                                title="Medium (320px)"
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 hover:bg-white/20 transition-colors cursor-pointer"
                              >
                                320px
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResizeImagePreset(480)}
                                title="Large (480px)"
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 hover:bg-white/20 transition-colors cursor-pointer"
                              >
                                480px
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResizeImagePreset('100%')}
                                title="Full Width (100%)"
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 hover:bg-white/20 transition-colors cursor-pointer"
                              >
                                100%
                              </button>
                            </div>

                            <div className="w-px h-4 bg-white/20 mx-0.5" />

                            {/* Alignment Buttons */}
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleAlignSelectedImage('left')}
                                title="Align Left"
                                className="p-1 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
                              >
                                <AlignLeft size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignSelectedImage('center')}
                                title="Align Center"
                                className="p-1 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
                              >
                                <AlignCenter size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlignSelectedImage('right')}
                                title="Align Right"
                                className="p-1 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
                              >
                                <AlignRight size={13} />
                              </button>
                            </div>

                            <div className="w-px h-4 bg-white/20 mx-0.5" />

                            {/* Shape Selector Button & Popover */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setIsImageShapePickerOpen(!isImageShapePickerOpen)}
                                title="Change Image Shape (Rectangle, Soft, Card, Squircle, Circle, Pill)"
                                className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                                  isImageShapePickerOpen ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30' : 'bg-white/10 hover:bg-white/20 text-white'
                                }`}
                              >
                                <Shapes size={12} className="text-amber-400" />
                                <span>{shapeDisplayNames[currentShape] || 'Shape'}</span>
                                <ChevronDown size={10} className="opacity-70" />
                              </button>

                              {/* Shape Popover Menu - Solid Opaque Dark Theme matching Upper Bar */}
                              {isImageShapePickerOpen && (
                                <div
                                  style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
                                  className={`absolute left-1/2 -translate-x-1/2 ${
                                    toolbarTop > 160 ? 'bottom-full mb-2' : 'top-full mt-2'
                                  } w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-white animate-in fade-in zoom-in-95 duration-100`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider px-2 py-1 mb-1.5 border-b border-slate-700/80 flex items-center justify-between bg-slate-800/60 rounded-t-lg">
                                    <span className="flex items-center gap-1.5"><Shapes size={11} className="text-amber-400" /> Canva Shape</span>
                                    <span className="text-[9px] text-amber-400 font-semibold px-1.5 py-0.5 rounded bg-amber-400/10">Instant</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5 p-0.5">
                                    {[
                                      { id: 'rectangle', label: 'Rectangle', icon: <div className="w-3.5 h-3 border-2 border-current rounded-none" /> },
                                      { id: 'rounded-sm', label: 'Soft Curve', icon: <div className="w-3.5 h-3 border-2 border-current rounded-xs" /> },
                                      { id: 'rounded-lg', label: 'Card Curve', icon: <div className="w-3.5 h-3 border-2 border-current rounded-[2.5px]" /> },
                                      { id: 'squircle', label: 'Squircle', icon: <div className="w-3.5 h-3.5 border-2 border-current rounded-[28%]" /> },
                                      { id: 'circle', label: 'Circle (1:1)', icon: <div className="w-3.5 h-3.5 border-2 border-current rounded-full" /> },
                                      { id: 'pill', label: 'Pill Shape', icon: <div className="w-4 h-2.5 border-2 border-current rounded-full" /> },
                                    ].map((item) => {
                                      const isActive = currentShape === item.id;
                                      return (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => handleApplyImageShape(item.id as any)}
                                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all text-left cursor-pointer ${
                                            isActive
                                              ? 'bg-primary text-primary-foreground font-bold shadow-sm ring-1 ring-white/20'
                                              : 'bg-slate-800/70 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700/50'
                                          }`}
                                        >
                                          <span className="shrink-0 text-current">{item.icon}</span>
                                          <span className="truncate">{item.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="w-px h-4 bg-white/20 mx-0.5" />

                            {/* Cut Button (Ctrl+X) */}
                            <button
                              type="button"
                              onClick={handleCutSelectedImage}
                              title="Cut Image (Ctrl+X)"
                              className="p-1 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              <Scissors size={13} />
                            </button>

                            {/* Copy Button (Ctrl+C) */}
                            <button
                              type="button"
                              onClick={handleCopySelectedImage}
                              title="Copy Image (Ctrl+C)"
                              className="p-1 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
                            >
                              <Copy size={13} />
                            </button>

                            <div className="w-px h-4 bg-white/20 mx-0.5" />

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={handleDeleteSelectedImage}
                              title="Remove Image from Template (Del)"
                              className="p-1 rounded hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>

                            {/* Deselect / Close button */}
                            <button
                              type="button"
                              onClick={() => setSelectedEditorImage(null)}
                              title="Deselect"
                              className="p-1 rounded hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* HTML Code Mode - Full Width Editor */
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b bg-slate-950 shrink-0">
                  <Code2 size={12} className="text-emerald-400" />
                  <span className="text-[11px] font-bold text-emerald-400">HTML Source Code</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newHtml = manualTemplateHtml + '{{name}}';
                      setManualTemplateHtml(newHtml);
                      pushManualTemplateHistory(newHtml, true);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary hover:bg-primary/30 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Insert {{name}} tag"
                  >
                    <Tag size={10} /> + {'{{name}}'}
                  </button>
                  <div className="ml-auto flex items-center gap-3">
                    {manualTemplateHtml.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplateForPreview({
                            _id: 'temp-preview',
                            name: manualTemplateName || 'Template Preview',
                            category: manualTemplateCategory || 'General',
                            subject: manualTemplateSubject || 'Subject Preview',
                            content: manualTemplateHtml
                          });
                          setTemplatePreviewMode('visual');
                          setIsTemplatePreviewModalOpen(true);
                        }}
                        className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold text-emerald-400 hover:bg-emerald-400/10 border border-emerald-400/30 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Open in Full Screen Flow Preview"
                      >
                        <Eye size={10} /> Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setManualTemplateHtml('');
                        pushManualTemplateHistory('', true);
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <textarea
                  id="manual-template-html-content"
                  name="manual_template_html_content"
                  value={manualTemplateHtml}
                  onChange={e => {
                    const newHtml = e.target.value;
                    setManualTemplateHtml(newHtml);
                    pushManualTemplateHistory(newHtml, false);
                  }}
                  placeholder={'<!-- Paste or write your HTML email here -->\n<h2>Hi {{name}},</h2>\n<p>Your email content...</p>'}
                  className="flex-1 min-h-0 resize-none p-4 bg-slate-950 text-emerald-300 font-mono text-xs focus:outline-none custom-scrollbar overflow-y-auto overscroll-contain"
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          {/* Footer - Compact Slim Bar */}
          <div className="flex items-center justify-between px-5 py-2 border-t bg-white dark:bg-card shrink-0">
            <p className="text-[11px] text-muted-foreground">
              {manualTemplateMode === 'editor'
                ? '📝 Mode: Rich Text Editor — Type your message and use {{name}} for recipient name.'
                : '💻 Mode: Raw HTML Code & Live Preview — Paste or write custom HTML.'
              }
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetManualTemplateModalState();
                  setIsManualTemplateModalOpen(false);
                }}
                className="btn-secondary h-7.5 px-3.5 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveManualTemplate}
                disabled={savingManualTemplate}
                className="btn-primary h-7.5 px-4 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60 cursor-pointer shadow-xs"
              >
                {savingManualTemplate ? (
                  <><Loader2 size={12} className="animate-spin" /> Saving...</>
                ) : (
                  <><CheckCircle size={12} /> {editingTemplateId ? "Update Template" : "Save Template"}</>
                )}
              </button>
            </div>
          </div>

          {/* --- TEMPLATE IMAGE & LOGO INSERTER MODAL (IN-DIALOG OVERLAY) --- */}
          <TemplateImageModal
            isOpen={isTemplateImageModalOpen}
            onClose={() => setIsTemplateImageModalOpen(false)}
            onInsert={handleInsertTemplateImage}
          />
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 1B: FULLSCREEN CAMPAIGN EMAIL PREVIEW --- */}
      <Dialog open={isCampaignPreviewFullscreen} onOpenChange={setIsCampaignPreviewFullscreen}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[94vh] overflow-y-auto custom-scrollbar p-6 flex flex-col bg-white dark:bg-card">
          <DialogHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span>👁️ Full Email Preview:</span>
              <span className="text-primary font-normal text-sm truncate max-w-lg">{campaignForm.subject || campaignForm.title || "Email Preview"}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-slate-100 dark:bg-slate-900/80 p-4 sm:p-8 rounded-2xl flex justify-center overflow-y-auto custom-scrollbar min-h-[500px]">
            <div className="w-full max-w-[620px] bg-white text-gray-900 rounded-xl shadow-md p-4 sm:p-6 border border-slate-200 self-start">
              {campaignForm.content ? (
                <div className="email-template-canvas" dangerouslySetInnerHTML={{ __html: scopeTemplateHtml(campaignForm.content.replace(/\{\{name\}\}/gi, "John Doe")) }} />
              ) : (
                <p className="text-center text-gray-400 py-16 text-xs">No template content to preview.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG: DIRECT TEMPLATE PREVIEW & INSPECTOR MODAL --- */}
      <Dialog open={isTemplatePreviewModalOpen} onOpenChange={setIsTemplatePreviewModalOpen}>
        <DialogContent className="w-[96vw] max-w-6xl max-h-[94vh] p-0 flex flex-col overflow-hidden bg-white dark:bg-card rounded-3xl shadow-2xl">
          <DialogHeader className="p-4 px-6 border-b shrink-0 flex flex-row items-center justify-between bg-white dark:bg-card relative">
            <div className="text-left space-y-1 min-w-0 pr-8">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  {selectedTemplateForPreview?.name || "Template Preview"}
                </DialogTitle>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${selectedTemplateForPreview?.isAiGenerated
                  ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                  }`}>
                  {selectedTemplateForPreview?.isAiGenerated ? "✨ Anthropic AI" : selectedTemplateForPreview?.category || "General"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Subject: <span className="font-semibold text-foreground">{selectedTemplateForPreview?.subject}</span>
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center bg-accent/60 border p-0.5 rounded-xl text-xs shrink-0 mr-6">
              <button
                type="button"
                onClick={() => setTemplatePreviewMode('visual')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${templatePreviewMode === 'visual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Eye size={13} /> Live Preview
              </button>
              <button
                type="button"
                onClick={() => setTemplatePreviewMode('html')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${templatePreviewMode === 'html' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Code2 size={13} /> HTML Code
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/80 dark:bg-slate-950/60 custom-scrollbar" style={{ height: '78vh', minHeight: '520px' }}>
            {templatePreviewMode === 'visual' ? (
              <div className="w-full max-w-[680px] mx-auto bg-white text-gray-900 rounded-2xl shadow-md border border-slate-200/80 p-6 sm:p-8 overflow-hidden leading-relaxed text-sm email-template-canvas">
                <div
                  dangerouslySetInnerHTML={{
                    __html: scopeTemplateHtml((selectedTemplateForPreview?.content || '').replace(/\{\{name\}\}/gi, 'John Doe'))
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-full min-h-[500px] flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden text-left shadow-md">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80 text-xs">
                  <span className="font-mono text-emerald-400 font-bold text-[11px]">Raw HTML Source Code</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTemplateForPreview?.content) {
                        navigator.clipboard.writeText(selectedTemplateForPreview.content);
                        toast.success("HTML code copied to clipboard!");
                      }
                    }}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy size={11} /> Copy Code
                  </button>
                </div>
                <textarea
                  id="template-preview-code-content"
                  name="template_preview_code_content"
                  aria-label="Template HTML Source Code"
                  readOnly
                  value={selectedTemplateForPreview?.content || ''}
                  className="w-full flex-1 p-5 bg-transparent text-emerald-300 font-mono text-xs outline-none resize-none custom-scrollbar min-h-[440px]"
                />
              </div>
            )}
          </div>

          <DialogFooter className="p-3.5 px-6 border-t bg-white dark:bg-card shrink-0 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Dynamic placeholder <span className="font-mono bg-accent px-1.5 py-0.5 rounded text-primary">{'{{name}}'}</span> will be populated for each recipient.
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsTemplatePreviewModalOpen(false)}
                className="btn-secondary text-xs h-9 px-4"
              >
                Close
              </button>
              {selectedTemplateForPreview && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplatePreviewModalOpen(false);
                      handleOpenEditTemplate(selectedTemplateForPreview);
                    }}
                    className="h-9 px-3.5 bg-accent/60 hover:bg-accent text-foreground border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 size={12} /> Edit Template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplatePreviewModalOpen(false);
                      injectDbTemplate(selectedTemplateForPreview);
                    }}
                    className="btn-primary text-xs h-9 px-4 bg-primary hover:bg-primary/95 text-white flex items-center gap-1.5 shadow-sm font-bold"
                  >
                    <Send size={13} /> Use in New Campaign
                  </button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG: DELETE CAMPAIGN CONFIRMATION POPUP --- */}
      <Dialog open={isDeleteCampaignModalOpen} onOpenChange={setIsDeleteCampaignModalOpen}>
        <DialogContent className="w-[90vw] max-w-md p-6 dark:bg-card">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-destructive/10 text-destructive rounded-2xl shrink-0 mt-0.5">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-2 text-left">
              <DialogTitle className="text-base font-bold text-foreground">
                Delete Campaign?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete <strong className="text-foreground">"{campaignToDelete?.title}"</strong>? This will permanently remove the campaign, its recipient logs, and all tracking analytics. This action cannot be undone.
              </DialogDescription>
            </div>
          </div>

          <DialogFooter className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDeleteCampaignModalOpen(false)}
              className="btn-secondary text-xs h-9 px-4 font-bold"
              disabled={deletingCampaign}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteCampaign}
              disabled={deletingCampaign}
              className="h-9 px-4 bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {deletingCampaign ? (
                <><Loader2 size={13} className="animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 size={13} /> Yes, Delete Campaign</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG: DELETE SEGMENT / LIST CONFIRMATION POPUP --- */}
      <Dialog open={isDeleteSegmentModalOpen} onOpenChange={setIsDeleteSegmentModalOpen}>
        <DialogContent className="w-[90vw] max-w-md p-6 dark:bg-card">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-destructive/10 text-destructive rounded-2xl shrink-0 mt-0.5">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-2 text-left">
              <DialogTitle className="text-base font-bold text-foreground">
                Delete List / Segment?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete <strong className="text-foreground">"{segmentToDelete?.name}"</strong>? This will remove this recipient audience list ({segmentToDelete?.contacts?.length || 0} contacts) from your CRM. Existing email campaigns referencing past dispatches will not be lost.
              </DialogDescription>
            </div>
          </div>

          <DialogFooter className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteSegmentModalOpen(false);
                setSegmentToDelete(null);
              }}
              className="btn-secondary text-xs h-9 px-4 font-bold cursor-pointer"
              disabled={deletingSegment}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteSegment}
              disabled={deletingSegment}
              className="h-9 px-4 bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {deletingSegment ? (
                <><Loader2 size={13} className="animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 size={13} /> Yes, Delete List / Segment</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG: CONFIRM DELETE EMAIL TEMPLATE --- */}
      <Dialog open={isDeleteTemplateModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDeleteTemplateModalOpen(false);
          setTemplateToDelete(null);
        }
      }}>
        <DialogContent className="w-[90vw] max-w-md p-6 dark:bg-card">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-destructive/10 text-destructive rounded-2xl shrink-0 mt-0.5">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-2 text-left">
              <DialogTitle className="text-base font-bold text-foreground">
                Delete Email Template?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to delete <strong className="text-foreground">"{templateToDelete?.name}"</strong> ({templateToDelete?.category || 'General'})? This will permanently remove this reusable email template from your database. Past campaigns created with this template will not be affected.
              </DialogDescription>
            </div>
          </div>

          <DialogFooter className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteTemplateModalOpen(false);
                setTemplateToDelete(null);
              }}
              className="btn-secondary text-xs h-9 px-4 font-bold cursor-pointer"
              disabled={deletingTemplate}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteTemplate}
              disabled={deletingTemplate}
              className="h-9 px-4 bg-destructive hover:bg-destructive/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {deletingTemplate ? (
                <><Loader2 size={13} className="animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 size={13} /> Yes, Delete Template</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG 9: AI PERSONALIZED CAMPAIGN WIZARD --- */}
      <AiPersonalizedCampaignModal
        isOpen={isAiPersonalizedModalOpen}
        onClose={() => setIsAiPersonalizedModalOpen(false)}
        segments={segments}
        templates={templates}
        onCampaignCreated={() => {
          fetchCampaigns();
        }}
      />

    </AppLayout>
  );
}
