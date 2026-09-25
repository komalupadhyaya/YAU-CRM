import React from 'react';
import { Flame, Clock, Snowflake, PieChart, Activity } from 'lucide-react';

export interface ScoreBreakdownData {
  hot: number;
  warm: number;
  cold: number;
  total: number;
  hotPct: number;
  warmPct: number;
  coldPct: number;
}

interface LeadScoreBreakdownWidgetProps {
  data: ScoreBreakdownData;
  loading?: boolean;
}

export const LeadScoreBreakdownWidget: React.FC<LeadScoreBreakdownWidgetProps> = ({
  data,
  loading = false
}) => {
  const { hot = 0, warm = 0, cold = 0, total = 0, hotPct = 0, warmPct = 0, coldPct = 0 } = data || {};

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
      {/* Priority 7 Header */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Activity size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-sm">
                  Priority 7
                </span>
                <h2 className="text-base font-bold text-foreground">Lead Score Breakdown</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI temperature classification pipeline across all assigned leads
              </p>
            </div>
          </div>

          <span className="text-xs font-extrabold text-foreground px-2.5 py-1 rounded-lg bg-accent border">
            {total} Total Leads
          </span>
        </div>

        {/* Visual Pipeline Bar */}
        <div className="mb-4">
          <div className="h-3 w-full bg-accent rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${hotPct}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`Hot: ${hot} (${hotPct}%)`}
            />
            <div
              style={{ width: `${warmPct}%` }}
              className="bg-amber-500 transition-all duration-500"
              title={`Warm: ${warm} (${warmPct}%)`}
            />
            <div
              style={{ width: `${coldPct}%` }}
              className="bg-sky-500 transition-all duration-500"
              title={`Cold: ${cold} (${coldPct}%)`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-medium px-0.5">
            <span className="text-rose-600 dark:text-rose-400 font-bold">{hotPct}% Hot</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">{warmPct}% Warm</span>
            <span className="text-sky-600 dark:text-sky-400 font-bold">{coldPct}% Cold</span>
          </div>
        </div>

        {/* 3 KPI Subcards */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Hot */}
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 text-xs font-bold mb-1">
              <Flame size={13} className="fill-rose-500 text-rose-500" />
              <span>Hot</span>
            </div>
            <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{hot}</p>
            <span className="text-[10px] text-muted-foreground">{hotPct}% of pipeline</span>
          </div>

          {/* Warm */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-bold mb-1">
              <Clock size={13} />
              <span>Warm</span>
            </div>
            <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{warm}</p>
            <span className="text-[10px] text-muted-foreground">{warmPct}% of pipeline</span>
          </div>

          {/* Cold */}
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-sky-600 dark:text-sky-400 text-xs font-bold mb-1">
              <Snowflake size={13} />
              <span>Cold</span>
            </div>
            <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400">{cold}</p>
            <span className="text-[10px] text-muted-foreground">{coldPct}% of pipeline</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadScoreBreakdownWidget;
