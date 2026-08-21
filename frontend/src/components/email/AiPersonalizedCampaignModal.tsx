import React, { useState } from "react";
import { 
  Sparkles, 
  X, 
  Send, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  User, 
  Mail, 
  Building, 
  MessageSquare, 
  FileText, 
  Edit3, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Wand2, 
  Search,
  Eye,
  Check,
  Layout,
  Layers,
  Palette,
  Maximize2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "../../api/api";

interface Segment {
  _id: string;
  name: string;
  description?: string;
  type: "dynamic" | "static" | "campaign" | "csv";
  contacts?: any[];
}

interface DbTemplate {
  _id: string;
  name: string;
  category: string;
  subject: string;
  content: string;
  isAiGenerated?: boolean;
}

interface DraftRecipient {
  leadId?: string | null;
  leadModel?: string;
  name: string;
  leadName?: string;
  contactTitle?: string;
  email: string;
  subject: string;
  body: string;
  contextReasoning?: string;
  historySummary?: {
    smsCount: number;
    emailCount: number;
    notesCount: number;
  };
}

interface AiPersonalizedCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: Segment[];
  templates?: DbTemplate[];
  onCampaignCreated?: () => void;
}

const PROMPT_SUGGESTIONS = [
  { label: "🏆 Spring Athletics Pitch", prompt: "Introduce our upcoming Spring youth sports clinics and after-school enrichment programs." },
  { label: "🔄 Follow-Up on Previous Discussions", prompt: "Follow up directly referencing our past conversations, proposals, or questions they asked." },
  { label: "🤝 Re-engage Inactive Accounts", prompt: "Warmly reconnect with schools and partners we haven't spoken with recently to explore upcoming season opportunities." },
  { label: "🏀 Basketball & PE Enrichment", prompt: "Propose customized basketball skill development camps and structured physical education coaching for students." }
];

const TONES = [
  "Professional & Warm",
  "Consultative & Helpful",
  "Direct & Value-Driven",
  "Enthusiastic & High-Energy"
];

