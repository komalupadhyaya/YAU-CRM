import React from 'react';
import { MessageSquare, ArrowRight, User, Clock, Flame, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface UnreadSmsItem {
  leadId: string;
  leadType: 'ea_lead' | 'lead';
  senderName: string;
  phone?: string;
  aiScore?: string;
  message?: string;
  timestamp?: string;
  unreadCount?: number;
  assignedTo?: string;
}

interface UnreadSmsWidgetProps {
  messages: UnreadSmsItem[];
  totalCount?: number;
  loading?: boolean;
  onOpenSmsModal?: (item: UnreadSmsItem) => void;
  isAdminOrManager?: boolean;
}

export const UnreadSmsWidget: React.FC<UnreadSmsWidgetProps> = ({
  messages,
  totalCount = 0,
  loading = false,
  onOpenSmsModal,
  isAdminOrManager = false
}) => {
  return (
    <div className="bg-card border border-sky-500/20 rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Priority 3 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-sky-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <MessageSquare size={20} className="animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500 text-white shadow-sm">
                Priority 3
              </span>
              <h2 className="text-base font-bold text-foreground">Unread SMS Replies</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                {totalCount || messages.length} Pending Replies
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Leads who replied to SMS and are awaiting human response
            </p>
          </div>
        </div>

        <Link
          to="/ea-leads"
          className="text-xs text-primary font-bold hover:underline flex items-center gap-1 self-start sm:self-auto"
        >
          View All SMS <ArrowRight size={13} />
        </Link>
      </div>

      {/* Message List */}
      {loading ? (
        <div className="py-10 text-center text-xs text-muted-foreground animate-pulse">
          Loading unread messages...
        </div>
      ) : messages.length === 0 ? (
        <div className="py-8 text-center bg-background/40 rounded-xl border border-dashed">
          <MessageSquare size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold text-foreground">Inbox Zero — No Unread SMS Replies</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            All inbound messages have been answered or processed.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
          {messages.map((item, idx) => {
            const isHot = (item.aiScore || '').toLowerCase() === 'hot';
            const leadLink = item.leadType === 'ea_lead' ? `/ea-leads?leadId=${item.leadId}` : `/lead/${item.leadId}`;

            return (
              <div
                key={`${item.leadId}-${idx}`}
                className="bg-background/60 hover:bg-background border border-sky-500/15 hover:border-sky-500/40 rounded-xl p-3.5 transition-all hover:shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link
                      to={leadLink}
                      className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate"
                    >
                      {item.senderName}
                    </Link>

                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground border">
                      {item.leadType === 'ea_lead' ? 'EA Lead' : 'CRM Lead'}
                    </span>

                    {item.aiScore && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isHot 
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' 
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      }`}>
                        {item.aiScore}
                      </span>
                    )}

                    {item.unreadCount && item.unreadCount > 1 && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-500 text-white">
                        {item.unreadCount} unread
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-foreground/90 font-mono bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/15 rounded-lg px-2.5 py-1.5 mb-1.5 truncate">
                    "{item.message || 'New inbound SMS message received.'}"
                  </p>

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {item.phone && <span>{item.phone}</span>}
                    {item.timestamp && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {isAdminOrManager && item.assignedTo && (
                      <span className="flex items-center gap-0.5 text-primary">
                        <User size={10} /> {item.assignedTo}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onOpenSmsModal ? (
                    <button
                      onClick={() => onOpenSmsModal(item)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <MessageSquare size={12} /> Reply Now
                    </button>
                  ) : (
                    <Link
                      to={leadLink}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <MessageSquare size={12} /> Open Chat
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UnreadSmsWidget;
