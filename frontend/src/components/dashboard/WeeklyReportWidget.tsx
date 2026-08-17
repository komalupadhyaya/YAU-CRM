import React, { useState, useEffect } from 'react';
import { BarChart3, Sparkles, TrendingUp, RefreshCw, Award } from 'lucide-react';
import { getLatestWeeklyReport, triggerWeeklyReport, WeeklyReportData } from '../../api/ai.api';
import { toast } from 'sonner';

export const WeeklyReportWidget: React.FC = () => {
    const [report, setReport] = useState<WeeklyReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const res = await getLatestWeeklyReport();
            if (res.success && res.report) {
                setReport(res.report);
            }
        } catch (err) {
            console.error('Failed to fetch weekly report:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const handleGenerateNow = async () => {
        const toastId = toast.loading('Claude AI is analyzing CRM metrics & composing executive report...');
        try {
            setGenerating(true);
            const res = await triggerWeeklyReport();
            if (res.success && res.report) {
                toast.success('Weekly report generated & dispatched to play@yausports.com! 📈', { id: toastId });
                setReport(res.report);
            }
        } catch (err: any) {
            toast.error(err.message || 'Report generation failed', { id: toastId });
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-100">Weekly AI Executive Snapshot</h3>
                        <p className="text-xs text-slate-400">Monday Performance Analytics & Strategic Guidance</p>
                    </div>
                </div>
                <button
                    onClick={handleGenerateNow}
                    disabled={generating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                    <span>Run AI Report</span>
                </button>
            </div>

            {loading ? (
                <div className="text-xs text-slate-500 py-8 text-center">Loading weekly report snapshot...</div>
            ) : !report ? (
                <div className="text-xs text-slate-400 py-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/80">
                    No weekly report generated yet. Click "Run AI Report" to create your first executive report.
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">New Leads</span>
                            <div className="text-base font-bold text-slate-100 mt-0.5">{report.metrics?.totalNewLeads || 0}</div>
                        </div>
                        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Contacted</span>
                            <div className="text-base font-bold text-emerald-400 mt-0.5">{report.metrics?.contactedCount || 0}</div>
                        </div>
                        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Follow-Ups</span>
                            <div className="text-base font-bold text-blue-400 mt-0.5">{report.metrics?.followupsCompleted || 0}</div>
                        </div>
                        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">EA Conversions</span>
                            <div className="text-base font-bold text-purple-400 mt-0.5">{report.metrics?.eaConversions || 0}</div>
                        </div>
                    </div>

                    {/* Executive Summary */}
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                        <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5 text-xs">
                            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                            <span>Claude Executive Insights</span>
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: report.executiveSummary }} />
                    </div>

                    {/* Top 3 Strategic Recommendations */}
                    <div className="bg-emerald-950/20 border border-emerald-500/30 p-3.5 rounded-xl">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-2">
                            <TrendingUp className="w-4 h-4" />
                            <span>Top 3 Strategic Directives for Leadership</span>
                        </div>
                        <ul className="space-y-1.5 pl-4 list-disc text-xs text-emerald-200/90 font-medium">
                            {(report.aiRecommendations || []).map((rec, i) => (
                                <li key={i}>{rec}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeeklyReportWidget;
