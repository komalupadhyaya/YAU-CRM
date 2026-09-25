import React, { useEffect, useState, useCallback } from 'react';
import { 
  AlertTriangle, 
  Flame, 
  Clock, 
  Snowflake, 
  Send, 
  RefreshCw, 
  ExternalLink, 
  X, 
  Sparkles, 
  CheckCircle2, 
  User, 
  MessageSquare, 
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../api/api';
import { useSocket } from '../../context/SocketContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';

export interface StalledLeadItem {
  _id: string;
  leadType: 'ea_lead' | 'lead';
  name: string;
  email?: string | null;
  phone?: string | null;
  score: 'Hot' | 'Warm' | 'Cold' | string;
  status?: string;
  daysInactive: number;
  stalledAt: string;
  stalledReason?: string;
  lastActivityAt?: string;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
  source?: string;
  draftMessage?: string | null;
  suggestedAt?: string | null;
}

interface StalledCounts {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  ea: number;
  crm: number;
}

export const StalledLeadsWidget: React.FC = () => {
  const { socket } = useSocket();
  const [stalledLeads, setStalledLeads] = useState<StalledLeadItem[]>([]);
  const [counts, setCounts] = useState<StalledCounts>({
    total: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    ea: 0,
    crm: 0
  });
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'hot' | 'warm' | 'cold' | 'ea' | 'crm'>('all');

  // Re-engagement Modal State
  const [reengageModalOpen, setReengageModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<StalledLeadItem | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch stalled leads from backend
  const fetchStalledLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/stalled-leads');
      if (res.data?.success) {
        setStalledLeads(res.data.stalledLeads || []);
        setCounts(res.data.counts || { total: 0, hot: 0, warm: 0, cold: 0, ea: 0, crm: 0 });
      }
    } catch (err: any) {
      console.error('Failed to load stalled leads:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStalledLeads();
  }, [fetchStalledLeads]);

  // Listen to Socket.IO real-time events
  useEffect(() => {
    if (!socket) return;

    const handleStalledUpdated = () => {
      fetchStalledLeads(true);
    };

    socket.on('ea_lead:stalled_updated', handleStalledUpdated);
    socket.on('lead:stalled_updated', handleStalledUpdated);

    return () => {
      socket.off('ea_lead:stalled_updated', handleStalledUpdated);
      socket.off('lead:stalled_updated', handleStalledUpdated);
    };
  }, [socket, fetchStalledLeads]);

  // On-demand manual scan
  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const res = await api.post('/stalled-leads/scan');
      if (res.data?.success) {
        toast.success(`Scan complete: ${res.data.currentlyStalledCount} stalled leads found (${res.data.newlyStalledCount} newly flagged).`);
        await fetchStalledLeads(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to scan for stalled leads.');
    } finally {
      setIsScanning(false);
    }
  };

  // Open Re-engage Modal
  const openReengageModal = (lead: StalledLeadItem) => {
    setSelectedLead(lead);
    setCustomMessage(lead.draftMessage || `Hi ${lead.name}, checking in to see if you have any questions about our sports programs! Let us know if you'd like to connect.`);
    setReengageModalOpen(true);
  };

  // Execute 1-Click Send Re-engagement
  const handleSendReengage = async () => {
    if (!selectedLead || !customMessage.trim()) return;

    setIsSending(true);
    try {
      const res = await api.post(`/stalled-leads/${selectedLead._id}/re-engage`, {
        message: customMessage.trim(),
        leadType: selectedLead.leadType
      });

      if (res.data?.success) {
        toast.success(`Re-engagement dispatched to ${selectedLead.name} and stalled flag cleared!`);
        setReengageModalOpen(false);
        setSelectedLead(null);
        await fetchStalledLeads(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send re-engagement message.');
    } finally {
      setIsSending(false);
    }
  };

  // Dismiss Stalled Flag
  const handleDismiss = async (lead: StalledLeadItem) => {
    try {
      const res = await api.post(`/stalled-leads/${lead._id}/dismiss`, {
        leadType: lead.leadType
      });
      if (res.data?.success) {
        toast.info(`Stalled status dismissed for ${lead.name}`);
        await fetchStalledLeads(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dismiss stalled status.');
    }
  };

  // Filtered Leads
  const filteredLeads = stalledLeads.filter(lead => {
    const s = (lead.score || '').toLowerCase();
    if (activeFilter === 'hot') return s === 'hot';
    if (activeFilter === 'warm') return s === 'warm';
    if (activeFilter === 'cold') return s === 'cold';
    if (activeFilter === 'ea') return lead.leadType === 'ea_lead';
    if (activeFilter === 'crm') return lead.leadType === 'lead';
    return true;
  });

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-sm mb-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 text-amber-500 flex items-center justify-center shadow-inner">
            <ShieldAlert size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Stalled Leads Intelligence</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {counts.total} Inactive
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nightly scan flags leads exceeding inactivity thresholds (Hot: 3d | Warm: 5d | Cold: 7d)
            </p>
          </div>
        </div>

        {/* Action Button: Scan Now */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerScan}
            disabled={isScanning}
            className="bg-accent/40 hover:bg-accent border border-border text-foreground text-xs h-9 px-3.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            title="Scan database for stalled leads immediately"
          >
            <RefreshCw size={13} className={isScanning ? 'animate-spin text-primary' : 'text-muted-foreground'} />
            {isScanning ? 'Scanning Leads...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div 
          onClick={() => setActiveFilter('all')}
          className={`cursor-pointer border rounded-xl p-3 transition-all ${
            activeFilter === 'all' ? 'bg-primary/10 border-primary shadow-sm' : 'bg-background/40 hover:bg-accent/30'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Stalled</span>
          <p className="text-2xl font-extrabold text-foreground mt-0.5">{counts.total}</p>
        </div>

        <div 
          onClick={() => setActiveFilter('hot')}
          className={`cursor-pointer border rounded-xl p-3 transition-all ${
            activeFilter === 'hot' ? 'bg-rose-500/15 border-rose-500/40 shadow-sm' : 'bg-background/40 hover:bg-rose-500/5'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <Flame size={12} /> Hot (&ge;3d)
          </span>
          <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">{counts.hot}</p>
        </div>

        <div 
          onClick={() => setActiveFilter('warm')}
          className={`cursor-pointer border rounded-xl p-3 transition-all ${
            activeFilter === 'warm' ? 'bg-amber-500/15 border-amber-500/40 shadow-sm' : 'bg-background/40 hover:bg-amber-500/5'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Clock size={12} /> Warm (&ge;5d)
          </span>
          <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{counts.warm}</p>
        </div>

        <div 
          onClick={() => setActiveFilter('cold')}
          className={`cursor-pointer border rounded-xl p-3 transition-all ${
            activeFilter === 'cold' ? 'bg-sky-500/15 border-sky-500/40 shadow-sm' : 'bg-background/40 hover:bg-sky-500/5'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1">
            <Snowflake size={12} /> Cold (&ge;7d)
          </span>
          <p className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">{counts.cold}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-accent/40 text-muted-foreground hover:bg-accent'
          }`}
        >
          All ({counts.total})
        </button>
        <button
          onClick={() => setActiveFilter('hot')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
            activeFilter === 'hot' ? 'bg-rose-500 text-white shadow-sm' : 'bg-accent/40 text-muted-foreground hover:bg-accent'
          }`}
        >
          <Flame size={12} /> Hot ({counts.hot})
        </button>
        <button
          onClick={() => setActiveFilter('warm')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
            activeFilter === 'warm' ? 'bg-amber-500 text-white shadow-sm' : 'bg-accent/40 text-muted-foreground hover:bg-accent'
          }`}
        >
          <Clock size={12} /> Warm ({counts.warm})
        </button>
        <button
          onClick={() => setActiveFilter('cold')}
          className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
            activeFilter === 'cold' ? 'bg-sky-500 text-white shadow-sm' : 'bg-accent/40 text-muted-foreground hover:bg-accent'
          }`}
        >
          <Snowflake size={12} /> Cold ({counts.cold})
        </button>
        <button
          onClick={() => setActiveFilter('ea')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeFilter === 'ea' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-accent/40 text-muted-foreground hover:bg-accent'
          }`}
        >
          EA Leads ({counts.ea})
        </button>
        <button
          onClick={() => setActiveFilter('crm')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeFilter === 'crm' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-accent/40 text-muted-foreground hover:bg-accent'
          }`}
        >
          CRM Leads ({counts.crm})
        </button>
      </div>

      {/* Leads List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground animate-pulse flex items-center justify-center gap-2">
          <RefreshCw size={16} className="text-primary animate-spin" /> Loading stalled leads...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="py-12 text-center bg-background/30 rounded-xl border border-dashed">
          <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-foreground">No Stalled Leads</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {activeFilter === 'all'
              ? 'Great job! All active leads currently have ongoing interactions within the threshold windows.'
              : `No leads currently match the "${activeFilter}" filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {filteredLeads.map((lead) => {
            const isHot = lead.score?.toLowerCase() === 'hot';
            const isWarm = lead.score?.toLowerCase() === 'warm';
            const leadLink = lead.leadType === 'ea_lead' ? `/ea-leads?leadId=${lead._id}` : `/lead/${lead._id}`;

            return (
              <div
                key={lead._id}
                className="bg-background/50 hover:bg-background/80 border rounded-xl p-4 transition-all hover:shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <Link
                      to={leadLink}
                      className="font-bold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                    >
                      {lead.name}
                      <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </Link>

                    {/* Lead Type Pill */}
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent text-muted-foreground border">
                      {lead.leadType === 'ea_lead' ? 'EA Lead' : 'CRM Lead'}
                    </span>

                    {/* Temperature Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isHot
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : isWarm
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                      }`}
                    >
                      {isHot ? <Flame size={10} /> : isWarm ? <Clock size={10} /> : <Snowflake size={10} />}
                      {lead.score}
                    </span>

                    {/* Inactivity Pill */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      {lead.daysInactive} days inactive
                    </span>
                  </div>

                  {/* Assigned Rep */}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <User size={12} className="text-muted-foreground" />
                    <span>Assigned: <strong className="text-foreground">{lead.assignedTo?.name || 'Unassigned'}</strong></span>
                  </div>
                </div>

                {/* Claude AI Re-engagement draft message */}
                {lead.draftMessage && (
                  <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-3 my-2 text-xs">
                    <div className="flex items-center gap-1.5 text-primary font-bold text-[11px] mb-1">
                      <Sparkles size={12} />
                      <span>Claude Re-engagement Draft:</span>
                    </div>
                    <p className="text-foreground/90 italic font-mono text-[11px] leading-relaxed">
                      "{lead.draftMessage}"
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    {lead.source ? `Source: ${lead.source}` : ''}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDismiss(lead)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg hover:bg-accent transition-colors"
                      title="Dismiss stalled alert without action"
                    >
                      Dismiss
                    </button>

                    <button
                      onClick={() => openReengageModal(lead)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <Send size={12} />
                      <span>1-Click Re-engage</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Re-engage Modal */}
      <Dialog open={reengageModalOpen} onOpenChange={setReengageModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles size={18} className="text-primary" />
              Re-engage Stalled Lead: {selectedLead?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review or customize Claude's drafted message before dispatching. Sending will automatically clear the stalled status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-accent/30 p-2.5 rounded-lg border">
              <div>
                <strong>Lead:</strong> {selectedLead?.name} ({selectedLead?.leadType === 'ea_lead' ? 'EA Lead' : 'CRM Lead'})
              </div>
              <div>
                <strong>Inactive:</strong> {selectedLead?.daysInactive} days
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Re-engagement SMS / Message
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
                className="w-full text-xs font-mono p-3 rounded-lg border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed"
                placeholder="Type your re-engagement message..."
              />
              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1">
                <span>Tailored based on lead history and score</span>
                <span>{customMessage.length} characters</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <button
              onClick={() => setReengageModalOpen(false)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendReengage}
              disabled={isSending || !customMessage.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Send size={13} className={isSending ? 'animate-spin' : ''} />
              {isSending ? 'Dispatching...' : 'Send Message & Clear Stalled'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StalledLeadsWidget;