export default function AiPersonalizedCampaignModal({
  isOpen,
  onClose,
  segments,
  templates = [],
  onCampaignCreated
}: AiPersonalizedCampaignModalProps) {
  // Step state: 1 = Setup, 2 = Review & Edit Matrix
  const [step, setStep] = useState<1 | 2>(1);

  // Setup Form
  const [campaignTitle, setCampaignTitle] = useState("");
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [campaignGoal, setCampaignGoal] = useState("");
  const [selectedTone, setSelectedTone] = useState("Professional & Warm");
  const [sampleLimit, setSampleLimit] = useState<string>("all");

  // Generation & Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [drafts, setDrafts] = useState<DraftRecipient[]>([]);
  const [totalSegmentCount, setTotalSegmentCount] = useState(0);

  // Review & Edit Matrix States
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardViewModes, setCardViewModes] = useState<{ [email: string]: 'visual' | 'html' }>({});
  const [fullViewDraft, setFullViewDraft] = useState<DraftRecipient | null>(null);
  const [regeneratingEmail, setRegeneratingEmail] = useState<string | null>(null);
  const [customRegenPrompt, setCustomRegenPrompt] = useState<{ [email: string]: string }>({});
  const [showRegenPromptBox, setShowRegenPromptBox] = useState<string | null>(null);

  // Dispatch States
  const [isDispatching, setIsDispatching] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");

  const activeTemplate = templates.find(t => t._id === selectedTemplateId);

  const resetModal = () => {
    setStep(1);
    setCampaignTitle("");
    setSelectedSegmentId("");
    setSelectedTemplateId("");
    setShowTemplatePreview(false);
    setCampaignGoal("");
    setSelectedTone("Professional & Warm");
    setSampleLimit("all");
    setDrafts([]);
    setIsGenerating(false);
    setIsDispatching(false);
    setIsScheduled(false);
    setScheduledDate("");
    setExpandedCardId(null);
    setEditingCardId(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Step 1: Generate AI Personalized Drafts with Template Preservation (Fast 5-Contact Preview)
  const handleGeneratePreview = async () => {
    if (!campaignTitle.trim()) {
      toast.error("Please enter a campaign title.");
      return;
    }
    if (!selectedSegmentId) {
      toast.error("Please select a target audience list or segment.");
      return;
    }
    if (!campaignGoal.trim()) {
      toast.error("Please provide a campaign goal or key message for the AI.");
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress("Reading template styling & analyzing past SMS, Email, and Notes history...");

      const res = await api.post("/emails/campaigns/ai-personalized/preview", {
        segmentId: selectedSegmentId,
        templateId: selectedTemplateId || null,
        baseTemplateHtml: activeTemplate?.content || null,
        templateSubject: activeTemplate?.subject || null,
        campaignGoal: campaignGoal.trim(),
        tone: selectedTone,
        sampleLimit: 5
      });

      if (res.data?.success && res.data.drafts) {
        setDrafts(res.data.drafts);
        setTotalSegmentCount(res.data.totalSegmentCount || res.data.drafts.length);
        if (res.data.drafts.length > 0) {
          setExpandedCardId(res.data.drafts[0].email);
        }
        setStep(2);
        const count = res.data.drafts.length;
        toast.success(`Generated ${count} personalized draft${count === 1 ? '' : 's'} for review!`);
      } else {
        toast.error(res.data?.message || "Failed to generate AI drafts.");
      }
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to generate personalized drafts.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
    }
  };

  // Step 2: Regenerate Single Draft
  const handleRegenerateSingle = async (draft: DraftRecipient) => {
    try {
      setRegeneratingEmail(draft.email);
      const customInstruction = customRegenPrompt[draft.email] || "";

      const res = await api.post("/emails/campaigns/ai-personalized/regenerate-single", {
        leadId: draft.leadId,
        leadModel: draft.leadModel,
        email: draft.email,
        name: draft.name,
        templateId: selectedTemplateId || null,
        baseTemplateHtml: activeTemplate?.content || null,
        templateSubject: activeTemplate?.subject || null,
        campaignGoal,
        tone: selectedTone,
        customInstruction
      });

      if (res.data?.success && res.data.draft) {
        const updated = res.data.draft;
        setDrafts(prev => prev.map(d => d.email === draft.email ? { ...d, subject: updated.subject, body: updated.body, contextReasoning: updated.contextReasoning } : d));
        setShowRegenPromptBox(null);
        toast.success(`Regenerated draft for ${draft.name || draft.email}`);
      } else {
        toast.error("Could not regenerate draft.");
      }
    } catch (err: any) {
      console.error("Regenerate Error:", err);
      toast.error(err.response?.data?.message || "Regeneration failed.");
    } finally {
      setRegeneratingEmail(null);
    }
  };

  // Step 2: Remove a recipient from the campaign batch
  const handleRemoveDraft = (email: string) => {
    setDrafts(prev => prev.filter(d => d.email !== email));
    toast.info("Recipient removed from preview batch.");
  };

  // Step 2: Update draft subject/body inline
  const handleUpdateDraft = (email: string, field: "subject" | "body", value: string) => {
    setDrafts(prev => prev.map(d => d.email === email ? { ...d, [field]: value } : d));
  };

  // Step 2: Final Dispatch
  const handleDispatchCampaign = async () => {
    if (drafts.length === 0) {
      toast.error("No recipients in preview.");
      return;
    }

    if (isScheduled) {
      if (!scheduledDate) {
        toast.error("Please specify a scheduled send time.");
        return;
      }
      const scheduledTime = new Date(scheduledDate).getTime();
      if (isNaN(scheduledTime) || scheduledTime <= Date.now()) {
        toast.error("Scheduled time must be in the future. Please select an upcoming date and time.");
        return;
      }
    }

    try {
      setIsDispatching(true);
      const res = await api.post("/emails/campaigns/ai-personalized/dispatch", {
        title: campaignTitle.trim(),
        segmentId: selectedSegmentId,
        templateId: selectedTemplateId || null,
        campaignGoal,
        tone: selectedTone,
        drafts,
        sendAt: isScheduled ? new Date(scheduledDate).toISOString() : null
      });

      if (res.data?.success) {
        toast.success(res.data.message || "AI Campaign launched successfully!");
        if (onCampaignCreated) onCampaignCreated();
        handleClose();
      } else {
        toast.error(res.data?.message || "Failed to dispatch campaign.");
      }
    } catch (err: any) {
      console.error("Dispatch Error:", err);
      toast.error(err.response?.data?.message || "Campaign dispatch failed.");
    } finally {
      setIsDispatching(false);
    }
  };

  const filteredDrafts = drafts.filter(d => {
    const q = searchQuery.toLowerCase();
    return (
      (d.name || "").toLowerCase().includes(q) ||
      (d.email || "").toLowerCase().includes(q) ||
      (d.leadName || "").toLowerCase().includes(q) ||
      (d.subject || "").toLowerCase().includes(q)
    );
  });

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[96vw] max-w-6xl max-h-[94vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-transparent flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Sparkles size={20} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-bold">AI Personalized Campaign</DialogTitle>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Smart Outreach
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Generates personalized emails per lead matching your sample template design & previous interaction history.
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-accent/60 p-1 rounded-xl border text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  step === 1 ? 'bg-background text-foreground shadow-2xs font-bold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-primary text-primary-foreground font-bold' : 'bg-green-500 text-white'}`}>
                  {drafts.length > 0 && step === 2 ? <Check size={10} /> : "1"}
                </span>
                <span>Setup</span>
              </button>
              <ChevronRight size={13} className="text-muted-foreground" />
              <button
                type="button"
                disabled={drafts.length === 0}
                onClick={() => drafts.length > 0 && setStep(2)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
                  drafts.length === 0 
                    ? 'opacity-40 cursor-not-allowed text-muted-foreground' 
                    : step === 2 
                      ? 'bg-background text-foreground shadow-2xs font-bold cursor-pointer' 
                      : 'text-muted-foreground hover:text-foreground cursor-pointer'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground'}`}>
                  2
                </span>
                <span>Review & Send {drafts.length > 0 ? `(${drafts.length})` : ''}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: CONFIGURATION */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Section 1: Campaign Identity & Audience (2-Column Grid) */}
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                      Campaign Title <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Spring 2025 Athletic Partner Outreach"
                      value={campaignTitle}
                      onChange={e => setCampaignTitle(e.target.value)}
                      className="input-field w-full h-10 text-xs font-medium rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                      Target List / Segment <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={selectedSegmentId}
                      onChange={e => setSelectedSegmentId(e.target.value)}
                      className="input-field w-full h-10 text-xs font-medium bg-background cursor-pointer rounded-xl"
                    >
                      <option value="">-- Choose Target List / Segment --</option>
                      {segments.map(seg => (
                        <option key={seg._id} value={seg._id}>
                          {seg.name} ({seg.type}) {seg.contacts ? `• ${seg.contacts.length} contacts` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Design Template & AI Voice (2-Column Grid) */}
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sample Design Template Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Layout size={13} className="text-purple-500" /> Sample Design Template
                      </label>
                      {activeTemplate && (
                        <button
                          type="button"
                          onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                          className="text-[11px] text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={11} /> {showTemplatePreview ? "Hide Preview" : "Preview Layout"}
                        </button>
                      )}
                    </div>
                    <select
                      value={selectedTemplateId}
                      onChange={e => setSelectedTemplateId(e.target.value)}
                      className="input-field w-full h-10 text-xs font-medium bg-background cursor-pointer rounded-xl"
                    >
                      <option value="">-- AI Freeform Layout (No Template Design Constraint) --</option>
                      {templates.map(tmpl => (
                        <option key={tmpl._id} value={tmpl._id}>
                          {tmpl.name} [{tmpl.category || 'General'}] {tmpl.isAiGenerated ? '✨ AI Template' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tone of Voice Dropdown */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Palette size={13} className="text-blue-500" /> Tone of Voice
                    </label>
                    <select
                      value={selectedTone}
                      onChange={e => setSelectedTone(e.target.value)}
                      className="input-field w-full h-10 text-xs font-medium bg-background cursor-pointer rounded-xl"
                    >
                      <option value="Professional & Warm">👔 Professional & Warm (Recommended)</option>
                      <option value="Consultative & Helpful">🤝 Consultative & Helpful</option>
                      <option value="Direct & Value-Driven">🎯 Direct & Value-Driven</option>
                      <option value="Enthusiastic & High-Energy">⚡ Enthusiastic & High-Energy</option>
                      <option value="Casual & Conversational">☕ Casual & Conversational</option>
                    </select>
                  </div>
                </div>

                {/* Collapsible Sample Template Live Preview */}
                {activeTemplate && showTemplatePreview && (
                  <div className="mt-2 p-3 bg-accent/20 rounded-xl border border-purple-500/30 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2 border-b border-border/50">
                      <span><strong>Template Name:</strong> {activeTemplate.name}</span>
                      <span><strong>Category:</strong> {activeTemplate.category || 'General'}</span>
                    </div>
                    <div 
                      className="p-3 bg-white text-slate-900 rounded-lg overflow-y-auto max-h-48 text-xs border"
                      dangerouslySetInnerHTML={{ __html: activeTemplate.content }}
                    />
                  </div>
                )}
              </div>

              {/* Section 3: Campaign Goal & Batch Scope */}
              <div className="p-4 rounded-2xl bg-card border border-border shadow-2xs space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      Campaign Objective & Instructions <span className="text-destructive">*</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      AI incorporates each contact's communication history
                    </span>
                  </div>
                  
                  <textarea
                    rows={3}
                    placeholder="Describe what you want to achieve with this campaign. (e.g. Introduce our upcoming youth sports clinic and follow up on where we left off...)"
                    value={campaignGoal}
                    onChange={e => setCampaignGoal(e.target.value)}
                    className="input-field w-full text-xs font-medium p-3 rounded-xl resize-none"
                  />

                  {/* Quick Prompts */}
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-muted-foreground mr-1 flex items-center gap-1">
                      <Wand2 size={12} className="text-purple-500" /> Quick Ideas:
                    </span>
                    {PROMPT_SUGGESTIONS.map((item, idx) => {
                      const isActive = campaignGoal.includes(item.prompt);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCampaignGoal(prev => {
                              const existingSuggestion = PROMPT_SUGGESTIONS.find(s => prev.includes(s.prompt));
                              if (existingSuggestion) {
                                if (existingSuggestion.prompt === item.prompt) {
                                  // Toggle off: remove this prompt while keeping user custom notes
                                  return prev.replace(item.prompt, '').replace(/\s{2,}/g, ' ').trim();
                                } else {
                                  // Swap: replace the previous Quick Idea with this new one
                                  return prev.replace(existingSuggestion.prompt, item.prompt).trim();
                                }
                              } else {
                                if (!prev.trim()) return item.prompt;
                                return `${prev.trim()} ${item.prompt}`;
                              }
                            });
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all hover:scale-[1.02] cursor-pointer ${
                            isActive
                              ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300 font-bold ring-1 ring-purple-500/30'
                              : 'bg-accent hover:bg-accent/80 border-border text-foreground'
                          }`}
                          title={isActive ? "Click to remove this idea" : "Click to add or swap this idea"}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fast Preview Notice */}
                <div className="pt-2.5 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                    <Sparkles size={13} className="text-purple-500" />
                    <span>Instant Review Batch:</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">Up to 5 Sample Contacts (or full list)</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Full audience generated asynchronously on launch
                  </span>
                </div>
              </div>

              {/* Info Notice Box */}
              <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 flex items-start gap-2.5">
                <Sparkles size={16} className="text-purple-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">Template-Preserving AI Personalization: </span>
                  The AI analyzes each contact's logged <strong>SMS history</strong>, <strong>emails</strong>, and <strong>sales notes</strong>. If a sample template is selected, it retains the exact HTML colors, banner, and button styling while generating personalized text tailored to each recipient.
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & EDIT MATRIX */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Matrix Toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap bg-accent/40 p-3 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <Sparkles size={13} className="text-purple-500" /> Reviewing <span className="text-purple-600 dark:text-purple-400 font-extrabold">{drafts.length} Sample Drafts</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    (Audience Total: <strong className="text-foreground">{totalSegmentCount}</strong> recipients)
                  </span>
                  {activeTemplate && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20 font-bold">
                      Preserving: {activeTemplate.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search recipient or subject..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="input-field h-8 text-xs pl-8 w-full rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Background Generation Info Notice */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-blue-500 shrink-0" />
                  <span>These {drafts.length} reviewed drafts will be enqueued immediately. The remaining <strong>{Math.max(0, totalSegmentCount - drafts.length)}</strong> recipients in the segment will be generated on the server in the background.</span>
                </div>
              </div>

              {/* Draft Cards List */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {filteredDrafts.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-xs">
                    No recipients match your search filter.
                  </div>
                ) : (
                  filteredDrafts.map((draft) => {
                    const isExpanded = expandedCardId === draft.email;
                    const isEditing = editingCardId === draft.email;
                    const isRegenerating = regeneratingEmail === draft.email;
                    const showRegenBox = showRegenPromptBox === draft.email;

                    return (
                      <div
                        key={draft.email}
                        className={`rounded-xl border transition-all ${
                          isExpanded 
                            ? 'bg-card border-purple-500/40 shadow-md ring-1 ring-purple-500/20' 
                            : 'bg-card/70 border-border hover:border-border/80'
                        }`}
                      >
                        {/* Card Header Row */}
                        <div 
                          onClick={() => setExpandedCardId(isExpanded ? null : draft.email)}
                          className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-primary shrink-0 font-bold text-xs">
                              {draft.name ? draft.name.charAt(0).toUpperCase() : <User size={14} />}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground truncate">
                                  {draft.name || draft.email}
                                </span>
                                {draft.contactTitle && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    {draft.contactTitle}
                                  </span>
                                )}
                                {draft.leadName && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                                    {draft.leadName}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">
                                <span className="font-semibold text-foreground/80">Subject:</span> {draft.subject}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Context Count Badges */}
                            <div className="hidden sm:flex items-center gap-1.5">
                              {draft.historySummary?.smsCount ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold flex items-center gap-0.5" title="Past SMS messages">
                                  <MessageSquare size={10} /> {draft.historySummary.smsCount}
                                </span>
                              ) : null}
                              {draft.historySummary?.emailCount ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold flex items-center gap-0.5" title="Past emails">
                                  <Mail size={10} /> {draft.historySummary.emailCount}
                                </span>
                              ) : null}
                              {draft.historySummary?.notesCount ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold flex items-center gap-0.5" title="Sales & call notes">
                                  <FileText size={10} /> {draft.historySummary.notesCount}
                                </span>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDraft(draft.email);
                              }}
                              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Remove recipient from campaign"
                            >
                              <Trash2 size={13} />
                            </button>

                            {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Expanded Card Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-border/60 space-y-3">
                            {/* AI Reasoning Banner */}
                            {draft.contextReasoning && (
                              <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                <Sparkles size={13} className="shrink-0 text-purple-500" />
                                <span>
                                  <strong>AI Personalization Reason:</strong> {draft.contextReasoning}
                                </span>
                              </div>
                            )}

                            {/* Subject Line Field */}
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
                                Subject Line
                              </label>
                              <input
                                type="text"
                                value={draft.subject}
                                onChange={e => handleUpdateDraft(draft.email, "subject", e.target.value)}
                                className="input-field w-full h-8 text-xs font-semibold"
                              />
                            </div>

                            {/* Body Content View / Edit Toolbar */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Personalized Message Body {activeTemplate ? "(Template Design Applied)" : ""}
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setFullViewDraft(draft)}
                                    className="px-2 py-0.5 rounded-lg border text-[11px] font-bold text-primary hover:bg-primary/10 flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Open full view modal"
                                  >
                                    <Maximize2 size={11} /> Full View / Flow
                                  </button>
                                  <div className="flex items-center bg-accent/60 p-0.5 rounded-lg border text-[10px]">
                                    <button
                                      type="button"
                                      onClick={() => setCardViewModes(prev => ({ ...prev, [draft.email]: 'visual' }))}
                                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                        (cardViewModes[draft.email] || 'visual') === 'visual'
                                          ? 'bg-card text-foreground shadow-2xs'
                                          : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      👁️ Visual View
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCardViewModes(prev => ({ ...prev, [draft.email]: 'html' }))}
                                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                        cardViewModes[draft.email] === 'html'
                                          ? 'bg-card text-foreground shadow-2xs'
                                          : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                    >
                                      ✏️ HTML Code
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {(cardViewModes[draft.email] || 'visual') === 'visual' ? (
                                <div className="border rounded-xl bg-slate-100 dark:bg-slate-900/60 p-4 sm:p-5 min-h-[280px] max-h-[440px] overflow-y-auto custom-scrollbar shadow-inner flex justify-center">
                                  <div className="w-full max-w-[620px] bg-white text-gray-900 rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 self-start">
                                    <div dangerouslySetInnerHTML={{ __html: draft.body }} />
                                  </div>
                                </div>
                              ) : (
                                <div className="border rounded-xl bg-slate-950 p-3 min-h-[280px] flex flex-col">
                                  <textarea
                                    rows={12}
                                    value={draft.body}
                                    onChange={e => handleUpdateDraft(draft.email, "body", e.target.value)}
                                    placeholder="<!-- Paste or edit email HTML here -->"
                                    className="w-full h-[300px] bg-transparent border-none outline-none resize-none text-emerald-400 font-mono text-xs custom-scrollbar"
                                    spellCheck={false}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Card Footer Actions */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isRegenerating}
                                  onClick={() => setShowRegenPromptBox(showRegenBox ? null : draft.email)}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border border-purple-500/30 text-purple-600 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                  Regenerate Draft
                                </button>
                              </div>

                              <span className="text-[10px] text-muted-foreground">
                                Recipient: {draft.email}
                              </span>
                            </div>

                            {/* Custom Regenerate Prompt Box */}
                            {showRegenBox && (
                              <div className="p-3 rounded-lg bg-accent/60 border border-border space-y-2 mt-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                  Custom Instruction for {draft.name || 'this contact'} (Optional):
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Focus on basketball gym schedule and keep it under 3 paragraphs..."
                                  value={customRegenPrompt[draft.email] || ""}
                                  onChange={e => setCustomRegenPrompt(prev => ({ ...prev, [draft.email]: e.target.value }))}
                                  className="input-field w-full h-8 text-xs"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShowRegenPromptBox(null)}
                                    className="text-[11px] px-2 py-1 rounded text-muted-foreground hover:text-foreground"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isRegenerating}
                                    onClick={() => handleRegenerateSingle(draft)}
                                    className="btn-primary text-[11px] px-3 py-1 font-bold flex items-center gap-1"
                                  >
                                    {isRegenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                    Run AI Single Re-write
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Scheduling Section */}
              <div className="p-3.5 rounded-xl bg-accent/40 border border-border flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="scheduleCampaign"
                    checked={isScheduled}
                    onChange={e => setIsScheduled(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                  <label htmlFor="scheduleCampaign" className="text-xs font-bold cursor-pointer select-none flex items-center gap-1.5">
                    <Calendar size={14} className="text-primary" /> Schedule Campaign for Later
                  </label>
                </div>

                {isScheduled && (
                  <div className="space-y-1">
                    <input
                      type="datetime-local"
                      value={scheduledDate}
                      min={(() => {
                        const now = new Date();
                        now.setMinutes(now.getMinutes() + 1);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                      })()}
                      onChange={e => {
                        const val = e.target.value;
                        if (val && new Date(val).getTime() <= Date.now()) {
                          toast.warning("Please choose a future date and time.");
                        }
                        setScheduledDate(val);
                      }}
                      className="input-field h-8 text-xs font-medium rounded-lg"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Personalized emails will automatically dispatch at this scheduled time.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-accent/20 flex items-center justify-between shrink-0">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>

              {drafts.length > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={handleGeneratePreview}
                    className="px-4 py-2.5 rounded-xl border border-purple-500/30 text-purple-600 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Generate a brand new set of drafts based on current setup"
                  >
                    {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    <span>Regenerate Fresh AI Drafts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl cursor-pointer"
                  >
                    <span>Return to Review & Send ({drafts.length})</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleGeneratePreview}
                  className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Analyzing History & Generating Drafts...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Generate AI Personalized Drafts</span>
                    </>
                  )}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                &larr; Back to Setup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isDispatching || drafts.length === 0}
                  onClick={handleDispatchCampaign}
                  className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/25 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl"
                >
                  {isDispatching ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Dispatching to Queue...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>{isScheduled ? "Schedule AI Campaign" : `Launch Campaign for All ${totalSegmentCount || drafts.length} Recipients`}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* --- FULL VIEW / FLOW INSPECTOR MODAL --- */}
    <Dialog open={!!fullViewDraft} onOpenChange={() => setFullViewDraft(null)}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <div className="p-4 border-b bg-muted/40 flex items-center justify-between pr-12">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Eye size={16} />
            </span>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Full Template Flow: {fullViewDraft?.name || fullViewDraft?.email}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate max-w-lg">
                Subject: {fullViewDraft?.subject}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900/60 flex justify-center custom-scrollbar">
          <div className="w-full max-w-[640px] bg-white text-gray-900 rounded-2xl shadow-md border border-slate-200 p-6 self-start">
            <div dangerouslySetInnerHTML={{ __html: fullViewDraft?.body || "" }} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
