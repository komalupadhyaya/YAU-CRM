import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import api from '../api/api';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

export interface Segment {
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

export interface Campaign {
  _id: string;
  title: string;
  subject: string;
  content: string;
  segmentId: Segment | null;
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

export interface EmailConversation {
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

export interface EmailHistoryItem {
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

export interface DbTemplate {
  _id: string;
  name: string;
  category: string;
  subject: string;
  content: string;
  isAiGenerated?: boolean;
  aiPrompt?: string;
  createdAt?: string;
}

interface EmailCenterContextType {
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  segments: Segment[];
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>;
  templates: DbTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<DbTemplate[]>>;
  conversations: EmailConversation[];
  setConversations: React.Dispatch<React.SetStateAction<EmailConversation[]>>;
  
  selectedConversation: EmailConversation | null;
  setSelectedConversation: React.Dispatch<React.SetStateAction<EmailConversation | null>>;
  emailHistory: EmailHistoryItem[];
  setEmailHistory: React.Dispatch<React.SetStateAction<EmailHistoryItem[]>>;
  
  loadingCampaigns: boolean;
  loadingSegments: boolean;
  loadingTemplates: boolean;
  loadingConversations: boolean;
  loadingHistory: boolean;
  resubscribing: boolean;
  
  isMarketingDataLoaded: boolean;
  isConversationsLoaded: boolean;

  loadInitialMarketingData: (force?: boolean) => Promise<void>;
  fetchCampaigns: (force?: boolean) => Promise<void>;
  fetchSegments: (force?: boolean) => Promise<void>;
  fetchTemplates: (force?: boolean) => Promise<void>;
  fetchConversations: (force?: boolean) => Promise<void>;
  fetchHistory: (leadId: string, force?: boolean) => Promise<void>;
  resubscribeContact: (conv: EmailConversation) => Promise<void>;
}

const EmailCenterContext = createContext<EmailCenterContextType | null>(null);

export const EmailCenterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const socket = useSocket();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  // Marketing Data States
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  
  // 1-to-1 Inbox States
  const [conversations, setConversations] = useState<EmailConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<EmailConversation | null>(null);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);

  // Loaders
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [resubscribing, setResubscribing] = useState(false);

  const [isMarketingDataLoaded, setIsMarketingDataLoaded] = useState(false);
  const [isConversationsLoaded, setIsConversationsLoaded] = useState(false);

  // Active lead ID tracking to strictly prevent out-of-order race conditions
  const activeLeadIdRef = useRef<string | null>(null);

  // Active in-flight promises map to share requests and strictly prevent double/duplicate calls
  const activePromisesRef = useRef<{
    campaigns: Promise<void> | null;
    segments: Promise<void> | null;
    templates: Promise<void> | null;
    conversations: Promise<void> | null;
    all: Promise<void> | null;
    history: { [leadId: string]: Promise<void> | null };
  }>({
    campaigns: null,
    segments: null,
    templates: null,
    conversations: null,
    all: null,
    history: {}
  });

  const lastFetchTimeRef = useRef<{ [key: string]: number }>({});

  // Fetch campaigns with active promise sharing & invalid doc filtering (Admin only)
  const fetchCampaigns = useCallback((force = false) => {
    if (!currentUser || currentUser.role !== 'admin') {
      return Promise.resolve();
    }

    if (activePromisesRef.current.campaigns) {
      return activePromisesRef.current.campaigns;
    }

    const now = Date.now();
    if (!force && lastFetchTimeRef.current.campaigns && now - lastFetchTimeRef.current.campaigns < 2500) {
      return Promise.resolve();
    }

    setCampaigns(prev => {
      if (prev.length === 0) setLoadingCampaigns(true);
      return prev;
    });

    const promise = (async () => {
      try {
        const res = await api.get("/emails/campaigns");
        const list = Array.isArray(res.data) ? res.data : [];
        const valid = list.filter((c: any) => c && (c.title || c.subject || c.segmentId));
        setCampaigns(valid);
        lastFetchTimeRef.current.campaigns = Date.now();
      } catch (err) {
        console.error("Failed to load email campaigns:", err);
      } finally {
        setLoadingCampaigns(false);
        activePromisesRef.current.campaigns = null;
      }
    })();

    activePromisesRef.current.campaigns = promise;
    return promise;
  }, [currentUser]);

