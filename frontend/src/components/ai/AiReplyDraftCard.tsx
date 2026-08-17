import React, { useState } from 'react';
import { Bot, Send, Edit3, Trash2, Check } from 'lucide-react';
import { approveReplyDraft, dismissReplyDraft, AiReplyDraft } from '../../api/ai.api';
import { toast } from 'sonner';

interface AiReplyDraftCardProps {
    leadId: string;
    leadType?: 'ea_lead' | 'main_lead';
    aiReplyDraft?: AiReplyDraft;
    onReplyAction?: () => void;
}

export const AiReplyDraftCard: React.FC<AiReplyDraftCardProps> = ({
    leadId,
    leadType = 'ea_lead',
    aiReplyDraft,
    onReplyAction
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draftText, setDraftText] = useState(aiReplyDraft?.text || '');
    const [loading, setLoading] = useState(false);

    if (!aiReplyDraft || !aiReplyDraft.text || aiReplyDraft.status !== 'pending') return null;

    const handleApprove = async () => {
        const toastId = toast.loading('Dispatching AI reply via Twilio SMS...');
        try {
            setLoading(true);
            const res = await approveReplyDraft(leadId, leadType, draftText);
            if (res.success) {
                toast.success('AI Reply approved & sent via SMS! 📩', { id: toastId });
                if (onReplyAction) onReplyAction();
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to send reply', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async () => {
        const toastId = toast.loading('Dismissing AI reply draft...');
        try {
            setLoading(true);
            await dismissReplyDraft(leadId, leadType);
            toast.info('Draft reply dismissed', { id: toastId });
            if (onReplyAction) onReplyAction();
        } catch (err: any) {
            toast.error(err.message || 'Failed to dismiss draft', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 shadow-xl mb-4 text-left">
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Bot className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                        Claude AI Drafted Reply ({aiReplyDraft.category || 'Suggested'})
                    </span>
                </div>
                {aiReplyDraft.confidenceScore && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-400">
                        Confidence: {aiReplyDraft.confidenceScore}%
                    </span>
                )}
            </div>

            {isEditing ? (
                <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none h-20 mb-3"
                />
            ) : (
                <p className="text-xs text-slate-200 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-3 italic">
                    "{draftText}"
                </p>
            )}

            <div className="flex items-center justify-end gap-2">
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Done Editing' : 'Edit Reply'}</span>
                </button>
                <button
                    onClick={handleDismiss}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Dismiss</span>
                </button>
                <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all disabled:opacity-50"
                >
                    <Send className="w-3.5 h-3.5" />
                    <span>Approve & Send</span>
                </button>
            </div>
        </div>
    );
};

export default AiReplyDraftCard;
