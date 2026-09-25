import React from 'react';
import { PhoneCall, ArrowRight, PhoneForwarded, Voicemail, ShieldAlert, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface RetellCallData {
  aiCallsToday: number;
  transfersCompleted: number;
  voicemailsToday: number;
  voicemailsUnread: number;
}

interface RetellCallSummaryWidgetProps {
  data: RetellCallData | null;
  loading?: boolean;
}

export const RetellCallSummaryWidget: React.FC<RetellCallSummaryWidgetProps> = ({
  data,
  loading = false
}) => {
  if (!data) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Priority 8 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
            <PhoneCall size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-600 text-white shadow-sm">
                Priority 8 — Admin Only
              </span>
              <h2 className="text-base font-bold text-foreground">Retell AI Call Summary</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent text-muted-foreground border">
                Team-Wide Telephony
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live inbound voice agent operations, rep transfers, and caller voicemails today
            </p>
          </div>
        </div>

        <Link
          to="/call-logs"
          className="text-xs text-primary font-bold hover:underline flex items-center gap-1 self-start sm:self-auto"
        >
          View Call History <ArrowRight size={13} />
        </Link>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* AI Calls Handled */}
        <div className="bg-background/60 border rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
              AI Calls Today
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-extrabold text-foreground">{data.aiCallsToday}</span>
              <span className="text-[11px] text-muted-foreground">handled by Retell</span>
            </div>
          </div>
        </div>

        {/* Transfers Completed */}
        <div className="bg-background/60 border rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PhoneForwarded size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
              Rep Transfers
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{data.transfersCompleted}</span>
              <span className="text-[11px] text-muted-foreground">connected to staff</span>
            </div>
          </div>
        </div>

        {/* Voicemails Received */}
        <div className="bg-background/60 border rounded-xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Voicemail size={20} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
              Voicemails Today
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-extrabold text-foreground">{data.voicemailsToday}</span>
              {data.voicemailsUnread > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">
                  {data.voicemailsUnread} unread
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetellCallSummaryWidget;