  // Fetch segments with active promise sharing (Admin only)
  const fetchSegments = useCallback((force = false) => {
    if (!currentUser || currentUser.role !== 'admin') {
      return Promise.resolve();
    }

    if (activePromisesRef.current.segments) {
      return activePromisesRef.current.segments;
    }

    const now = Date.now();
    if (!force && lastFetchTimeRef.current.segments && now - lastFetchTimeRef.current.segments < 2500) {
      return Promise.resolve();
    }

    setSegments(prev => {
      if (prev.length === 0) setLoadingSegments(true);
      return prev;
    });

    const promise = (async () => {
      try {
        const res = await api.get("/emails/segments");
        setSegments(Array.isArray(res.data) ? res.data : []);
        lastFetchTimeRef.current.segments = Date.now();
      } catch (err) {
        console.error("Failed to load segments:", err);
      } finally {
        setLoadingSegments(false);
        activePromisesRef.current.segments = null;
      }
    })();

    activePromisesRef.current.segments = promise;
    return promise;
  }, [currentUser]);

  // Fetch templates with active promise sharing (Admin only)
  const fetchTemplates = useCallback((force = false) => {
    if (!currentUser || currentUser.role !== 'admin') {
      return Promise.resolve();
    }

    if (activePromisesRef.current.templates) {
      return activePromisesRef.current.templates;
    }

    const now = Date.now();
    if (!force && lastFetchTimeRef.current.templates && now - lastFetchTimeRef.current.templates < 2500) {
      return Promise.resolve();
    }

    setTemplates(prev => {
      if (prev.length === 0) setLoadingTemplates(true);
      return prev;
    });

    const promise = (async () => {
      try {
        const res = await api.get("/templates");
        setTemplates(Array.isArray(res.data) ? res.data : []);
        lastFetchTimeRef.current.templates = Date.now();
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setLoadingTemplates(false);
        activePromisesRef.current.templates = null;
      }
    })();

    activePromisesRef.current.templates = promise;
    return promise;
  }, [currentUser]);

  // Fetch 1-to-1 conversations with active promise sharing (Admin only)
  const fetchConversations = useCallback((force = false) => {
    if (!currentUser || currentUser.role !== 'admin') {
      return Promise.resolve();
    }

    if (activePromisesRef.current.conversations) {
      return activePromisesRef.current.conversations;
    }

    const now = Date.now();
    if (!force && lastFetchTimeRef.current.conversations && now - lastFetchTimeRef.current.conversations < 2500) {
      return Promise.resolve();
    }

    setConversations(prev => {
      if (prev.length === 0) setLoadingConversations(true);
      return prev;
    });

    const promise = (async () => {
      try {
        const res = await api.get("/emails/conversations");
        setConversations(Array.isArray(res.data) ? res.data : []);
        setIsConversationsLoaded(true);
        lastFetchTimeRef.current.conversations = Date.now();
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        setLoadingConversations(false);
        activePromisesRef.current.conversations = null;
      }
    })();

    activePromisesRef.current.conversations = promise;
    return promise;
  }, [currentUser]);

  // In-memory cache for contact message threads
  const historyCacheRef = useRef<{ [leadId: string]: EmailHistoryItem[] }>({});

