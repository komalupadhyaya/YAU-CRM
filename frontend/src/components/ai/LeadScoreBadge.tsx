import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Flame, Sun, Snowflake, ChevronDown, Check, Sparkles } from 'lucide-react';
import { overrideLeadScore, rescoreLead, AiScore } from '../../api/ai.api';
import { toast } from 'sonner';

interface LeadScoreBadgeProps {
    leadId: string;
    leadType?: 'ea_lead' | 'main_lead';
    aiScore?: AiScore;
    onScoreUpdated?: (newScore: AiScore) => void;
    isAdmin?: boolean;
    showRationale?: boolean;
}

export const LeadScoreBadge: React.FC<LeadScoreBadgeProps> = ({
    leadId,
    leadType = 'ea_lead',
    aiScore,
    onScoreUpdated,
    isAdmin = true,
    showRationale = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const popoverRef = React.useRef<HTMLDivElement | null>(null);
    const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const score = aiScore?.score || 'Cold';
    const reason = aiScore?.reason || 'Scored based on lead submission details.';

    const toggleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isAdmin) return;
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // If near bottom of viewport, position above button
            let top = rect.bottom + 6;
            if (top + 220 > window.innerHeight) {
                top = Math.max(10, rect.top - 230);
            }
            const left = Math.max(10, Math.min(rect.left, window.innerWidth - 275));
            setPopoverPos({ top, left });
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    const getBadgeStyle = () => {
        switch (score) {
            case 'Hot':
                return {
                    bg: 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20',
                    dot: 'bg-red-500',
                    icon: <Flame className="w-3.5 h-3.5 text-red-500" />,
                    label: 'Hot'
                };
            case 'Warm':
                return {
                    bg: 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20',
                    dot: 'bg-amber-500',
                    icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
                    label: 'Warm'
                };
            case 'Cold':
            default:
                return {
                    bg: 'bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20',
                    dot: 'bg-blue-500',
                    icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />,
                    label: 'Cold'
                };
        }
    };

    const style = getBadgeStyle();

    const handleOverride = async (targetScore: 'Hot' | 'Warm' | 'Cold') => {
        const toastId = toast.loading(`Updating score to ${targetScore}...`);
        try {
            setLoading(true);
            const res = await overrideLeadScore(leadId, targetScore, 'Manually updated by admin', leadType);
            if (res.success && res.aiScore) {
                toast.success(`Score updated to ${targetScore} 🔴🟡🔵`, { id: toastId });
                if (onScoreUpdated) onScoreUpdated(res.aiScore);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to update score', { id: toastId });
        } finally {
            setLoading(false);
            setIsOpen(false);
        }
    };

    const handleRescoreWithAi = async () => {
        const toastId = toast.loading('Claude AI is analyzing lead activities & re-scoring...');
        try {
            setLoading(true);
            const res = await rescoreLead(leadId, leadType);
            if (res.success && res.aiScore) {
                toast.success(`Claude AI Scored Lead: ${res.aiScore.score}!`, {
                    id: toastId,
                    description: res.aiScore.reason
                });
                if (onScoreUpdated) onScoreUpdated(res.aiScore);
            }
        } catch (err: any) {
            toast.error(err.message || 'AI Re-scoring failed', { id: toastId });
        } finally {
            setLoading(false);
            setIsOpen(false);
        }
    };

    return (
        <div className="relative inline-block text-left">
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${style.bg} ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                title={`AI Scoring Rationale: ${reason}`}
            >
                <span className={`w-2 h-2 rounded-full ${style.dot} animate-pulse`} />
                {style.icon}
                <span>{style.label}</span>
                {isAdmin && (
                    <ChevronDown 
                        className={`w-3 h-3 opacity-60 ml-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                    />
                )}
            </button>

            {isOpen && popoverPos && createPortal(
                <div
                    ref={popoverRef}
                    style={{
                        position: 'fixed',
                        top: `${popoverPos.top}px`,
                        left: `${popoverPos.left}px`,
                    }}
                    className="w-64 rounded-xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ring-1 ring-black ring-opacity-5 z-[99999] p-3 text-left whitespace-normal break-words pointer-events-auto animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    {showRationale ? (
                        <>
                            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                <span>AI Lead Scoring</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRescoreWithAi();
                                    }}
                                    disabled={loading}
                                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-500/20"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    <span>AI Re-score</span>
                                </button>
                            </div>

                            <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg mb-3 border border-slate-150 dark:border-slate-800 leading-relaxed whitespace-normal break-words">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">Rationale: </span>
                                {reason}
                            </div>
                        </>
                    ) : (
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 border-b border-slate-100 dark:border-slate-800/60 pb-1.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                            <span>Change Priority Score</span>
                        </div>
                    )}

                    <div className="space-y-1">
                        {(['Hot', 'Warm', 'Cold'] as const).map(tier => (
                            <button
                                key={tier}
                                type="button"
                                disabled={loading}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOverride(tier);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    score === tier 
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' 
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${tier === 'Hot' ? 'bg-red-500' : tier === 'Warm' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                    <span>{tier}</span>
                                </div>
                                {score === tier && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default LeadScoreBadge;
