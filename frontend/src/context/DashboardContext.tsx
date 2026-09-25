import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useCampaignStore } from '../store/campaignStore';
import { toast } from 'sonner';

export interface FollowUpItem {
  _id: string;
  title?: string;
  notes: string;
  date_time: string;
  type: string;
  priority: string;
  status: string;
  lead_id_val: string;
  lead_name: string;
  telephone?: string;
  campaign_name: string;
  campaign_id_val: string;
}

export interface DashboardData {
  overdue: FollowUpItem[];
  due: FollowUpItem[];
  upcoming: FollowUpItem[];
  all: FollowUpItem[];
  totalCampaigns?: number;
  totalLeads?: number;
}

interface DashboardContextType {
  dashboardMetrics: any;
  rawData: DashboardData | null;
  commandCenterData: any;
  campaignSummaries: any[];
  pipelineData: Record<string, number>;
  selectedCampaign: string;
  initialLoading: boolean;
  metricsLoaded: boolean;
  tasksLoaded: boolean;
  commandCenterLoaded: boolean;
  isRefreshing: boolean;
  weeklyReport: any;
  loadingWeeklyReport: boolean;
  isGeneratingWeeklyReport: boolean;
  setCampaignFilter: (campaignId: string) => void;
  refreshDashboard: (silent?: boolean) => Promise<void>;
  refreshWeeklyReport: () => Promise<void>;
  generateWeeklyReport: (sendEmail?: boolean) => Promise<void>;
}

