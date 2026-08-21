import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import api from '../api/api';
import { useSocket } from './SocketContext';
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
  
  loadingCampaigns: boolean;
  loadingSegments: boolean;
  loadingTemplates: boolean;
  loadingConversations: boolean;
  isMarketingDataLoaded: boolean;
  isConversationsLoaded: boolean;

  loadInitialMarketingData: (force?: boolean) => Promise<void>;
  fetchCampaigns: (force?: boolean) => Promise<void>;
  fetchSegments: (force?: boolean) => Promise<void>;
  fetchTemplates: (force?: boolean) => Promise<void>;
  fetchConversations: (force?: boolean) => Promise<void>;
}

const EmailCenterContext = createContext<EmailCenterContextType | null>(null);

export const EmailCenterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const socket = useSocket();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [conversations, setConversations] = useState<EmailConversation[]>([]);

  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const [isMarketingDataLoaded, setIsMarketingDataLoaded] = useState(false);
  const [isConversationsLoaded, setIsConversationsLoaded] = useState(false);

  // In-flight locks to prevent double requests on rapid clicks
  const inFlightRef = useRef<{
    all: boolean;
    campaigns: boolean;
    segments: boolean;
    templates: boolean;
    conversations: boolean;
  }>({
    all: false,
    campaigns: false,
    segments: false,
    templates: false,
    conversations: false
  });

  // Fetch campaigns with in-flight lock, SWR non-blocking background sync, and invalid doc filtering
  const fetchCampaigns = useCallback(async (force = false) => {
    if (inFlightRef.current.campaigns && !force) return;
    inFlightRef.current.campaigns = true;
    
    // Only show blocking loader on initial cold load (when no data exists)
    setCampaigns(prev => {
      if (prev.length === 0) setLoadingCampaigns(true);
      return prev;
    });

    try {
      const res = await api.get("/emails/campaigns");
      const list = Array.isArray(res.data) ? res.data : [];
      const valid = list.filter((c: any) => c && (c.title || c.subject || c.segmentId));
      setCampaigns(valid);
    } catch (err) {
      console.error("Failed to load email campaigns:", err);
    } finally {
      setLoadingCampaigns(false);
      inFlightRef.current.campaigns = false;
    }
  }, []);

  // Fetch segments with in-flight lock and SWR non-blocking background sync
  const fetchSegments = useCallback(async (force = false) => {
    if (inFlightRef.current.segments && !force) return;
    inFlightRef.current.segments = true;

    // Only show blocking loader on initial cold load
    setSegments(prev => {
      if (prev.length === 0) setLoadingSegments(true);
      return prev;
    });

    try {
      const res = await api.get("/emails/segments");
      setSegments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load segments:", err);
    } finally {
      setLoadingSegments(false);
      inFlightRef.current.segments = false;
    }
  }, []);

  // Fetch templates with in-flight lock and SWR non-blocking background sync
  const fetchTemplates = useCallback(async (force = false) => {
    if (inFlightRef.current.templates && !force) return;
    inFlightRef.current.templates = true;

    // Only show blocking loader on initial cold load
    setTemplates(prev => {
      if (prev.length === 0) setLoadingTemplates(true);
      return prev;
    });

    try {
      const res = await api.get("/templates");
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
      inFlightRef.current.templates = false;
    }
  }, []);

  // Fetch 1-to-1 conversations with in-flight lock and SWR non-blocking background sync
  const fetchConversations = useCallback(async (force = false) => {
    if (inFlightRef.current.conversations && !force) return;
    inFlightRef.current.conversations = true;

    setConversations(prev => {
      if (prev.length === 0) setLoadingConversations(true);
      return prev;
    });

    try {
      const res = await api.get("/emails/conversations");
      setConversations(Array.isArray(res.data) ? res.data : []);
      setIsConversationsLoaded(true);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConversations(false);
      inFlightRef.current.conversations = false;
    }
  }, []);

  // Concurrent parallel loader powered by Promise.all
  const loadInitialMarketingData = useCallback(async (force = false) => {
    if (inFlightRef.current.all && !force) return;
    inFlightRef.current.all = true;

    try {
      await Promise.all([
        fetchCampaigns(force),
        fetchSegments(force),
        fetchTemplates(force)
      ]);
      setIsMarketingDataLoaded(true);
    } finally {
      inFlightRef.current.all = false;
    }
  }, [fetchCampaigns, fetchSegments, fetchTemplates]);

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
        loadingCampaigns,
        loadingSegments,
        loadingTemplates,
        loadingConversations,
        isMarketingDataLoaded,
        isConversationsLoaded,
        loadInitialMarketingData,
        fetchCampaigns,
        fetchSegments,
        fetchTemplates,
        fetchConversations
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
