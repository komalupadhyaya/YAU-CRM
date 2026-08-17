import React, { useState } from 'react';
import { Sparkles, CheckCircle, XCircle, Calendar, ArrowRight } from 'lucide-react';
import { acceptNextAction, dismissNextAction, AiNextAction } from '../../api/ai.api';
import { toast } from 'sonner';

interface NextActionCardProps {
    leadId: string;
    leadType?: 'ea_lead' | 'main_lead';
    aiNextAction?: AiNextAction;
    onActionCompleted?: () => void;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
    leadId,
    leadType = 'ea_lead',
    aiNextAction,
    onActionCompleted
}) => {
    const [loading, setLoading] = useState(false);

    if (!aiNextAction || !aiNextAction.actionText) return null;

    const handleAccept = async () => {
        const toastId = toast.loading('Executing Claude AI Next Action...');
        try {
            setLoading(true);
            const res = await acceptNextAction(leadId, leadType);
            if (res.success) {
                toast.success('Next action accepted & task created! ⚡', { id: toastId });
                if (onActionCompleted) onActionCompleted();
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to accept action', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async () => {
        const toastId = toast.loading('Dismissing recommendation...');
        try {
            setLoading(true);
            await dismissNextAction(leadId, leadType);
            toast.info('AI recommendation dismissed', { id: toastId });
            if (onActionCompleted) onActionCompleted();
        } catch (err: any) {
            toast.error(err.message || 'Failed to dismiss action', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/20 border border-blue-500/30 rounded-2xl p-4 shadow-lg mb-6 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                        <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Claude AI Suggested Next Step</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                {aiNextAction.taskType}
                            </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-100 mb-1">
                            {aiNextAction.actionText}
                        </h4>
                        <p className="text-xs text-slate-400">
                            {aiNextAction.rationale}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleAccept}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all disabled:opacity-50"
                    >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Accept & Create Task</span>
                    </button>
                    <button
                        onClick={handleDismiss}
                        disabled={loading}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        title="Dismiss suggestion"
                    >
                        <XCircle className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NextActionCard;