  // Fetch individual conversation message history with instant cache retrieval and race condition protection
  const fetchHistory = useCallback((leadId: string, force = false) => {
    if (!leadId) return Promise.resolve();
    if (!currentUser || currentUser.role !== 'admin') {
      return Promise.resolve();
    }

    activeLeadIdRef.current = leadId;

    // If cached in memory, immediately populate state with zero delay
    if (historyCacheRef.current[leadId]) {
      setEmailHistory(historyCacheRef.current[leadId]);
      setLoadingHistory(false);
    } else {
      // First time load: show loader without flashing old lead's thread
      setEmailHistory([]);
      setLoadingHistory(true);
    }

    if (activePromisesRef.current.history[leadId]) {
      return activePromisesRef.current.history[leadId]!;
    }

    const now = Date.now();
    const cacheKey = `hist_${leadId}`;
    if (!force && lastFetchTimeRef.current[cacheKey] && now - lastFetchTimeRef.current[cacheKey] < 2000) {
      return Promise.resolve();
    }

    const promise = (async () => {
      try {
        const res = await api.get(`/emails/conversations/${leadId}`);
        const data = Array.isArray(res.data) ? res.data : [];
        historyCacheRef.current[leadId] = data;

        // STRICT RACE CONDITION GUARD: Only apply to UI if user is still on this contact!
        if (activeLeadIdRef.current === leadId) {
          setEmailHistory(data);
          setLoadingHistory(false);
        }
        lastFetchTimeRef.current[cacheKey] = Date.now();
      } catch (err) {
        console.error("Failed to load email history thread:", err);
        if (activeLeadIdRef.current === leadId) {
          toast.error("Failed to load email history thread");
        }
      } finally {
        if (activeLeadIdRef.current === leadId) {
          setLoadingHistory(false);
        }
        delete activePromisesRef.current.history[leadId];
      }
    })();

    activePromisesRef.current.history[leadId] = promise;
    return promise;
  }, [currentUser]);

  // Admin action to restore email consent / resubscribe contact
  const resubscribeContact = useCallback(async (conv: EmailConversation) => {
    if (!conv) return;
    if (!currentUser || currentUser.role !== 'admin') return;

    setResubscribing(true);
    try {
      await api.post("/emails/resubscribe", {
        leadId: conv._id,
        email: conv.email,
        leadModel: conv.leadType === "ea_lead" ? "EALead" : "Lead"
      });
      toast.success(`Email consent restored for ${conv.name}!`);
      setSelectedConversation(prev => prev && prev._id === conv._id ? { ...prev, isConsent: true } : prev);
      setConversations(prev => prev.map(c => c.email.toLowerCase() === conv.email.toLowerCase() ? { ...c, isConsent: true } : c));
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to restore email consent");
    } finally {
      setResubscribing(false);
    }
  }, [currentUser]);

  // Concurrent parallel loader powered by Promise.all with active promise sharing (Admin only)
  const loadInitialMarketingData = useCallback((force = false) => {
    if (!currentUser || currentUser.role !== 'admin') {
      return Promise.resolve();
    }

    if (activePromisesRef.current.all) {
      return activePromisesRef.current.all;
    }

    const promise = (async () => {
      try {
        await Promise.all([
          fetchCampaigns(force),
          fetchSegments(force),
          fetchTemplates(force),
          fetchConversations(force)
        ]);
        setIsMarketingDataLoaded(true);
      } finally {
        activePromisesRef.current.all = null;
      }
    })();

    activePromisesRef.current.all = promise;
    return promise;
  }, [currentUser, fetchCampaigns, fetchSegments, fetchTemplates, fetchConversations]);

  // Real-time socket sync for campaign stats
  useEffect(() => {
    if (!socket) return;

    const handleCampaignUpdate = (data: { campaignId: string; stats: any; status: string; recipientLogs: any[] }) => {
      setCampaigns(prev => prev.map(c => {
        if (c._id === data.campaignId) {
          return {
            ...c,
            status: data.status as any,
            stats: data.stats,
            recipientLogs: data.recipientLogs
          };
        }
        return c;
      }));
    };

    socket.on("campaign:updated", handleCampaignUpdate);
    return () => {
      socket.off("campaign:updated", handleCampaignUpdate);
    };
  }, [socket]);

  return (
    <EmailCenterContext.Provider
      value={{
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
      }}
    >
      {children}
    </EmailCenterContext.Provider>
  );
};

export const useEmailCenter = () => {
  const ctx = useContext(EmailCenterContext);
  if (!ctx) {
    throw new Error("useEmailCenter must be used within an EmailCenterProvider");
  }
  return ctx;
};
