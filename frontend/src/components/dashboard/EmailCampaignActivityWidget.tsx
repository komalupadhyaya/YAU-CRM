import React from 'react';
import { Mail, ArrowRight, MousePointer, Eye, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface EmailCampaignItem {
  _id: string;
  title: string;
  subject: string;
  status: string;
  sentAt?: string;
  sentCount: number;
  deliveredCount: number;
  opensCount: number;
  clicksCount: number;
  openRate: number;
  clickRate: number;
}

interface EmailCampaignActivityWidgetProps {
  campaigns: EmailCampaignItem[] | null;
  loading?: boolean;
}

export const EmailCampaignActivityWidget: React.FC<EmailCampaignActivityWidgetProps> = ({
  campaigns,
  loading = false
}) => {
  if (!campaigns) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Priority 10 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-teal-500/20">
            <Mail size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-teal-600 text-white shadow-sm">
                Priority 10 — Admin Only
              </span>
              <h2 className="text-base font-bold text-foreground">Email Campaign Activity</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-accent text-muted-foreground border">
                SendGrid Live Telemetry
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recent outbound marketing campaigns, recipient delivery, open rates, and click engagement
            </p>
          </div>
        </div>

        <Link
          to="/email-marketing"
          className="text-xs text-primary font-bold hover:underline flex items-center gap-1 self-start sm:self-auto"
        >
          All Campaigns <ArrowRight size={13} />
        </Link>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
          Loading email campaign stats...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="py-8 text-center bg-background/40 rounded-xl border border-dashed">
          <Mail size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold text-foreground">No Email Campaigns Sent Recently</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and dispatch segmented campaigns in Email Marketing.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
          {campaigns.map((c) => (
            <div
              key={c._id}
              className="bg-background/60 hover:bg-background border rounded-xl p-3.5 transition-all hover:shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="truncate">
                  <h4 className="font-bold text-sm text-foreground truncate">
                    {c.title}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">
                    Subject: "{c.subject}"
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                  <span className="capitalize px-2 py-0.5 rounded-full bg-accent border font-semibold">
                    {c.status}
                  </span>
                  {c.sentAt && (
                    <span>{new Date(c.sentAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  )}
                </div>
              </div>

              {/* Progress Gauges: Open Rate & Click Rate */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Recipients</span>
                  <strong className="text-foreground">{c.deliveredCount || c.sentCount}</strong>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground flex items-center gap-0.5"><Eye size={10} /> Open Rate</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{c.openRate}%</strong>
                  </div>
                  <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                    <div style={{ width: `${Math.min(c.openRate, 100)}%` }} className="h-full bg-emerald-500 rounded-full" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground flex items-center gap-0.5"><MousePointer size={10} /> Click Rate</span>
                    <strong className="text-sky-600 dark:text-sky-400">{c.clickRate}%</strong>
                  </div>
                  <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                    <div style={{ width: `${Math.min(c.clickRate, 100)}%` }} className="h-full bg-sky-500 rounded-full" />
                  </div>
                </div>

                <div className="text-right flex items-center justify-end">
                  <span className="text-[11px] text-muted-foreground">
                    {c.opensCount} opens • {c.clicksCount} clicks
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailCampaignActivityWidget;
