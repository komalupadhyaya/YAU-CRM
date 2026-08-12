import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import api from '../api/api';
import { useSMS } from '../context/SMSContext';
import { useAuth } from '../context/AuthContext';
import { can } from '../utils/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  MessageSquare,
  Search,
  Send,
  Loader2,
  Check,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  User,
  Users,
  Phone,
  ArrowLeft,
  Sparkles,
  Building,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Filter,
  Wand2,
  X,
  ChevronDown
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSquarePlus, Plus, PhoneOff, CheckCircle2 } from 'lucide-react';

export interface SMSMessageItem {
  _id?: string;
  direction: 'inbound' | 'outbound';
  message: string;
  timestamp: string;
  status?: 'pending' | 'sent' | 'failed' | 'received' | 'undelivered' | 'delivered';
  twilioSid?: string;
  isRead?: boolean;
  isBulk?: boolean;
}

export interface SMSConversation {
  _id: string;
  leadType: 'ea_lead' | 'main_lead';
  name: string;
  email?: string;
  phone: string;
  categoryTag: string;
  isConsent?: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageTimestamp: string;
  smsHistory: SMSMessageItem[];
}

export interface AvailableLeadItem {
  _id: string;
  leadType: 'ea_lead' | 'main_lead';
  name: string;
  contactName?: string;
  rawName?: string;
  email?: string;
  phone: string;
  categoryTag: string;
  isConsent?: boolean;
  createdAt?: string;
}

