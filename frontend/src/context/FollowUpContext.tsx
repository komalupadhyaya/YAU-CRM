import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/api';
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
  schoolMeetingCount: number;
  hrMeetingCount: number;
}

const FollowUpContext = createContext<FollowUpContextType>({
  dueTodayCount: 0,
  dueTodayNames: [],
  schoolMeetingCount: 0,
  hrMeetingCount: 0,
});

export const useFollowUp = () => useContext(FollowUpContext);

export const FollowUpProvider = ({ children }: { children: React.ReactNode }) => {
  const [dueTodayCount, setDueTodayCount] = useState(() => {
    return Number(sessionStorage.getItem('dueTodayCount') || 0);
  });
  const [dueTodayNames, setDueTodayNames] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('dueTodayNames') || '[]');
    } catch {
      return [];
    }
  });
  const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set());
  const [schoolMeetingCount, setSchoolMeetingCount] = useState(() => {
    return Number(sessionStorage.getItem('schoolMeetingCount') || 0);
  });
  const [hrMeetingCount, setHrMeetingCount] = useState(() => {
    return Number(sessionStorage.getItem('hrMeetingCount') || 0);
  });
  const { currentUser } = useAuth();

  const checkFollowUps = async () => {
    if (!currentUser) return;
    try {
      const res = await api.get('/followups/dashboard');
      const dueFollowUps: FollowUp[] = res.data.due || [];

      const count = dueFollowUps.length;
      const names = dueFollowUps.map(f => f.lead_name).filter(Boolean);

      setDueTodayCount(count);
      setDueTodayNames(names);
      sessionStorage.setItem('dueTodayCount', String(count));
      sessionStorage.setItem('dueTodayNames', JSON.stringify(names));

      // Check if any follow-up is due RIGHT NOW (within last 5 minutes) and not alerted
      const now = new Date();
      dueFollowUps.forEach(f => {
        const fuTime = new Date(f.date_time);
        const diffMinutes = (now.getTime() - fuTime.getTime()) / 60000;

        if (diffMinutes >= 0 && diffMinutes <= 5 && !alertedIds.has(f._id)) {
          const isAssignedToMe = !f.assigned_user ||
                                 f.assigned_user === "self" ||
                                 f.assigned_user === currentUser?.name ||
                                 f.assigned_user === currentUser?.username ||
                                 f.assigned_user === currentUser?._id;

          if (isAssignedToMe) {
            import('sonner').then(({ toast }) => {
              toast.info(`Follow-up Time: ${f.type} with ${f.lead_name}`, {
                description: f.notes || "Check your dashboard for details.",
                duration: 10000,
              });
            });
            setAlertedIds(prev => new Set(prev).add(f._id));
          }
        }
      });

    } catch (err) {
      console.error("Failed to fetch follow-ups for notifications", err);
    }
  };

  const checkMeetingCounts = async () => {
    if (!currentUser) return;
    try {
      const res = await api.get('/meetings/counts');
      const school = res.data.school || 0;
      const hr = res.data.hr || 0;

      setSchoolMeetingCount(school);
      setHrMeetingCount(hr);
      sessionStorage.setItem('schoolMeetingCount', String(school));
      sessionStorage.setItem('hrMeetingCount', String(hr));
    } catch {
      // Non-fatal — badges just won't update
    }
  };

  useEffect(() => {
    checkFollowUps();
    checkMeetingCounts();

    const followupInterval = setInterval(checkFollowUps, 60000);
    const meetingInterval = setInterval(checkMeetingCounts, 60000);

    return () => {
      clearInterval(followupInterval);
      clearInterval(meetingInterval);
    };
  }, [alertedIds, currentUser]);

  return (
    <FollowUpContext.Provider value={{ dueTodayCount, dueTodayNames, schoolMeetingCount, hrMeetingCount }}>
      {children}
    </FollowUpContext.Provider>
  );
};
