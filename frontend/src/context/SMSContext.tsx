import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../api/api';
import { useAuth } from './AuthContext';

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

    // Determine backend URL for socket connection
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const socket: Socket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Socket.IO server for real-time SMS updates');
    });

    socket.on('sms:received', (data: { leadId: string; leadType: 'ea_lead' | 'main_lead'; senderName: string; phone: string; message: string; timestamp: string; totalUnreadCount: number }) => {
      console.log('📩 Real-time SMS received:', data);
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
          timestamp: data.timestamp
        },
        ...prev.filter(item => item.leadId !== data.leadId)
      ]);

      // Show toast notification
      import('sonner').then(({ toast }) => {
        toast.info(`New SMS from ${data.senderName}`, {
          description: data.message.length > 50 ? `${data.message.substring(0, 50)}...` : data.message,
          duration: 6000,
        });
      });
    });

    socket.on('sms:read', (data: { totalUnreadCount: number }) => {
      setUnreadSMSCount(data.totalUnreadCount);
      sessionStorage.setItem('unreadSMSCount', String(data.totalUnreadCount));
    });

    socket.on('sms:sent', () => {
      fetchUnreadStats();
    });

    // Fallback polling every 15 seconds
    const interval = setInterval(fetchUnreadStats, 15000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [currentUser, fetchUnreadStats]);

  return (
    <SMSContext.Provider value={{ unreadSMSCount, recentSMSList, markAsRead, refreshUnreadCount: fetchUnreadStats }}>
      {children}
    </SMSContext.Provider>
  );
};
