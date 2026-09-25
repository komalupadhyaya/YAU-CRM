import React from 'react';
import { UserPlus, TrendingUp, TrendingDown, ArrowRight, ExternalLink, Flame, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface NewEaLeadItem {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  aiScore?: string;
  dateSubmitted?: string;
  assignedTo?: string;
}

interface NewEaLeadsWidgetProps {
  todayCount: number;
  yesterdayCount: number;
  delta: number;
  pctChange: number;
  recentLeads: NewEaLeadItem[];
  loading?: boolean;
}

export const NewEaLeadsWidget: React.FC<NewEaLeadsWidgetProps> = ({
  todayCount = 0,
  yesterdayCount = 0,
  delta = 0,
  pctChange = 0,
  recentLeads = [],
  loading = false
}) => {
  const isPositive = delta >= 0;

  return (
    <div className="bg-card border border-emerald-500/20 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
      {/* Priority 6 Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <UserPlus size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                  Priority 6
                </span>
                <h2 className="text-base font-bold text-foreground">New EA Leads Today</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Incoming student and parent sports signups today vs yesterday
              </p>
            </div>
          </div>

          <Link
            to="/ea-leads"
            className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
          >
            All EA Leads <ArrowRight size={13} />
          </Link>
        </div>

        {/* Metric Comparison Card */}
        <div className="bg-background/60 border rounded-xl p-4 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Today's Inflow</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-extrabold text-foreground">{todayCount}</span>
              <span className="text-xs text-muted-foreground">leads today</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">vs Yesterday ({yesterdayCount})</span>
            <div className={`flex items-center justify-end gap-1 mt-0.5 text-xs font-bold ${
              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{delta >= 0 ? `+${delta}` : delta} ({pctChange >= 0 ? `+${pctChange}%` : `${pctChange}%`})</span>
            </div>
          </div>
        </div>

        {/* Recent Lead Items */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            Latest Arrivals Today
          </span>
          {recentLeads.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3 text-center">
              No new submissions recorded yet today.
            </p>
          ) : (
            recentLeads.slice(0, 4).map((l) => (
              <div
                key={l._id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-accent/30 hover:bg-accent/60 transition-colors text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <Link
                    to={`/ea-leads?leadId=${l._id}`}
                    className="font-bold text-foreground hover:text-primary transition-colors truncate"
                  >
                    {l.name}
                  </Link>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                    l.aiScore === 'Hot' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-muted text-muted-foreground'
                  }`}>
                    {l.aiScore || 'New'}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground shrink-0">
                  {l.dateSubmitted ? new Date(l.dateSubmitted).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NewEaLeadsWidget;
