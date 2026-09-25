import React, { useState } from 'react';
import { Sparkles, Check, X, Clock, Calendar, ExternalLink, User, Edit3, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../api/api';

export interface AiSuggestionItem {
  leadId: string;
  leadType: 'ea_lead' | 'lead';
  name: string;
  phone?: string;
  aiScore?: string;
  action: string;
  reason?: string;
  priority?: string;
  recommendedDueDate?: string;
  status?: string;
  suggestedAt?: string;
  assignedTo?: string;
}

interface AiSuggestionsWidgetProps {
  suggestions: AiSuggestionItem[];
  loading?: boolean;
  onRefresh?: () => void;
  isAdminOrManager?: boolean;
}

export const AiSuggestionsWidget: React.FC<AiSuggestionsWidgetProps> = ({
  suggestions,
  loading = false,
  onRefresh,
  isAdminOrManager = false
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (item: AiSuggestionItem) => {
    try {
      setProcessingId(item.leadId);
      const res = await api.post(`/next-action/${item.leadId}/accept`, {
        leadType: item.leadType
      });
      if (res.data?.success) {
        toast.success(`Action accepted for ${item.name}! Task added to your workflow.`);
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to accept AI suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (item: AiSuggestionItem) => {
    try {
      setProcessingId(item.leadId);
      const res = await api.post(`/next-action/${item.leadId}/dismiss`, {
        leadType: item.leadType
      });
      if (res.data?.success) {
        toast.info(`Suggestion dismissed for ${item.name}`);
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dismiss AI suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-card border border-purple-500/20 rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Priority 5 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-purple-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
            <Sparkles size={20} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-sm">
                Priority 5
              </span>
              <h2 className="text-base font-bold text-foreground">AI Suggestions Pending</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {suggestions.length} Waiting Rep Review
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Claude AI next-action recommendations queued for rep approval or dismissal
            </p>
          </div>
        </div>
      </div>

      {/* Suggestion List */}
      {loading ? (
        <div className="py-10 text-center text-xs text-muted-foreground animate-pulse">
          Loading AI recommendations...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="py-8 text-center bg-background/40 rounded-xl border border-dashed">
          <Sparkles size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold text-foreground">No Pending AI Suggestions</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Claude will automatically generate recommendations as leads interact with SMS, calls, and email.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {suggestions.map((item) => {
            const leadLink = item.leadType === 'ea_lead' ? `/ea-leads?leadId=${item.leadId}` : `/lead/${item.leadId}`;
            const isProcessing = processingId === item.leadId;

            return (
              <div
                key={item.leadId}
                className="bg-background/60 hover:bg-background border border-purple-500/15 hover:border-purple-500/40 rounded-xl p-3.5 transition-all hover:shadow-sm group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 truncate">
                    <Link
                      to={leadLink}
                      className="font-bold text-sm text-foreground hover:text-primary transition-colors truncate flex items-center gap-1"
                    >
                      {item.name}
                      <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </Link>
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground border">
                      {item.leadType === 'ea_lead' ? 'EA' : 'CRM'}
                    </span>
                    {item.aiScore && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-border">
                        {item.aiScore}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {item.recommendedDueDate && (
                      <span className="flex items-center gap-1 font-medium text-foreground/80">
                        <Calendar size={10} /> Due: {new Date(item.recommendedDueDate).toLocaleDateString()}
                      </span>
                    )}
                    {isAdminOrManager && item.assignedTo && (
                      <span className="flex items-center gap-0.5 text-primary">
                        <User size={10} /> {item.assignedTo}
                      </span>
                    )}
                  </div>
                </div>

                {/* Recommended Action Card */}
                <div className="bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 rounded-lg p-2.5 mb-2.5">
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold text-xs mb-1">
                    <Sparkles size={12} />
                    <span>Claude Recommendation:</span>
                    <span className="text-foreground font-semibold">{item.action}</span>
                  </div>
                  {item.reason && (
                    <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                      "{item.reason}"
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground">
                    Priority: <strong className="uppercase">{item.priority || 'medium'}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDismiss(item)}
                      disabled={isProcessing}
                      className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded hover:bg-accent transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <X size={12} /> Dismiss
                    </button>
                    <button
                      onClick={() => handleAccept(item)}
                      disabled={isProcessing}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <Check size={12} />
                      {isProcessing ? 'Processing...' : 'Accept Suggestion'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AiSuggestionsWidget;
