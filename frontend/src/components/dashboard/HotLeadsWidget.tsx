import React from 'react';
import { Flame, Phone, MessageSquare, ExternalLink, User, Clock, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDialerStore } from '../../store/dialerStore';

export interface HotLeadItem {
  _id: string;
  name: string;
  leadType: 'ea_lead' | 'lead';
  phone?: string;
  campaignName?: string;
  status?: string;
  aiScore: string;
  aiScoreReason?: string;
  assignedTo?: { name: string; email: string } | null;
  lastActivityAt?: string;
}

interface HotLeadsWidgetProps {
  leads: HotLeadItem[];
  loading?: boolean;
  onOpenSms?: (lead: HotLeadItem) => void;
  isAdminOrManager?: boolean;
}

export const HotLeadsWidget: React.FC<HotLeadsWidgetProps> = ({
  leads,
  loading = false,
  onOpenSms,
  isAdminOrManager = false
}) => {
  const openDialer = useDialerStore(state => state.openDialer);

  const handleCall = (lead: HotLeadItem) => {
    if (!lead.phone) return;
    const cleanPhone = lead.phone.startsWith('+') ? lead.phone : `+1${lead.phone.replace(/\D/g, '')}`;
    openDialer(cleanPhone, lead._id, lead.name || 'Hot Lead', true);
  };

  return (
    <div className="bg-card border border-rose-500/20 rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Priority 1 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-rose-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
            <Flame size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-500 text-white shadow-sm">
                Priority 1 — Immediate Action
              </span>
              <h2 className="text-base font-bold text-foreground">Hot Leads</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {leads.length} Urgent
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Leads actively showing high intent or confirmed milestone — immediate rep outreach required
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-10 text-center text-xs text-muted-foreground animate-pulse">
          Loading hot leads...
        </div>
      ) : leads.length === 0 ? (
        <div className="py-8 text-center bg-background/40 rounded-xl border border-dashed">
          <Flame size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold text-foreground">No Hot Leads Pending Outreach</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            All leads are either engaged or awaiting next trigger events.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
          {leads.map((lead) => {
            const leadLink = lead.leadType === 'ea_lead' ? `/ea-leads?leadId=${lead._id}` : `/lead/${lead._id}`;
            return (
              <div
                key={lead._id}
                className="bg-background/60 hover:bg-background border border-rose-500/15 hover:border-rose-500/40 rounded-xl p-3.5 transition-all hover:shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 truncate">
                      <Link
                        to={leadLink}
                        className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate flex items-center gap-1"
                        title={lead.name}
                      >
                        {lead.name}
                        <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </Link>
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground border">
                        {lead.leadType === 'ea_lead' ? 'EA' : 'CRM'}
                      </span>
                    </div>

                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1 shrink-0">
                      <Flame size={10} className="fill-rose-500 text-rose-500" />
                      HOT
                    </span>
                  </div>

                  {/* AI Reason / Intent */}
                  <p className="text-[11px] text-muted-foreground line-clamp-2 italic mb-2">
                    "{lead.aiScoreReason || 'Scored Hot by Claude AI — contact ASAP.'}"
                  </p>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-2 text-[10px] text-muted-foreground">
                    {lead.phone && (
                      <span className="font-mono text-foreground/80 font-medium">{lead.phone}</span>
                    )}
                    {lead.campaignName && (
                      <span className="truncate max-w-[120px]">• {lead.campaignName}</span>
                    )}
                    {isAdminOrManager && lead.assignedTo?.name && (
                      <span className="flex items-center gap-0.5 text-primary">
                        <User size={10} /> {lead.assignedTo.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2.5 mt-2 border-t border-border/50">
                  {lead.phone && (
                    <button
                      onClick={() => handleCall(lead)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      title="Trigger dialer call"
                    >
                      <Phone size={11} /> Call Now
                    </button>
                  )}
                  {onOpenSms && lead.phone && (
                    <button
                      onClick={() => onOpenSms(lead)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      title="Send SMS"
                    >
                      <MessageSquare size={11} /> Send SMS
                    </button>
                  )}
                  <Link
                    to={leadLink}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
                  >
                    View &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HotLeadsWidget;
