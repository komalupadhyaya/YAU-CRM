import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/api';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface FollowUp {
  _id: string;
  date_time: string;
  type: string;
  notes: string;
  lead_name: string;
  assigned_user?: string;
}

interface FollowUpContextType {
  dueTodayCount: number;
  dueTodayNames: string[];
}

const FollowUpContext = createContext<FollowUpContextType>({ dueTodayCount: 0, dueTodayNames: [] });

export const useFollowUp = () => useContext(FollowUpContext);

export const FollowUpProvider = ({ children }: { children: React.ReactNode }) => {
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [dueTodayNames, setDueTodayNames] = useState<string[]>([]);
  const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set());
  const { currentUser } = useAuth();

  const checkFollowUps = async () => {
    if (!currentUser) return;
    try {
      const res = await api.get('/followups/dashboard');
      const dueFollowUps: FollowUp[] = res.data.due || [];

      setDueTodayCount(dueFollowUps.length);
      setDueTodayNames(dueFollowUps.map(f => f.lead_name).filter(Boolean));

      // Check if any follow-up is due RIGHT NOW (within last 5 minutes) and not alerted
      const now = new Date();
      dueFollowUps.forEach(f => {
        const fuTime = new Date(f.date_time);
        const diffMinutes = (now.getTime() - fuTime.getTime()) / 60000;

        if (diffMinutes >= 0 && diffMinutes <= 5 && !alertedIds.has(f._id)) {
          // Check if assigned to this user (or unassigned/self)
          const isAssignedToMe = !f.assigned_user || 
                                 f.assigned_user === "self" || 
                                 f.assigned_user === currentUser?.name || 
                                 f.assigned_user === currentUser?.username ||
                                 f.assigned_user === currentUser?._id;

          if (isAssignedToMe) {
            toast.info(`Follow-up Time: ${f.type} with ${f.lead_name}`, {
              description: f.notes || "Check your dashboard for details.",
              duration: 10000,
            });
            setAlertedIds(prev => new Set(prev).add(f._id));
          }
        }
      });

    } catch (err) {
      console.error("Failed to fetch follow-ups for notifications", err);
    }
  };

  useEffect(() => {
    // Initial check
    checkFollowUps();

    // Poll every 60 seconds
    const interval = setInterval(checkFollowUps, 60000);
    return () => clearInterval(interval);
  }, [alertedIds, currentUser]);

  return (
    <FollowUpContext.Provider value={{ dueTodayCount, dueTodayNames }}>
      {children}
    </FollowUpContext.Provider>
  );
};