export default function SMSMessages() {
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const { markAsRead } = useSMS();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<SMSConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'ea_lead' | 'main_lead' | 'unread'>('all');
  const [chatMessageFilter, setChatMessageFilter] = useState<'all' | 'direct' | 'bulk'>('all');

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(searchParams.get('leadId'));
  const selectedLeadIdRef = useRef<string | null>(selectedLeadId);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Active in-memory draft lead (for initiating conversations with uncontacted leads)
  const [draftLead, setDraftLead] = useState<SMSConversation | null>(null);
  const draftLeadRef = useRef<SMSConversation | null>(null);

  useEffect(() => {
    draftLeadRef.current = draftLead;
  }, [draftLead]);

  // New Chat Modal state (Admin & Manager only)
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [availableLeads, setAvailableLeads] = useState<AvailableLeadItem[]>([]);
  const [loadingAvailableLeads, setLoadingAvailableLeads] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatFilter, setNewChatFilter] = useState<'all' | 'ea_lead' | 'main_lead'>('all');

  // Keep ref synchronized with state
  useEffect(() => {
    selectedLeadIdRef.current = selectedLeadId;
    setChatMessageFilter('all');
  }, [selectedLeadId]);

  // AI Suggest state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const lastReadLeadIdRef = useRef<string | null>(null);

  // Keep selectedLeadId in sync when URL search param changes
  useEffect(() => {
    const paramId = searchParams.get('leadId');
    if (paramId !== selectedLeadIdRef.current) {
      setSelectedLeadId(paramId);
    }
  }, [searchParams]);

  // Fetch available leads for new chat modal
  const handleOpenNewChat = async () => {
    setShowNewChatModal(true);
    setNewChatSearch('');
    setNewChatFilter('all');
    setLoadingAvailableLeads(true);
    try {
      const res = await api.get('/sms/available-leads');
      setAvailableLeads(res.data || []);
    } catch (err) {
      console.error('Failed to load available leads for new chat:', err);
      toast.error('Failed to load available leads');
    } finally {
      setLoadingAvailableLeads(false);
    }
  };

  const handleSelectConversation = (leadId: string) => {
    if (draftLead && String(draftLead._id) !== String(leadId) && draftLead.smsHistory.length === 0) {
      setDraftLead(null);
      setConversations(prev => prev.filter(c => String(c._id) !== String(draftLead._id)));
    }
    setSelectedLeadId(leadId);
    if (searchParams.get('leadId') !== leadId) {
      setSearchParams({ leadId }, { replace: true });
    }
  };

  const handleSelectLeadForNewChat = (lead: AvailableLeadItem) => {
    if (!lead.phone) {
      toast.error(`"${lead.name}" does not have a phone number configured.`);
      return;
    }

    // Check if this lead already exists in conversations
    const existing = conversations.find(c => String(c._id) === String(lead._id));
    if (existing) {
      setDraftLead(null);
      handleSelectConversation(existing._id);
    } else {
      // Create a draft conversation in local state so admin/manager can write the initial message
      const draftConv: SMSConversation = {
        _id: lead._id,
        leadType: lead.leadType,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        categoryTag: lead.categoryTag,
        isConsent: lead.isConsent ?? true,
        unreadCount: 0,
        lastMessage: '',
        lastMessageTimestamp: new Date().toISOString(),
        smsHistory: []
      };
      setDraftLead(draftConv);
      draftLeadRef.current = draftConv;
      setConversations(prev => [draftConv, ...prev.filter(c => String(c._id) !== String(draftConv._id))]);
      handleSelectConversation(draftConv._id);
    }

    setShowNewChatModal(false);
  };

  // Fetch all conversations
  const fetchConversations = async (isQuiet = false) => {
    if (!isQuiet) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await api.get('/sms/conversations');
      const data: SMSConversation[] = res.data || [];

      // Check if draft lead has now been saved in DB backend
      const currentDraft = draftLeadRef.current;
      let finalConversations = data;

      if (currentDraft) {
        const foundInBackend = data.find(c => String(c._id) === String(currentDraft._id));
        if (foundInBackend) {
          // It is now persisted in backend, clear draft lead
          setDraftLead(null);
        } else {
          // Keep draft lead at the top of the conversations list so it doesn't vanish during background polling
          finalConversations = [currentDraft, ...data.filter(c => String(c._id) !== String(currentDraft._id))];
        }
      }

      setConversations(finalConversations);
    } catch (err) {
      console.error('Failed to load SMS conversations:', err);
      if (!isQuiet) toast.error('Failed to load SMS conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
    setManualRefreshing(true);
    try {
      await fetchConversations(true);
    } finally {
      setTimeout(() => {
        setManualRefreshing(false);
      }, 650);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Mark active conversation as read when selected
  useEffect(() => {
    if (!selectedLeadId) {
      lastReadLeadIdRef.current = null;
      return;
    }
    if (lastReadLeadIdRef.current === selectedLeadId) return;
    lastReadLeadIdRef.current = selectedLeadId;

    const conv = conversations.find(c => String(c._id) === String(selectedLeadId));
    if (conv && conv.unreadCount > 0) {
      markAsRead(conv._id, conv.leadType);
      setConversations(prev =>
        prev.map(c => (String(c._id) === String(selectedLeadId) ? { ...c, unreadCount: 0 } : c))
      );
    }
  }, [selectedLeadId]);

  // Scroll to bottom of chat history when selection or history changes
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [selectedLeadId, conversations, chatMessageFilter]);

  // Selected conversation object
  const activeConversation = useMemo(() => {
    return conversations.find(c => String(c._id) === String(selectedLeadId)) || null;
  }, [conversations, selectedLeadId]);

  // Message stats and filtered messages in active conversation
  const { hasBulkMessages, directCount, bulkCount, displayedMessages } = useMemo(() => {
    if (!activeConversation) {
      return { hasBulkMessages: false, directCount: 0, bulkCount: 0, displayedMessages: [] };
    }
    const history = activeConversation.smsHistory || [];
    const direct = history.filter(m => !m.isBulk);
    const bulk = history.filter(m => m.isBulk);
    const hasBulk = bulk.length > 0;

    let filtered = history;
    if (chatMessageFilter === 'direct') filtered = direct;
    else if (chatMessageFilter === 'bulk') filtered = bulk;

    return {
      hasBulkMessages: hasBulk,
      directCount: direct.length,
      bulkCount: bulk.length,
      displayedMessages: filtered
    };
  }, [activeConversation, chatMessageFilter]);

  // Filtered conversation list
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'ea_lead') return c.leadType === 'ea_lead';
      if (activeFilter === 'main_lead') return c.leadType === 'main_lead';
      if (activeFilter === 'unread') return c.unreadCount > 0;

      return true;
    });
  }, [conversations, searchQuery, activeFilter]);

  // Filtered available leads for New Chat modal
  const filteredAvailableLeads = useMemo(() => {
    return availableLeads.filter(lead => {
      const q = newChatSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        lead.name.toLowerCase().includes(q) ||
        (lead.contactName && lead.contactName.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.includes(q)) ||
        (lead.email && lead.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (newChatFilter === 'ea_lead') return lead.leadType === 'ea_lead';
      if (newChatFilter === 'main_lead') return lead.leadType === 'main_lead';

      return true;
    });
  }, [availableLeads, newChatSearch, newChatFilter]);

  const eaAvailableCount = useMemo(() => availableLeads.filter(l => l.leadType === 'ea_lead').length, [availableLeads]);
  const mainAvailableCount = useMemo(() => availableLeads.filter(l => l.leadType === 'main_lead').length, [availableLeads]);

  // Handle send 1-on-1 SMS
  const handleSendSMS = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConversation || !replyText.trim() || sending) return;

    setSending(true);
    const messageBody = replyText.trim();

    try {
      const res = await api.post('/sms/send-chat-sms', {
        leadId: activeConversation._id,
        leadType: activeConversation.leadType,
        message: messageBody
      });

      setReplyText('');
      toast.success('SMS message sent successfully');

      // Clear draft lead now that it is sent and persisted
      setDraftLead(null);

      // Update conversation in state locally
      const newHistory: SMSMessageItem[] = res.data.smsHistory || [
        ...activeConversation.smsHistory,
        res.data.data
      ];

      setConversations(prev =>
        prev.map(c => {
          if (c._id === activeConversation._id) {
            return {
              ...c,
              lastMessage: messageBody,
              lastMessageTimestamp: new Date().toISOString(),
              smsHistory: newHistory
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      console.error('Failed to send SMS:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to send SMS message';
      toast.error(errMsg);

      // Record failed message in local conversation history so the user sees the red error indicator
      const failedMsg: SMSMessageItem = {
        _id: `failed-${Date.now()}`,
        direction: 'outbound',
        message: messageBody,
        timestamp: new Date().toISOString(),
        status: 'failed',
        isRead: true
      };

      setConversations(prev =>
        prev.map(c => {
          if (c._id === activeConversation._id) {
            return {
              ...c,
              lastMessage: messageBody,
              lastMessageTimestamp: new Date().toISOString(),
              smsHistory: [...c.smsHistory, failedMsg]
            };
          }
          return c;
        })
      );
    } finally {
      setSending(false);
    }
  };

  // Handle AI message generation
  const handleAiGenerate = async () => {
    if (!activeConversation || aiGenerating) return;

    setAiGenerating(true);
    try {
      const res = await api.post('/sms/ai-generate-sms', {
        leadId:    activeConversation._id,
        leadType:  activeConversation.leadType,
        userPrompt: aiPrompt.trim() || undefined
      });

      const draft: string = res.data.draft || '';
      if (!draft) {
        toast.error('AI returned an empty draft. Please try again.');
        return;
      }

      setReplyText(draft);
      setShowAiPanel(false);
      setAiPrompt('');
      toast.success('AI draft ready — review and send!');
    } catch (err: any) {
      console.error('AI generate error:', err);
      toast.error(err.response?.data?.error || 'Failed to generate AI message');
    } finally {
      setAiGenerating(false);
    }
  };

  // Format date display for timestamps
  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return 'Today';
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // SMS character counter calculation
  const smsSegments = useMemo(() => {
    const len = replyText.length;
    if (len <= 160) return { chars: len, max: 160, segments: 1 };
    return { chars: len, max: 153 * Math.ceil(len / 153), segments: Math.ceil(len / 153) };
  }, [replyText]);

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col -m-6 overflow-hidden bg-background">
        
        {/* Top Header Bar */}
        <div className="h-14 px-6 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <MessageSquare size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-none">SMS Inbox</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time 2-way text messaging with leads
              </p>
            </div>
            {/* Role-scoped view indicator */}
            {currentUser?.role === 'sales_rep' && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Your assigned leads only
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isPrivileged && (
              <Button
                size="sm"
                onClick={handleOpenNewChat}
                className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
              >
                <MessageSquarePlus size={14} />
                <span>New Chat</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={manualRefreshing || refreshing}
              className="h-8 gap-1.5 text-xs border-border transition-all active:scale-95 hover:bg-accent/70"
            >
              <RefreshCw
                size={14}
                className={`transition-transform duration-700 ease-in-out ${
                  manualRefreshing || refreshing ? 'animate-spin' : 'group-hover:rotate-180'
                }`}
              />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT PANE: Active Conversations List */}
          <div className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col flex-shrink-0 relative">
            
            {/* Search & Filter Header */}
            <div className="p-3 border-b border-border space-y-2 flex-shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 bg-background border-border w-full"
                />
              </div>

              {/* Filter Tabs — hide EA Leads tab for sales_rep (they have no EA lead access) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {[
                  { id: 'all', label: 'All' },
                  ...(currentUser?.role !== 'sales_rep' ? [{ id: 'ea_lead', label: 'EA Leads' }] : []),
                  { id: 'main_lead', label: 'CRM Leads' },
                  { id: 'unread', label: 'Unread' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                      activeFilter === tab.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Loader2 size={24} className="animate-spin mb-2 text-primary" />
                  <p className="text-xs">Loading SMS conversations...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
                  <MessageSquare size={32} className="mb-2 opacity-20" />
                  <p className="text-sm font-semibold">No conversations found</p>
                  <p className="text-xs mt-1 opacity-70">
                    {searchQuery
                      ? 'Try adjusting your search query'
                      : currentUser?.role === 'sales_rep'
                        ? 'No SMS conversations for your assigned leads yet'
                        : 'Inbound and outbound SMS messages will appear here'}
                  </p>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isSelected = String(conv._id) === String(selectedLeadId);
                  return (
                    <div
                      key={conv._id}
                      onClick={() => handleSelectConversation(conv._id)}
                      className={`p-3.5 border-b border-border/40 cursor-pointer transition-all flex items-start gap-3 relative ${
                        isSelected
                          ? 'bg-primary/10 border-l-4 border-l-primary'
                          : conv.unreadCount > 0
                          ? 'bg-primary/5 hover:bg-accent/70'
                          : 'hover:bg-accent/40'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                        {conv.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {conv.name}
                          </h4>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                            {formatTime(conv.lastMessageTimestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                              conv.leadType === 'ea_lead'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {conv.categoryTag}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate">
                            {conv.phone}
                          </span>
                        </div>

                        <p
                          className={`text-xs mt-1 truncate ${
                            conv.unreadCount > 0
                              ? 'font-bold text-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {conv.lastMessage || 'No messages yet'}
                        </p>
                      </div>

                      {/* Unread Badge */}
                      {conv.unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] font-extrabold rounded-full flex items-center justify-center shrink-0 self-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* WhatsApp-Style Floating Action Button (FAB) at Bottom Right */}
            {isPrivileged && (
              <div className="absolute bottom-5 right-5 z-20">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      onClick={handleOpenNewChat}
                      className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 border-2 border-background"
                      aria-label="Start New Chat"
                    >
                      <MessageSquarePlus size={22} className="stroke-[2.2]" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="p-2 text-xs font-semibold shadow-lg bg-popover text-popover-foreground border border-border">
                    Start new conversation
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* RIGHT PANE: Chat History & Reply */}
          <div className="flex-1 flex flex-col bg-muted/10 overflow-hidden">
            {!activeConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <MessageSquare size={48} className="mb-4 opacity-15 text-primary" />
                <h3 className="text-base font-bold text-foreground">Select a conversation</h3>
                <p className="text-xs max-w-sm mt-1 opacity-70">
                  Choose a lead from the left pane to view full chronological SMS history and send replies.
                </p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="h-14 px-6 border-b border-border bg-card flex items-center justify-between flex-shrink-0 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0">
                      {activeConversation.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground truncate">
                          {activeConversation.name}
                        </h3>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 ${
                            activeConversation.leadType === 'ea_lead'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {activeConversation.categoryTag}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 truncate">
                        <span>{activeConversation.phone}</span>
                        {activeConversation.isConsent && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                            <ShieldCheck size={12} /> Consented
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* In-Thread Message Sub-Filter */}
                    {hasBulkMessages && (
                      <div className="hidden sm:flex items-center bg-muted/70 p-0.5 rounded-lg border border-border text-[11px] font-medium">
                        <button
                          type="button"
                          onClick={() => setChatMessageFilter('all')}
                          className={`px-2 py-0.5 rounded-md transition-all ${
                            chatMessageFilter === 'all'
                              ? 'bg-background text-foreground shadow-sm font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          All ({activeConversation.smsHistory.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setChatMessageFilter('direct')}
                          className={`px-2 py-0.5 rounded-md transition-all ${
                            chatMessageFilter === 'direct'
                              ? 'bg-background text-foreground shadow-sm font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Direct ({directCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setChatMessageFilter('bulk')}
                          className={`px-2 py-0.5 rounded-md transition-all flex items-center gap-1 ${
                            chatMessageFilter === 'bulk'
                              ? 'bg-background text-foreground shadow-sm font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Users size={10} /> Bulk ({bulkCount})
                        </button>
                      </div>
                    )}

                    {activeConversation.leadType === 'ea_lead' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/ea-leads')}
                        className="h-8 gap-1.5 text-xs border-border"
                      >
                        <Sparkles size={14} className="text-amber-500" />
                        <span>View EA Lead</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/lead/${activeConversation._id}`)}
                        className="h-8 gap-1.5 text-xs border-border"
                      >
                        <Building size={14} className="text-blue-500" />
                        <span>View Lead Details</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Message Stream */}
                <div ref={chatScrollRef} className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">
                  {displayedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 border border-primary/20">
                        <MessageSquarePlus size={28} />
                      </div>
                      <h3 className="text-sm font-bold text-foreground">
                        Start conversation with {activeConversation.name}
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                        {chatMessageFilter === 'bulk'
                          ? 'No bulk SMS messages for this lead.'
                          : chatMessageFilter === 'direct'
                          ? 'No direct SMS messages for this lead.'
                          : 'No previous SMS messages found. Type your first message below or use AI Suggest to generate a personalized introduction.'}
                      </p>
                    </div>
                  ) : (
                    displayedMessages.map((msg, index) => {
                      const isInbound = msg.direction === 'inbound';
                      const isFailed = !isInbound && (msg.status === 'failed' || msg.status === 'undelivered');
                      return (
                        <div
                          key={msg._id || `${msg.timestamp}-${index}`}
                          className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                        >
                          {/* Bubble Container */}
                          <div className={`flex items-center gap-2 max-w-[80%] ${isInbound ? 'justify-start mr-auto' : 'justify-end ml-auto'}`}>
                            {!isInbound && msg.isBulk && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer bg-secondary border border-border p-1 rounded-full transition-colors shrink-0">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                      <circle cx="9" cy="7" r="4" />
                                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                    </svg>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="p-1.5 text-[10px] shadow-md bg-popover text-popover-foreground rounded border border-border">
                                  Bulk Message
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <div
                              className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                                isInbound
                                  ? 'bg-card text-card-foreground border border-border rounded-tl-none'
                                  : isFailed
                                  ? 'bg-destructive/15 text-foreground border border-destructive/40 rounded-tr-none'
                                  : 'bg-primary text-primary-foreground rounded-tr-none'
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words font-sans">{msg.message}</p>
                            </div>
                          </div>

                          {/* Message Meta / Timestamp / Status */}
                          <div
                            className={`flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground px-1 font-medium`}
                          >
                            <span>{formatTime(msg.timestamp)}</span>
                            {!isInbound && (
                              <span>
                                {isFailed ? (
                                  <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                                    <AlertCircle size={12} className="inline stroke-[2.5]" />
                                    <span>Not sent</span>
                                  </span>
                                ) : (
                                  <CheckCheck size={13} className="text-emerald-500 inline stroke-[2.5]" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Input Area */}
                <div className="p-4 border-t border-border bg-card flex-shrink-0">
                  <form onSubmit={handleSendSMS} className="space-y-2">

                    {/* AI Suggest Panel */}
                    {showAiPanel && (
                      <div className="mb-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Wand2 size={13} className="text-violet-500" />
                            <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400">
                              AI Message Assistant
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setShowAiPanel(false); setAiPrompt(''); }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-[10px] text-muted-foreground">
                            What's the goal of this message?
                          </p>
                          <Textarea
                            id="ai-prompt-input"
                            placeholder='e.g. "Follow up on proposal", "Schedule a meeting", "Check if they got our email"'
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAiGenerate();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowAiPanel(false);
                                setAiPrompt('');
                              }
                            }}
                            className="min-h-[56px] max-h-28 text-xs bg-background border-border resize-none py-2 custom-scrollbar"
                            autoFocus
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            id="ai-generate-btn"
                            type="button"
                            size="sm"
                            onClick={handleAiGenerate}
                            disabled={aiGenerating}
                            className="h-7 px-3 text-[11px] font-semibold gap-1.5 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                          >
                            {aiGenerating ? (
                              <><Loader2 size={12} className="animate-spin" /> Generating...</>
                            ) : (
                              <><Wand2 size={12} /> Generate Draft</>
                            )}
                          </Button>
                          <p className="text-[10px] text-muted-foreground">
                            Analyses last 10 messages · Fills compose box
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="relative flex items-center gap-2">
                      <Textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendSMS();
                          }
                        }}
                        placeholder={`Type a text message to ${activeConversation.name}... (Press Enter to send)`}
                        className="min-h-[44px] max-h-32 text-xs bg-background border-border resize-none py-3 pr-12 custom-scrollbar"
                      />
                      <Button
                        type="submit"
                        disabled={sending || !replyText.trim()}
                        className="h-10 px-4 gap-1.5 text-xs font-semibold shrink-0 shadow-sm"
                      >
                        {sending ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <>
                            <Send size={15} />
                            <span className="hidden sm:inline">Send</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Footer Info / Segment Count */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                      <button
                        type="button"
                        id="ai-suggest-toggle"
                        onClick={() => setShowAiPanel(prev => !prev)}
                        className={`flex items-center gap-1 font-semibold transition-colors ${
                          showAiPanel
                            ? 'text-violet-600 dark:text-violet-400'
                            : 'text-muted-foreground hover:text-violet-500'
                        }`}
                      >
                        <Wand2 size={12} />
                        <span>AI Suggest</span>
                        <ChevronDown size={11} className={`transition-transform ${showAiPanel ? 'rotate-180' : ''}`} />
                      </button>
                      <span className="font-semibold">
                        {smsSegments.chars} / {smsSegments.max} chars ({smsSegments.segments} SMS)
                      </span>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* WhatsApp-Style New Chat Modal */}
      {showNewChatModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowNewChatModal(false)}
        >
          <div
            className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20">
                  <MessageSquarePlus size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Start New Chat</h2>
                  <p className="text-xs text-muted-foreground">
                    Choose an uncontacted lead to begin SMS messaging
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Filter Tabs */}
            <div className="p-4 border-b border-border space-y-3 bg-card">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by lead name, contact person, phone, or email..."
                  value={newChatSearch}
                  onChange={e => setNewChatSearch(e.target.value)}
                  className="pl-9 pr-8 text-xs h-9 bg-background border-border"
                  autoFocus
                />
                {newChatSearch && (
                  <button
                    type="button"
                    onClick={() => setNewChatSearch('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: `All (${availableLeads.length})` },
                  { id: 'ea_lead', label: `EA Leads (${eaAvailableCount})` },
                  { id: 'main_lead', label: `CRM Leads (${mainAvailableCount})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setNewChatFilter(tab.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      newChatFilter === tab.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1 max-h-[380px]">
              {loadingAvailableLeads ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Loader2 size={24} className="animate-spin mb-2 text-primary" />
                  <p className="text-xs font-medium">Loading uncontacted leads...</p>
                </div>
              ) : filteredAvailableLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
                  <MessageSquare size={32} className="mb-2 opacity-20" />
                  <p className="text-sm font-semibold">No available leads found</p>
                  <p className="text-xs mt-1 opacity-70">
                    {newChatSearch
                      ? 'Try searching with a different term'
                      : 'All leads currently have ongoing SMS conversations'}
                  </p>
                </div>
              ) : (
                filteredAvailableLeads.map(lead => {
                  const hasPhone = Boolean(lead.phone && lead.phone.trim());
                  return (
                    <div
                      key={`${lead.leadType}-${lead._id}`}
                      onClick={() => handleSelectLeadForNewChat(lead)}
                      className={`p-3 rounded-xl border border-transparent transition-all flex items-center justify-between gap-3 group ${
                        hasPhone
                          ? 'hover:bg-primary/5 hover:border-primary/20 cursor-pointer'
                          : 'opacity-60 cursor-not-allowed bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                          {lead.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                              {lead.name}
                            </h4>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider shrink-0 ${
                                lead.leadType === 'ea_lead'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                              }`}
                            >
                              {lead.categoryTag}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground truncate">
                            {hasPhone ? (
                              <span className="flex items-center gap-1 text-foreground/80 font-medium">
                                <Phone size={11} className="text-emerald-500" />
                                {lead.phone}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-destructive font-medium">
                                <PhoneOff size={11} />
                                No phone number
                              </span>
                            )}

                            {lead.email && (
                              <span className="truncate hidden sm:inline text-muted-foreground/70">
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {hasPhone ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs font-semibold group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
                          >
                            Chat
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic px-2">
                            Missing Phone
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>{availableLeads.length} uncontacted leads available</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewChatModal(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
