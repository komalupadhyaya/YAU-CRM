import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

export interface RecentSMSItem {
  leadId: string;
  leadType: 'ea_lead' | 'main_lead';
  senderName: string;
  phone: string;
  categoryTag: string;
  message: string;
  timestamp: string;
}

export interface SMSData {
  totalUnreadCount: number;
  hotWarmCount?: number;
  hotWarmMessages?: any[];
  unreadMessages?: any[];
  recentMessages: any[];
}

interface SMSContextType {
  unreadSMSCount: number;
  recentSMSList: RecentSMSItem[];
  unreadSmsData: SMSData;
  markAsRead: (leadId: string, leadType?: string) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const defaultSMSData: SMSData = {
  totalUnreadCount: 0,
  hotWarmCount: 0,
  hotWarmMessages: [],
  unreadMessages: [],
  recentMessages: [],
};

const SMSContext = createContext<SMSContextType>({
  unreadSMSCount: 0,
  recentSMSList: [],
  unreadSmsData: defaultSMSData,
  markAsRead: async () => {},
  refreshUnreadCount: async () => {},
});

export const useSMS = () => useContext(SMSContext);

export const SMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadSMSCount, setUnreadSMSCount] = useState<number>(() => {
    return Number(sessionStorage.getItem('unreadSMSCount') || 0);
  });
  const [recentSMSList, setRecentSMSList] = useState<RecentSMSItem[]>([]);
  const [unreadSmsData, setUnreadSmsData] = useState<SMSData>(defaultSMSData);
  const { currentUser } = useAuth();
  const socket = useSocket();
  const inFlightPromiseRef = useRef<Promise<any> | null>(null);

  const fetchUnreadStats = useCallback(async () => {
    if (!currentUser?._id) return;
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const res = await api.get('/sms/unread-count');
        if (res.data) {
          const count = res.data.totalUnreadCount || 0;
          setUnreadSMSCount(count);
          setRecentSMSList(res.data.recentMessages || []);
          setUnreadSmsData(res.data);
          sessionStorage.setItem('unreadSMSCount', String(count));
        }
      } catch (err) {
        console.error('Failed to fetch unread SMS count:', err);
      } finally {
        inFlightPromiseRef.current = null;
      }
    })();

    inFlightPromiseRef.current = promise;
    return promise;
  }, [currentUser?._id]);

  const markAsRead = useCallback(async (leadId: string, leadType?: string) => {
    try {
      const res = await api.post(`/sms/mark-read/${leadId}`, { leadType });
      const newTotal = res.data.totalUnreadCount || 0;
      setUnreadSMSCount(newTotal);
      sessionStorage.setItem('unreadSMSCount', String(newTotal));
      setRecentSMSList(prev => prev.filter(item => item.leadId !== leadId));
      setUnreadSmsData(prev => ({
        ...prev,
        totalUnreadCount: newTotal,
        unreadMessages: (prev.unreadMessages || []).filter((m: any) => String(m.leadId) !== String(leadId)),
        hotWarmMessages: (prev.hotWarmMessages || []).map((m: any) =>
          String(m.leadId) === String(leadId) ? { ...m, unreadCount: 0 } : m
        ),
      }));
    } catch (err) {
      console.error('Failed to mark lead SMS as read:', err);
    }
  }, []);

  // 1. Initial Fetch on Mount/Login (Strictly once per user session)
  useEffect(() => {
    if (!currentUser?._id) return;
    fetchUnreadStats();

    // Light fallback interval (every 45s)
    const interval = setInterval(fetchUnreadStats, 45000);
    return () => clearInterval(interval);
  }, [currentUser?._id, fetchUnreadStats]);

  // 2. Real-Time Socket Event Attachment (Does NOT trigger redundant HTTP requests on socket connect)
  useEffect(() => {
    if (!socket) return;

    const handleSMSReceived = (data: {
      leadId: string;
      leadType: 'ea_lead' | 'main_lead';
      senderName: string;
      phone: string;
      message: string;
      timestamp: string;
      totalUnreadCount: number;
    }) => {
      console.log('📩 Real-time SMS received on shared socket:', data);
      setUnreadSMSCount(data.totalUnreadCount);
      sessionStorage.setItem('unreadSMSCount', String(data.totalUnreadCount));

      // Append to recent SMS list
      setRecentSMSList(prev => [
        {
          leadId: data.leadId,
          leadType: data.leadType,
          senderName: data.senderName,
          phone: data.phone,
          categoryTag: data.leadType === 'ea_lead' ? 'EA Lead' : 'CRM Lead',
          message: data.message,
          timestamp: data.timestamp,
        },
        ...prev.filter(item => item.leadId !== data.leadId),
      ]);

      // Re-fetch in background to update detailed dashboard panel lists
      fetchUnreadStats();

      // Show top-right interactive toast notification with direct SPA navigation
      import('sonner').then(({ toast }) => {
        const leadLabel = data.leadType === 'ea_lead' ? 'EA Lead' : 'CRM Lead';
        const sender = data.senderName || data.phone;
        const preview = data.message.length > 75 ? `${data.message.substring(0, 75)}...` : data.message;

        const openConversation = () => {
          window.history.pushState({}, '', `/sms?leadId=${data.leadId}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        };

        toast(`💬 Reply from ${sender}`, {
          description: `${preview} • [${leadLabel}]`,
          duration: 15000,
          action: {
            label: 'Open Chat',
            onClick: openConversation,
          },
          onClick: openConversation,
        });
      });
    };

    const handleSMSRead = (data: { totalUnreadCount: number }) => {
      setUnreadSMSCount(data.totalUnreadCount);
      sessionStorage.setItem('unreadSMSCount', String(data.totalUnreadCount));
      fetchUnreadStats();
    };

    const handleSMSSent = () => {
      fetchUnreadStats();
    };

    const handleScoreUpdated = () => {
      fetchUnreadStats();
    };

    socket.on('sms:received', handleSMSReceived);
    socket.on('sms:read', handleSMSRead);
    socket.on('sms:sent', handleSMSSent);
    socket.on('lead:score_updated', handleScoreUpdated);

    return () => {
      socket.off('sms:received', handleSMSReceived);
      socket.off('sms:read', handleSMSRead);
      socket.off('sms:sent', handleSMSSent);
      socket.off('lead:score_updated', handleScoreUpdated);
    };
  }, [socket, fetchUnreadStats]);

  return (
    <SMSContext.Provider value={{ unreadSMSCount, recentSMSList, unreadSmsData, markAsRead, refreshUnreadCount: fetchUnreadStats }}>
      {children}
    </SMSContext.Provider>
  );
};
