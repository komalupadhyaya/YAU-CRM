import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

interface SMSContextType {
  unreadSMSCount: number;
  recentSMSList: RecentSMSItem[];
  markAsRead: (leadId: string, leadType?: string) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const SMSContext = createContext<SMSContextType>({
  unreadSMSCount: 0,
  recentSMSList: [],
  markAsRead: async () => {},
  refreshUnreadCount: async () => {},
});

export const useSMS = () => useContext(SMSContext);

export const SMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadSMSCount, setUnreadSMSCount] = useState<number>(() => {
    return Number(sessionStorage.getItem('unreadSMSCount') || 0);
  });
  const [recentSMSList, setRecentSMSList] = useState<RecentSMSItem[]>([]);
  const { currentUser } = useAuth();
  const socket = useSocket();

  const fetchUnreadStats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await api.get('/sms/unread-count');
      const count = res.data.totalUnreadCount || 0;
      setUnreadSMSCount(count);
      setRecentSMSList(res.data.recentMessages || []);
      sessionStorage.setItem('unreadSMSCount', String(count));
    } catch (err) {
      console.error('Failed to fetch unread SMS count:', err);
    }
  }, [currentUser]);

  const markAsRead = useCallback(async (leadId: string, leadType?: string) => {
    try {
      const res = await api.post(`/sms/mark-read/${leadId}`, { leadType });
      const newTotal = res.data.totalUnreadCount || 0;
      setUnreadSMSCount(newTotal);
      sessionStorage.setItem('unreadSMSCount', String(newTotal));
      setRecentSMSList(prev => prev.filter(item => item.leadId !== leadId));
    } catch (err) {
      console.error('Failed to mark lead SMS as read:', err);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetchUnreadStats();

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

      // Show top-right interactive toast notification with direct SPA navigation
      import('sonner').then(({ toast }) => {
        const leadLabel = data.leadType === 'ea_lead' ? 'EA Lead' : 'CRM Lead';
        const sender = data.senderName || data.phone;
        const preview = data.message.length > 75 ? `${data.message.substring(0, 75)}...` : data.message;

        const openConversation = () => {
          // Client-side SPA navigation so the notification remains visible and does not reload the page
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
    };

    const handleSMSSent = () => {
      fetchUnreadStats();
    };

    socket.on('sms:received', handleSMSReceived);
    socket.on('sms:read', handleSMSRead);
    socket.on('sms:sent', handleSMSSent);

    // Fallback polling every 30 seconds
    const interval = setInterval(fetchUnreadStats, 30000);

    return () => {
      socket.off('sms:received', handleSMSReceived);
      socket.off('sms:read', handleSMSRead);
      socket.off('sms:sent', handleSMSSent);
      clearInterval(interval);
    };
  }, [currentUser, socket, fetchUnreadStats]);

  return (
    <SMSContext.Provider value={{ unreadSMSCount, recentSMSList, markAsRead, refreshUnreadCount: fetchUnreadStats }}>
      {children}
    </SMSContext.Provider>
  );
};
