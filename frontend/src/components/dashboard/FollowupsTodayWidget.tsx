import React, { useState } from 'react';
import { CheckCircle2, Clock, Phone, AlertCircle, Calendar, ExternalLink, User, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDialerStore } from '../../store/dialerStore';
import { toast } from 'sonner';
import api from '../../api/api';

export interface FollowupItem {
  _id: string;
  title: string;
  notes?: string;
  date_time: string;
  type: string;
  priority?: string;
  status?: string;
  lead_id_val?: string;
  lead_name: string;
  leadType?: string;
  telephone?: string;
  assignedTo?: any;
}

interface FollowupsTodayWidgetProps {
  items: FollowupItem[];
  overdueItems?: FollowupItem[];
  loading?: boolean;
  onRefresh?: () => void;
  isAdminOrManager?: boolean;
  onEditFollowup?: (item: FollowupItem) => void;
}

export const FollowupsTodayWidget: React.FC<FollowupsTodayWidgetProps> = ({
  items,
  overdueItems = [],
  loading = false,
  onRefresh,
  isAdminOrManager = false,
  onEditFollowup
}) => {
  const [activeTab, setActiveTab] = useState<'today' | 'overdue'>('today');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const openDialer = useDialerStore(state => state.openDialer);

  const displayList = activeTab === 'today' ? items : overdueItems;

  const handleCall = (item: FollowupItem) => {
    if (!item.telephone) return;
    const cleanPhone = item.telephone.startsWith('+') ? item.telephone : `+1${item.telephone.replace(/\D/g, '')}`;
    openDialer(cleanPhone, item.lead_id_val, item.lead_name || 'Lead', true);
  };

  const handleMarkComplete = async (item: FollowupItem) => {
    try {
      setCompletingId(item._id);
      await api.patch(`/followups/${item._id}/status`, { status: 'completed' });
      toast.success(`Follow-up completed: "${item.title}"`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete follow-up');
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="bg-card border border-amber-500/20 rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Priority 4 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Calendar size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">
                Priority 4
              </span>
              <h2 className="text-base font-bold text-foreground">Follow-Ups Due Today</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {items.length} Due Today
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scheduled tasks, calls, and check-ins requiring execution today
            </p>
          </div>
        </div>

        {/* Tab Toggle: Due Today vs Overdue */}
        <div className="flex items-center gap-1.5 bg-accent/40 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('today')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'today' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Due Today ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
              activeTab === 'overdue' ? 'bg-rose-500 text-white shadow-sm' : 'text-muted-foreground hover:text-rose-500'
            }`}
          >
            Overdue ({overdueItems.length})
          </button>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="py-10 text-center text-xs text-muted-foreground animate-pulse">
          Loading follow-ups...
        </div>
      ) : displayList.length === 0 ? (
        <div className="py-8 text-center bg-background/40 rounded-xl border border-dashed">
          <CheckCircle2 size={28} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">
            {activeTab === 'today' ? 'All caught up on today’s follow-ups!' : 'No overdue follow-up tasks!'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Great momentum — your pipeline tasks are completely up to date.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {displayList.map((item) => {
            const isCall = (item.type || '').toLowerCase() === 'call';
            const leadLink = item.leadType === 'ea_lead' 
              ? `/ea-leads?leadId=${item.lead_id_val}` 
              : `/lead/${item.lead_id_val}`;

            return (
              <div
                key={item._id}
                className="bg-background/60 hover:bg-background border rounded-xl p-3.5 transition-all hover:shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent text-muted-foreground border">
                      {item.type || 'Task'}
                    </span>

                    <h4 className="font-bold text-sm text-foreground truncate">
                      {item.title}
                    </h4>

                    {item.priority && (
                      <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded ${
                        item.priority.toLowerCase() === 'high' 
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.priority}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>Lead:</span>
                    <Link
                      to={leadLink}
                      className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-0.5 truncate"
                    >
                      {item.lead_name}
                      <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" />
                    </Link>
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 italic mb-1">
                      "{item.notes}"
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1 text-foreground/80 font-medium">
                      <Clock size={10} /> {new Date(item.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isAdminOrManager && item.assignedTo?.name && (
                      <span className="flex items-center gap-0.5 text-primary">
                        <User size={10} /> {item.assignedTo.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.telephone && isCall && (
                    <button
                      onClick={() => handleCall(item)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                      title="Call lead now"
                    >
                      <Phone size={11} /> Call
                    </button>
                  )}

                  {onEditFollowup && (
                    <button
                      onClick={() => onEditFollowup(item)}
                      className="border text-xs px-2.5 py-1.5 rounded-lg font-medium hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    onClick={() => handleMarkComplete(item)}
                    disabled={completingId === item._id}
                    className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/30 text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all active:scale-95"
                    title="Mark follow-up completed"
                  >
                    <Check size={12} className={completingId === item._id ? 'animate-spin' : ''} />
                    Done
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FollowupsTodayWidget;