const getStoredCache = (userId: string) => {
  try {
    const raw = sessionStorage.getItem(`yau_crm_dashboard_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const setStoredCache = (userId: string, data: any) => {
  try {
    sessionStorage.setItem(`yau_crm_dashboard_${userId}`, JSON.stringify(data));
  } catch {}
};

const clearStoredCache = (userId?: string) => {
  try {
    if (userId) {
      sessionStorage.removeItem(`yau_crm_dashboard_${userId}`);
    }
  } catch {}
};

const DashboardContext = createContext<DashboardContextType>({
  dashboardMetrics: null,
  rawData: null,
  commandCenterData: null,
  campaignSummaries: [],
  pipelineData: {},
  selectedCampaign: 'all',
  initialLoading: true,
  metricsLoaded: false,
  tasksLoaded: false,
  commandCenterLoaded: false,
  isRefreshing: false,
  weeklyReport: null,
  loadingWeeklyReport: false,
  isGeneratingWeeklyReport: false,
  setCampaignFilter: () => {},
  refreshDashboard: async () => {},
  refreshWeeklyReport: async () => {},
  generateWeeklyReport: async () => {},
});

export const useDashboard = () => useContext(DashboardContext);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const socket = useSocket();

  // Initialize from session cache if available (0ms instant paint on warm return)
  const cached = currentUser?._id ? getStoredCache(currentUser._id) : null;

  const [dashboardMetrics, setDashboardMetrics] = useState<any>(cached?.dashboardMetrics || null);
  const [rawData, setRawData] = useState<DashboardData | null>(cached?.rawData || null);
  const [commandCenterData, setCommandCenterData] = useState<any>(cached?.commandCenterData || null);
  const [campaignSummaries, setCampaignSummaries] = useState<any[]>(cached?.campaignSummaries || []);
  const [pipelineData, setPipelineData] = useState<Record<string, number>>(cached?.pipelineData || {});
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');

  const [initialLoading, setInitialLoading] = useState<boolean>(!cached?.dashboardMetrics);
  const [metricsLoaded, setMetricsLoaded] = useState<boolean>(!!cached?.dashboardMetrics);
  const [tasksLoaded, setTasksLoaded] = useState<boolean>(!!cached?.rawData);
  const [commandCenterLoaded, setCommandCenterLoaded] = useState<boolean>(!!cached?.commandCenterData);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Weekly AI report state (admin/manager)
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [loadingWeeklyReport, setLoadingWeeklyReport] = useState<boolean>(false);
  const [isGeneratingWeeklyReport, setIsGeneratingWeeklyReport] = useState<boolean>(false);

  // State reference tracking to maintain fresh snapshots without re-creating useCallback references
  const dashboardMetricsRef = useRef(dashboardMetrics);
  dashboardMetricsRef.current = dashboardMetrics;
  const rawDataRef = useRef(rawData);
  rawDataRef.current = rawData;
  const commandCenterDataRef = useRef(commandCenterData);
  commandCenterDataRef.current = commandCenterData;
  const campaignSummariesRef = useRef(campaignSummaries);
  campaignSummariesRef.current = campaignSummaries;
  const pipelineDataRef = useRef(pipelineData);
  pipelineDataRef.current = pipelineData;
  const metricsLoadedRef = useRef(metricsLoaded);
  metricsLoadedRef.current = metricsLoaded;

  const weeklyReportRef = useRef<any>(null);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const inFlightWeeklyPromiseRef = useRef<Promise<void> | null>(null);
  const selectedCampaignRef = useRef<string>(selectedCampaign);
  selectedCampaignRef.current = selectedCampaign;

  const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // 1. Fetch Core Dashboard Data with Staged Hydration and Promise.allSettled
  const fetchDashboardData = useCallback(async (silent = false, campaignOverride?: string) => {
    if (!currentUser?._id) {
      setInitialLoading(false);
      return;
    }

    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    if (!silent && !metricsLoadedRef.current) {
      setIsRefreshing(true);
    }

    const campaignId = (campaignOverride !== undefined ? campaignOverride : selectedCampaignRef.current) === 'all'
      ? ''
      : (campaignOverride !== undefined ? campaignOverride : selectedCampaignRef.current);

    const promise = (async () => {
      try {
        let latestMetrics = dashboardMetricsRef.current;
        let latestRawData = rawDataRef.current;
        let latestWidgets = commandCenterDataRef.current;
        let latestSummaries = campaignSummariesRef.current;
        let latestPipeline = pipelineDataRef.current;

        // Stage 1: Fetch Consolidated Dashboard (Fastest ~70ms) -> Immediate Paint
        const consolidatedPromise = api.get(`/dashboard${campaignId ? `?campaignId=${campaignId}` : ''}`)
          .then(res => {
            if (res.data) {
              latestMetrics = res.data;
              latestSummaries = res.data?.campaignSummaries || [];
              setDashboardMetrics(res.data);
              setCampaignSummaries(latestSummaries);

              if (campaignId && res.data?.leads?.byStatus) {
                const breakdown: Record<string, number> = {};
                res.data.leads.byStatus.forEach((s: any) => { breakdown[s.status] = s.count; });
                latestPipeline = breakdown;
                setPipelineData(breakdown);
              } else {
                latestPipeline = {};
                setPipelineData({});
              }

              setMetricsLoaded(true);
              setInitialLoading(false);
            }
            return res.data;
          })
          .catch(err => {
            console.error('Failed to load consolidated dashboard metrics:', err);
            return null;
          });

        // Stage 2: Fetch Follow-Up Tasks (~120ms) -> Stream Tasks Panel
        const followupsPromise = api.get('/followups/dashboard')
          .then(res => {
            if (res.data) {
              latestRawData = res.data;
              setRawData(res.data);
              setTasksLoaded(true);
            }
            return res.data;
          })
          .catch(err => {
            console.error('Failed to load dashboard followups:', err);
            return null;
          });

        // Stage 3: Fetch Command Center 10-Widget Data (~220ms) -> Stream Widgets
        const commandCenterPromise = api.get('/dashboard/command-center')
          .then(res => {
            if (res.data?.success && res.data?.widgets) {
              latestWidgets = res.data.widgets;
              setCommandCenterData(res.data.widgets);
              setCommandCenterLoaded(true);
            }
            return res.data;
          })
          .catch(err => {
            console.error('Failed to load command center widgets:', err);
            return null;
          });

        // Stage 4: Concurrently Warm Global Campaign & Settings Stores
        const campaignsPromise = (useCampaignStore.getState().campaigns.length === 0)
          ? api.get('/campaigns').then(res => {
              if (res.data) useCampaignStore.getState().setCampaigns(res.data);
            }).catch(() => {})
          : Promise.resolve();

        const settingsPromise = (useCampaignStore.getState().statusLabels.length === 0)
          ? api.get('/settings').then(res => {
              if (res.data?.statusLabels) useCampaignStore.getState().setStatusLabels(res.data.statusLabels);
            }).catch(() => {})
          : Promise.resolve();

        // Wait for all staged promises to settle with zero-cascade fault isolation
        await Promise.allSettled([
          consolidatedPromise,
          followupsPromise,
          commandCenterPromise,
          campaignsPromise,
          settingsPromise
        ]);

        // Persist fresh snapshot to session storage cache for instant warm revisits
        if (currentUser?._id && latestMetrics) {
          setStoredCache(currentUser._id, {
            dashboardMetrics: latestMetrics,
            rawData: latestRawData,
            commandCenterData: latestWidgets,
            campaignSummaries: latestSummaries,
            pipelineData: latestPipeline,
          });
        }
      } catch (err) {
        console.error('DashboardContext data load error:', err);
      } finally {
        setInitialLoading(false);
        setIsRefreshing(false);
        inFlightPromiseRef.current = null;
      }
    })();

    inFlightPromiseRef.current = promise;
    return promise;
  }, [currentUser?._id]);

  // 2. Fetch Weekly Report (Admin/Manager) - Guarded against unnecessary duplicate calls & loader flickers
  const fetchWeeklyReport = useCallback(async (force = false) => {
    if (!currentUser?._id || !isAdminOrManager) {
      setLoadingWeeklyReport(false);
      return;
    }

    if (!force && weeklyReportRef.current) {
      return; // Already loaded, prevent redundant fetch and UI flicker
    }

    if (inFlightWeeklyPromiseRef.current) {
      return inFlightWeeklyPromiseRef.current;
    }

    const promise = (async () => {
      try {
        if (!weeklyReportRef.current) {
          setLoadingWeeklyReport(true);
        }
        const res = await api.get('/reports/weekly-ai-report/latest');
        if (res.data?.success && res.data?.report) {
          setWeeklyReport(res.data.report);
          weeklyReportRef.current = res.data.report;
        }
      } catch (err) {
        console.error('Failed to load weekly AI report:', err);
      } finally {
        setLoadingWeeklyReport(false);
        inFlightWeeklyPromiseRef.current = null;
      }
    })();

    inFlightWeeklyPromiseRef.current = promise;
    return promise;
  }, [currentUser?._id, isAdminOrManager]);

  // 3. Generate Weekly Report
  const generateWeeklyReport = useCallback(async (sendEmail = false) => {
    try {
      setIsGeneratingWeeklyReport(true);
      toast.info('Generating Weekly AI Performance Report with Claude...');
      const res = await api.post('/reports/weekly-ai-report/generate', { sendEmail });
      if (res.data?.success) {
        toast.success('Weekly AI Report regenerated and updated');
        setWeeklyReport(res.data.report);
        weeklyReportRef.current = res.data.report;
      } else {
        toast.error(res.data?.message || 'Failed to generate report');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error generating weekly report');
    } finally {
      setIsGeneratingWeeklyReport(false);
    }
  }, []);

  // 4. Update Campaign Filter
  const setCampaignFilter = useCallback((campaignId: string) => {
    setSelectedCampaign(campaignId);
    selectedCampaignRef.current = campaignId;
    fetchDashboardData(true, campaignId);
  }, [fetchDashboardData]);

  // 5. Automatic Fetch on Login / Active User Authentication
  useEffect(() => {
    if (!currentUser?._id) {
      // Clear data on logout
      clearStoredCache();
      dashboardMetricsRef.current = null;
      rawDataRef.current = null;
      commandCenterDataRef.current = null;
      campaignSummariesRef.current = [];
      pipelineDataRef.current = {};
      weeklyReportRef.current = null;
      setDashboardMetrics(null);
      setRawData(null);
      setCommandCenterData(null);
      setCampaignSummaries([]);
      setPipelineData({});
      setWeeklyReport(null);
      setInitialLoading(true);
      setMetricsLoaded(false);
      setTasksLoaded(false);
      setCommandCenterLoaded(false);
      return;
    }

    // Automatically trigger initial dashboard pre-fetch
    fetchDashboardData(false);

    if (isAdminOrManager) {
      fetchWeeklyReport(false);
    }
  }, [currentUser?._id, isAdminOrManager, fetchDashboardData, fetchWeeklyReport]);

  // 6. Real-Time Socket Event Attachment
  useEffect(() => {
    if (!socket || !currentUser?._id) return;

    const handleSocketUpdate = () => {
      fetchDashboardData(true);
    };

    socket.on('ea_lead:stalled_updated', handleSocketUpdate);
    socket.on('lead:stalled_updated', handleSocketUpdate);
    socket.on('ea_lead:score_updated', handleSocketUpdate);
    socket.on('ea_lead:created', handleSocketUpdate);
    socket.on('ea_lead:updated', handleSocketUpdate);
    socket.on('ea_lead:deleted', handleSocketUpdate);
    socket.on('sms:received', handleSocketUpdate);
    socket.on('followup:updated', handleSocketUpdate);
    socket.on('lead:updated', handleSocketUpdate);
    socket.on('meeting:created', handleSocketUpdate);
    socket.on('meeting:updated', handleSocketUpdate);
    socket.on('meeting:deleted', handleSocketUpdate);

    return () => {
      socket.off('ea_lead:stalled_updated', handleSocketUpdate);
      socket.off('lead:stalled_updated', handleSocketUpdate);
      socket.off('ea_lead:score_updated', handleSocketUpdate);
      socket.off('ea_lead:created', handleSocketUpdate);
      socket.off('ea_lead:updated', handleSocketUpdate);
      socket.off('ea_lead:deleted', handleSocketUpdate);
      socket.off('sms:received', handleSocketUpdate);
      socket.off('followup:updated', handleSocketUpdate);
      socket.off('lead:updated', handleSocketUpdate);
      socket.off('meeting:created', handleSocketUpdate);
      socket.off('meeting:updated', handleSocketUpdate);
      socket.off('meeting:deleted', handleSocketUpdate);
    };
  }, [socket, currentUser?._id, fetchDashboardData]);

  return (
    <DashboardContext.Provider
      value={{
        dashboardMetrics,
        rawData,
        commandCenterData,
        campaignSummaries,
        pipelineData,
        selectedCampaign,
        initialLoading,
        metricsLoaded,
        tasksLoaded,
        commandCenterLoaded,
        isRefreshing,
        weeklyReport,
        loadingWeeklyReport,
        isGeneratingWeeklyReport,
        setCampaignFilter,
        refreshDashboard: fetchDashboardData,
        refreshWeeklyReport: () => fetchWeeklyReport(true),
        generateWeeklyReport,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};
