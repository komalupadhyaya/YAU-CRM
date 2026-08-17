import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Send, X } from 'lucide-react';
import { getStalledLeads, sendStalledFollowup } from '../../api/ai.api';
import { toast } from 'sonner';

export const StalledLeadsWidget: React.FC = () => {
    const [stalledLeads, setStalledLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<any | null>(null);
    const [customMsg, setCustomMsg] = useState('');
    const [sending, setSending] = useState(false);

    const fetchStalled = async () => {
        try {
            setLoading(true);
            const res = await getStalledLeads();
            if (res.success) {
                setStalledLeads(res.stalledLeads || []);
            }
        } catch (err) {
            console.error('Failed to fetch stalled leads:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStalled();
    }, []);

    const handleSendFollowup = async () => {
        if (!selectedLead) return;
        const toastId = toast.loading(`Dispatching Claude AI follow-up to ${selectedLead.name}...`);
        try {
            setSending(true);
            const res = await sendStalledFollowup(selectedLead._id, selectedLead.leadType, customMsg);
            if (res.success) {
                toast.success('Stalled lead follow-up dispatched & alert cleared! 🚀', { id: toastId });
                setSelectedLead(null);
                fetchStalled();
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to send follow-up', { id: toastId });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-100">Stalled Leads Radar</h3>
                        <p className="text-xs text-slate-400">Leads with no activity exceeding threshold</p>
                    </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {stalledLeads.length} Stalled
                </span>
            </div>

            {loading ? (
                <div className="text-xs text-slate-500 py-6 text-center">Scanning stalled leads...</div>
            ) : stalledLeads.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center bg-slate-950/50 rounded-xl border border-slate-800/80">
                    🎉 Excellent! All leads are actively engaged with no stalled follow-ups.
                </div>
            ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {stalledLeads.slice(0, 5).map((lead) => (
                        <div
                            key={lead._id}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                        >
                            <div className="min-w-0 flex-1 pr-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-slate-200 truncate">{lead.name}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                                        {lead.stalledInfo?.daysStalled || 3} days idle
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {lead.stalledInfo?.draftFollowup || 'Follow-up suggested'}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedLead(lead);
                                    setCustomMsg(lead.stalledInfo?.draftFollowup || '');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 transition-colors shrink-0"
                            >
                                <Send className="w-3 h-3" />
                                <span>Re-engage</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for sending stalled lead follow-up */}
            {selectedLead && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
                            <h4 className="text-sm font-semibold text-slate-100">
                                Re-engage Stalled Lead: {selectedLead.name}
                            </h4>
                            <button onClick={() => setSelectedLead(null)} className="text-slate-400 hover:text-slate-200">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">
                            Claude AI generated re-engagement message:
                        </p>
                        <textarea
                            value={customMsg}
                            onChange={(e) => setCustomMsg(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-none h-24 mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setSelectedLead(null)}
                                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendFollowup}
                                disabled={sending}
                                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Send Follow-Up SMS</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StalledLeadsWidget;
