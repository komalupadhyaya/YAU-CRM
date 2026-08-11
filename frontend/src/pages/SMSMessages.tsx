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
  User,
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

export interface SMSMessageItem {
  _id?: string;
  direction: 'inbound' | 'outbound';
  message: string;
  timestamp: string;
  status?: 'pending' | 'sent' | 'failed' | 'received';
  twilioSid?: string;
  isRead?: boolean;
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

export default function SMSMessages() {
  const { currentUser } = useAuth();
  const permissions = can(currentUser?.role);
  const { markAsRead } = useSMS();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<SMSConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'ea_lead' | 'main_lead' | 'unread'>('all');

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(searchParams.get('leadId'));
  const selectedLeadIdRef = useRef<string | null>(selectedLeadId);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Keep ref synchronized with state
  useEffect(() => {
    selectedLeadIdRef.current = selectedLeadId;
  }, [selectedLeadId]);

  // AI Suggest state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Keep selectedLeadId in sync when URL search param changes
  useEffect(() => {
    const paramId = searchParams.get('leadId');
    if (paramId && paramId !== selectedLeadIdRef.current) {
      setSelectedLeadId(paramId);
    }
  }, [searchParams]);

  // Fetch all conversations
  const fetchConversations = async (isQuiet = false) => {
    if (!isQuiet) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await api.get('/sms/conversations');
      const data: SMSConversation[] = res.data || [];
      setConversations(data);

      const currentId = selectedLeadIdRef.current || searchParams.get('leadId');

      if (currentId) {
        // If current selection exists in data, ensure matching ID is preserved
        const match = data.find(c => String(c._id) === String(currentId));
        if (match && selectedLeadIdRef.current !== match._id) {
          setSelectedLeadId(match._id);
        }
      } else if (data.length > 0) {
        // Only default to first conversation if NO selection exists anywhere
        setSelectedLeadId(data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load SMS conversations:', err);
      toast.error('Failed to load SMS conversations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update URL search parameter and mark as read when selected lead changes
  useEffect(() => {
    if (selectedLeadId) {
      if (searchParams.get('leadId') !== selectedLeadId) {
        setSearchParams({ leadId: selectedLeadId }, { replace: true });
      }
      const conv = conversations.find(c => String(c._id) === String(selectedLeadId));
      if (conv && conv.unreadCount > 0) {
        markAsRead(conv._id, conv.leadType);
        // Clear local unread count
        setConversations(prev =>
          prev.map(c => (String(c._id) === String(conv._id) ? { ...c, unreadCount: 0 } : c))
        );
      }
    }
  }, [selectedLeadId, conversations, markAsRead, searchParams, setSearchParams]);

  // Scroll to bottom of chat history when selection or history changes
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [selectedLeadId, conversations]);

  // Selected conversation object
  const activeConversation = useMemo(() => {
    return conversations.find(c => String(c._id) === String(selectedLeadId)) || null;
  }, [conversations, selectedLeadId]);

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
      toast.error(err.response?.data?.error || 'Failed to send SMS message');
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
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchConversations(true)}
              disabled={refreshing}
              className="h-8 gap-1.5 text-xs border-border"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT PANE: Active Conversations List */}
          <div className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col flex-shrink-0">
            
            {/* Search & Filter Header */}
            <div className="p-3 border-b border-border space-y-2 flex-shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 bg-background border-border"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'ea_lead', label: 'EA Leads' },
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
                    {searchQuery ? 'Try adjusting your search query' : 'Inbound and outbound SMS messages will appear here'}
                  </p>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isSelected = String(conv._id) === String(selectedLeadId);
                  return (
                    <div
                      key={conv._id}
                      onClick={() => {
                        setSelectedLeadId(conv._id);
                        setSearchParams({ leadId: conv._id }, { replace: true });
                      }}
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
                <div className="h-14 px-6 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm border border-primary/20">
                      {activeConversation.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">
                          {activeConversation.name}
                        </h3>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                            activeConversation.leadType === 'ea_lead'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {activeConversation.categoryTag}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{activeConversation.phone}</span>
                        {activeConversation.isConsent && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            <ShieldCheck size={12} /> Consented
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
                  {activeConversation.smsHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <MessageSquare size={32} className="mb-2 opacity-20" />
                      <p className="text-xs font-medium">No SMS history with this lead yet</p>
                    </div>
                  ) : (
                    activeConversation.smsHistory.map((msg, index) => {
                      const isInbound = msg.direction === 'inbound';
                      return (
                        <div
                          key={msg._id || `${msg.timestamp}-${index}`}
                          className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                        >
                          {/* Bubble Container */}
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                              isInbound
                                ? 'bg-card text-card-foreground border border-border rounded-tl-none'
                                : 'bg-primary text-primary-foreground rounded-tr-none'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words font-sans">{msg.message}</p>
                          </div>

                          {/* Message Meta / Timestamp / Status */}
                          <div
                            className={`flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground px-1 font-medium`}
                          >
                            <span>{formatTime(msg.timestamp)}</span>
                            {!isInbound && (
                              <span>
                                {msg.status === 'sent' || msg.status === 'received' ? (
                                  <CheckCheck size={12} className="text-emerald-500 inline" />
                                ) : msg.status === 'failed' ? (
                                  <AlertTriangle size={12} className="text-destructive inline" />
                                ) : (
                                  <Check size={12} className="opacity-60 inline" />
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
                            What's the goal of this message? <span className="italic">(optional — leave blank for auto follow-up)</span>
                          </p>
                          <Input
                            id="ai-prompt-input"
                            type="text"
                            placeholder='e.g. "Follow up on proposal", "Schedule a meeting", "Check if they got our email"'
                            value={aiPrompt}
                            onChange={e => setAiPrompt(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); handleAiGenerate(); }
                              if (e.key === 'Escape') { setShowAiPanel(false); setAiPrompt(''); }
                            }}
                            className="h-8 text-xs bg-background border-border"
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
    </AppLayout>
  );
}
